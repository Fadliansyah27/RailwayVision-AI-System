from tests.conftest import auth_headers, login


async def test_login_success_and_me(auth_client):
    response = await login(auth_client, "inspector@demo.railwayvision.example")
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "inspector@demo.railwayvision.example"
    assert body["user"]["scope"]["code"] == "DEMO-NORTH"
    assert not body.get("refresh_token")

    me = await auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["roles"][0]["code"] == "inspector"


async def test_login_rejects_wrong_password(auth_client):
    response = await login(auth_client, "inspector@demo.railwayvision.example", "wrong-password")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


async def test_login_rate_limit_after_repeated_failures(auth_client):
    for _ in range(5):
        await login(auth_client, "auditor@demo.railwayvision.example", "bad-password")
    response = await login(auth_client, "auditor@demo.railwayvision.example", "bad-password")
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"


async def test_refresh_rotation_and_logout_revokes_access(auth_client):
    login_response = await login(
        auth_client, "inspector@demo.railwayvision.example", body=True
    )
    body = login_response.json()
    refresh_token = body["refresh_token"]
    access_token = body["access_token"]

    rotated = await auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
        headers={"X-Refresh-Transport": "body"},
    )
    assert rotated.status_code == 200
    new_refresh = rotated.json()["refresh_token"]
    assert new_refresh != refresh_token

    reused = await auth_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert reused.status_code == 401

    logout = await auth_client.post(
        "/api/v1/auth/logout", json={"refresh_token": new_refresh}
    )
    assert logout.status_code == 204

    me = await auth_client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert me.status_code == 401


async def test_scope_isolation_hides_other_corridor(auth_client):
    admin_headers = await auth_headers(auth_client, "admin@demo.railwayvision.example")
    all_assets = await auth_client.get("/api/v1/assets?page_size=50", headers=admin_headers)
    assert all_assets.json()["total"] == 3
    south_asset = next(
        item for item in all_assets.json()["items"] if item["code"] == "DEMO-AST-0003"
    )

    inspector_headers = await auth_headers(
        auth_client, "inspector@demo.railwayvision.example"
    )
    listing = await auth_client.get("/api/v1/assets?page_size=50", headers=inspector_headers)
    assert listing.json()["total"] == 2

    hidden = await auth_client.get(
        f"/api/v1/assets/{south_asset['id']}", headers=inspector_headers
    )
    assert hidden.status_code == 404


async def test_rbac_blocks_inspector_asset_creation(auth_client):
    headers = await auth_headers(auth_client, "inspector@demo.railwayvision.example")
    response = await auth_client.post(
        "/api/v1/assets",
        headers=headers,
        json={
            "code": "DEMO-AST-9999",
            "name": "Should fail",
            "category_id": "00000000-0000-0000-0000-000000000000",
        },
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_inspector_can_create_and_submit_inspection(auth_client):
    headers = await auth_headers(auth_client, "inspector@demo.railwayvision.example")
    assets = await auth_client.get("/api/v1/assets", headers=headers)
    asset_id = assets.json()["items"][0]["id"]

    created = await auth_client.post(
        "/api/v1/inspections",
        headers=headers,
        json={"asset_id": asset_id, "notes": "Automated test inspection"},
    )
    assert created.status_code == 201, created.text
    inspection = created.json()
    assert inspection["status"] == "draft"

    submitted = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/submit", headers=headers
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"

    edit_after_submit = await auth_client.patch(
        f"/api/v1/inspections/{inspection['id']}",
        headers=headers,
        json={"notes": "late edit"},
    )
    assert edit_after_submit.status_code == 409


async def test_auditor_is_read_only_and_admin_manages_users(auth_client):
    auditor_headers = await auth_headers(auth_client, "auditor@demo.railwayvision.example")
    assets = await auth_client.get("/api/v1/assets", headers=auditor_headers)
    assert assets.status_code == 200

    denied = await auth_client.post(
        "/api/v1/inspections",
        headers=auditor_headers,
        json={"asset_id": assets.json()["items"][0]["id"]},
    )
    assert denied.status_code == 403

    admin_headers = await auth_headers(auth_client, "admin@demo.railwayvision.example")
    users = await auth_client.get("/api/v1/users", headers=admin_headers)
    assert users.status_code == 200
    assert users.json()["total"] == 6

    roles = await auth_client.get("/api/v1/roles", headers=admin_headers)
    assert roles.status_code == 200
    assert {role["code"] for role in roles.json()} >= {
        "administrator",
        "inspector",
        "reviewer",
        "supervisor",
        "ai_ml_engineer",
        "auditor",
    }


async def test_audit_events_record_material_actions(auth_client):
    headers = await auth_headers(auth_client, "inspector@demo.railwayvision.example")
    assets = await auth_client.get("/api/v1/assets", headers=headers)
    await auth_client.post(
        "/api/v1/inspections",
        headers=headers,
        json={"asset_id": assets.json()["items"][0]["id"]},
    )

    admin_headers = await auth_headers(auth_client, "admin@demo.railwayvision.example")
    events = await auth_client.get("/api/v1/audit-events?page_size=50", headers=admin_headers)
    actions = {event["action"] for event in events.json()["items"]}
    assert "inspection.created" in actions
    assert "auth.login" in actions
    assert events.json()["total"] > 0
