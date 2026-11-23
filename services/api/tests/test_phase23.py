from tests.conftest import auth_headers, login

ADMIN = "admin@sintetis.railwayvision.example"
INSPECTOR = "inspector@sintetis.railwayvision.example"
REVIEWER = "reviewer@sintetis.railwayvision.example"
SUPERVISOR = "supervisor@sintetis.railwayvision.example"


async def _asset_id(client, headers) -> str:
    response = await client.get("/api/v1/assets?page_size=50", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["items"][0]["id"]


async def _user_id(client, admin_headers, email: str) -> str:
    response = await client.get(
        f"/api/v1/users?search={email}", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    return response.json()["items"][0]["id"]


async def test_password_reset_requires_an_admin_issued_token(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    me = await auth_client.get("/api/v1/auth/me", headers=inspector_headers)
    assert me.status_code == 200

    unknown = await auth_client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": "nobody@sintetis.railwayvision.example"},
    )
    assert unknown.status_code == 202
    assert unknown.json() == {"status": "accepted"}

    requested = await auth_client.post(
        "/api/v1/auth/password-reset/request", json={"email": INSPECTOR}
    )
    assert requested.status_code == 202

    admin_headers = await auth_headers(auth_client, ADMIN)
    pending = await auth_client.get(
        "/api/v1/password-reset-requests", headers=admin_headers
    )
    assert pending.status_code == 200, pending.text
    assert [item["email"] for item in pending.json()] == [INSPECTOR]

    user_id = await _user_id(auth_client, admin_headers, INSPECTOR)
    issued = await auth_client.post(
        f"/api/v1/users/{user_id}/password-reset-token", headers=admin_headers
    )
    assert issued.status_code == 200, issued.text
    token = issued.json()["token"]

    new_password = "Test-Reset-Password-2026"
    confirmed = await auth_client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "new_password": new_password},
    )
    assert confirmed.status_code == 204, confirmed.text

    assert (await login(auth_client, INSPECTOR)).status_code == 401
    assert (await login(auth_client, INSPECTOR, new_password)).status_code == 200

    reused = await auth_client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "new_password": "Another-Password-2026"},
    )
    assert reused.status_code == 400
    assert "tidak valid atau kedaluwarsa" in reused.json()["error"]["message"]


async def test_password_reset_token_requires_a_pending_request(auth_client):
    admin_headers = await auth_headers(auth_client, ADMIN)
    user_id = await _user_id(auth_client, admin_headers, REVIEWER)
    response = await auth_client.post(
        f"/api/v1/users/{user_id}/password-reset-token", headers=admin_headers
    )
    assert response.status_code == 409

    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    denied = await auth_client.get(
        "/api/v1/password-reset-requests", headers=inspector_headers
    )
    assert denied.status_code == 403


async def test_user_filters_and_admin_detail_fields(auth_client):
    admin_headers = await auth_headers(auth_client, ADMIN)
    reviewers = await auth_client.get(
        "/api/v1/users?role_code=reviewer", headers=admin_headers
    )
    assert reviewers.status_code == 200, reviewers.text
    assert reviewers.json()["total"] == 1
    item = reviewers.json()["items"][0]
    assert item["email"] == REVIEWER
    assert item["created_at"]
    assert item["updated_at"]

    paged = await auth_client.get(
        "/api/v1/users?page=1&page_size=2", headers=admin_headers
    )
    assert paged.json()["page_size"] == 2
    assert len(paged.json()["items"]) <= 2
    assert paged.json()["total"] == 6

    searched = await auth_client.get(
        "/api/v1/users?search=SINTETIS&is_active=true", headers=admin_headers
    )
    assert searched.json()["total"] == 6


async def test_asset_reference_management_location_filter_and_summary(auth_client):
    admin_headers = await auth_headers(auth_client, ADMIN)

    category = await auth_client.post(
        "/api/v1/asset-categories",
        headers=admin_headers,
        json={"code": "SIGNAL", "name": "Signalling (SINTETIS)"},
    )
    assert category.status_code == 201, category.text
    category_id = category.json()["id"]

    duplicate = await auth_client.post(
        "/api/v1/asset-categories",
        headers=admin_headers,
        json={"code": "SIGNAL", "name": "Duplicate"},
    )
    assert duplicate.status_code == 409

    renamed = await auth_client.patch(
        f"/api/v1/asset-categories/{category_id}",
        headers=admin_headers,
        json={"name": "Signalling equipment (SINTETIS)"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Signalling equipment (SINTETIS)"

    scopes = await auth_client.get("/api/v1/scopes", headers=admin_headers)
    north = next(scope for scope in scopes.json() if scope["code"] == "SINTETIS-NORTH")

    location = await auth_client.post(
        "/api/v1/locations",
        headers=admin_headers,
        json={
            "code": "SINTETIS-LOC-N2",
            "name": "SINTETIS North Yard 02",
            "description": "Synthetic example location.",
            "scope_id": north["id"],
        },
    )
    assert location.status_code == 201, location.text
    location_id = location.json()["id"]

    updated_location = await auth_client.patch(
        f"/api/v1/locations/{location_id}",
        headers=admin_headers,
        json={"name": "SINTETIS North Yard 02 (renamed)"},
    )
    assert updated_location.status_code == 200

    created_asset = await auth_client.post(
        "/api/v1/assets",
        headers=admin_headers,
        json={
            "code": "SINTETIS-AST-0100",
            "name": "SINTETIS signal cabinet S-01",
            "category_id": category_id,
            "location_id": location_id,
        },
    )
    assert created_asset.status_code == 201, created_asset.text

    filtered = await auth_client.get(
        f"/api/v1/assets?location_id={location_id}", headers=admin_headers
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["code"] == "SINTETIS-AST-0100"

    summary = await auth_client.get("/api/v1/assets/summary", headers=admin_headers)
    assert summary.status_code == 200, summary.text
    assert summary.json() == {
        "total": 4,
        "active": 4,
        "out_of_service": 0,
        "retired": 0,
    }

    events = await auth_client.get(
        f"/api/v1/audit-events?target_type=asset_category&target_id={category_id}",
        headers=admin_headers,
    )
    actions = {event["action"] for event in events.json()["items"]}
    assert {"asset_category.created", "asset_category.updated"} <= actions

    auditor_headers = await auth_headers(
        auth_client, "auditor@sintetis.railwayvision.example"
    )
    denied = await auth_client.post(
        "/api/v1/locations",
        headers=auditor_headers,
        json={"code": "SINTETIS-LOC-X", "name": "Denied", "scope_id": north["id"]},
    )
    assert denied.status_code == 403


async def test_inspection_fields_and_nine_status_workflow(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    asset_id = await _asset_id(auth_client, inspector_headers)

    created = await auth_client.post(
        "/api/v1/inspections",
        headers=inspector_headers,
        json={
            "asset_id": asset_id,
            "inspection_type": "detailed",
            "location_reference": "SINTETIS chainage marker 12",
            "notes": "Workflow coverage draft.",
        },
    )
    assert created.status_code == 201, created.text
    inspection = created.json()
    assert inspection["inspection_type"] == "detailed"
    assert inspection["location_reference"] == "SINTETIS chainage marker 12"

    updated = await auth_client.patch(
        f"/api/v1/inspections/{inspection['id']}",
        headers=inspector_headers,
        json={"inspection_type": "follow_up", "version": inspection["version"]},
    )
    assert updated.status_code == 200
    assert updated.json()["inspection_type"] == "follow_up"

    invalid_type = await auth_client.post(
        "/api/v1/inspections",
        headers=inspector_headers,
        json={"asset_id": asset_id, "inspection_type": "invented"},
    )
    assert invalid_type.status_code == 422

    submitted = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/submit", headers=inspector_headers
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"

    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    started = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review/start",
        headers=reviewer_headers,
    )
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "under_review"

    repeated = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review/start",
        headers=reviewer_headers,
    )
    assert repeated.status_code == 409

    supervisor_headers = await auth_headers(auth_client, SUPERVISOR)
    cancel_under_review = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/cancel", headers=supervisor_headers
    )
    assert cancel_under_review.status_code == 409

    auditor_headers = await auth_headers(
        auth_client, "auditor@sintetis.railwayvision.example"
    )
    undecidable = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review",
        headers=auditor_headers,
        json={"decision": "accepted", "notes": "Attempt from the wrong role."},
    )
    assert undecidable.status_code == 403

    inconclusive = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review",
        headers=reviewer_headers,
        json={
            "decision": "inconclusive",
            "notes": "Evidence is insufficient for a completeness decision.",
        },
    )
    assert inconclusive.status_code == 200, inconclusive.text
    assert inconclusive.json()["status"] == "inconclusive"

    reopened = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/reopen", headers=supervisor_headers
    )
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["status"] == "draft"

    summary = await auth_client.get(
        "/api/v1/inspections/summary", headers=inspector_headers
    )
    assert summary.status_code == 200, summary.text
    assert set(summary.json()["counts"]) == {
        "draft",
        "submitted",
        "ai_processing",
        "ai_processed",
        "under_review",
        "reviewed",
        "ai_failed",
        "cancelled",
        "inconclusive",
    }
    assert summary.json()["counts"]["draft"] >= 1

    events = await auth_client.get(
        f"/api/v1/audit-events?target_type=inspection&target_id={inspection['id']}",
        headers=await auth_headers(auth_client, ADMIN),
    )
    actions = {event["action"] for event in events.json()["items"]}
    assert {
        "inspection.created",
        "inspection.updated",
        "inspection.submitted",
        "inspection.review_started",
        "inspection.review_inconclusive",
        "inspection.reopened",
    } <= actions
