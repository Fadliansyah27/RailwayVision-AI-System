from tests.conftest import auth_headers

ADMIN = "admin@demo.railwayvision.example"
INSPECTOR = "inspector@demo.railwayvision.example"


async def _asset_id(client, headers) -> str:
    response = await client.get("/api/v1/assets?page_size=50", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["items"][0]["id"]


async def _create_template(client, headers, *, active: bool = True, code: str = "ROUTINE-V1"):
    response = await client.post(
        "/api/v1/master/checklist-templates",
        headers=headers,
        json={
            "code": code,
            "name": "DEMO Checklist Jalur Rutin",
            "inspection_type": "routine",
            "is_active": active,
            "items": [
                {
                    "code": "SURFACE",
                    "label": "Permukaan jalur bebas dari retak terbuka (DEMO)",
                    "position": 1,
                    "is_required": True,
                },
                {
                    "code": "FASTENER",
                    "label": "Pengencang terpasang pada posisi (DEMO)",
                    "position": 2,
                    "is_required": True,
                },
                {
                    "code": "DRAINAGE",
                    "label": "Drainase sekitar segmen teramati (DEMO)",
                    "position": 3,
                    "is_required": False,
                },
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _create_inspection(client, headers, asset_id: str):
    response = await client.post(
        "/api/v1/inspections",
        headers=headers,
        json={"asset_id": asset_id, "inspection_type": "routine"},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_template_management_requires_manage_permission(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    denied = await auth_client.post(
        "/api/v1/master/checklist-templates",
        headers=inspector_headers,
        json={
            "code": "DENIED-V1",
            "name": "Tidak boleh dibuat",
            "inspection_type": "routine",
            "items": [{"code": "A1", "label": "Item demo", "position": 1}],
        },
    )
    assert denied.status_code == 403

    admin_headers = await auth_headers(auth_client, ADMIN)
    listed = await auth_client.get(
        "/api/v1/master/checklist-templates", headers=inspector_headers
    )
    assert listed.status_code == 200
    template = await _create_template(auth_client, admin_headers)
    assert template["is_active"] is True
    assert [item["code"] for item in template["items"]] == [
        "SURFACE",
        "FASTENER",
        "DRAINAGE",
    ]


async def test_active_template_is_snapshotted_and_submit_is_guarded(auth_client):
    admin_headers = await auth_headers(auth_client, ADMIN)
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    await _create_template(auth_client, admin_headers)
    asset_id = await _asset_id(auth_client, inspector_headers)

    inspection = await _create_inspection(auth_client, inspector_headers, asset_id)
    detail = await auth_client.get(
        f"/api/v1/inspections/{inspection['id']}", headers=inspector_headers
    )
    assert detail.status_code == 200, detail.text
    checklist = detail.json()["checklist"]
    assert checklist["template_code"] == "ROUTINE-V1"
    assert checklist["total"] == 3
    assert checklist["required_total"] == 2
    assert checklist["answered"] == 0
    assert checklist["required_unanswered"] == 2

    blocked = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/submit", headers=inspector_headers
    )
    assert blocked.status_code == 422
    assert blocked.json()["error"]["code"] == "checklist_incomplete"

    unknown = await auth_client.patch(
        f"/api/v1/inspections/{inspection['id']}/checklist",
        headers=inspector_headers,
        json={"entries": [{"item_code": "MISSING", "result": "pass"}]},
    )
    assert unknown.status_code == 422
    assert unknown.json()["error"]["code"] == "unknown_checklist_item"

    updated = await auth_client.patch(
        f"/api/v1/inspections/{inspection['id']}/checklist",
        headers=inspector_headers,
        json={
            "version": inspection["version"],
            "entries": [
                {"item_code": "SURFACE", "result": "pass", "notes": "Terlihat bersih (DEMO)."},
                {"item_code": "FASTENER", "result": "fail", "notes": "Perlu tinjauan (DEMO)."},
            ],
        },
    )
    assert updated.status_code == 200, updated.text
    checklist = updated.json()["checklist"]
    assert checklist["answered"] == 2
    assert checklist["required_unanswered"] == 0
    assert updated.json()["version"] == inspection["version"] + 1

    stale = await auth_client.patch(
        f"/api/v1/inspections/{inspection['id']}/checklist",
        headers=inspector_headers,
        json={
            "version": inspection["version"],
            "entries": [{"item_code": "DRAINAGE", "result": "not_applicable"}],
        },
    )
    assert stale.status_code == 409

    invalid_result = await auth_client.patch(
        f"/api/v1/inspections/{inspection['id']}/checklist",
        headers=inspector_headers,
        json={"entries": [{"item_code": "DRAINAGE", "result": "unsafe"}]},
    )
    assert invalid_result.status_code == 422

    submitted = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/submit", headers=inspector_headers
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "submitted"


async def test_checklist_snapshot_survives_template_deactivation(auth_client):
    admin_headers = await auth_headers(auth_client, ADMIN)
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    template = await _create_template(auth_client, admin_headers)
    asset_id = await _asset_id(auth_client, inspector_headers)
    inspection = await _create_inspection(auth_client, inspector_headers, asset_id)

    deactivated = await auth_client.patch(
        f"/api/v1/master/checklist-templates/{template['id']}",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert deactivated.status_code == 200, deactivated.text
    assert deactivated.json()["is_active"] is False

    detail = await auth_client.get(
        f"/api/v1/inspections/{inspection['id']}", headers=inspector_headers
    )
    assert detail.status_code == 200
    assert detail.json()["checklist"]["template_code"] == "ROUTINE-V1"
    assert len(detail.json()["checklist"]["items"]) == 3

    second = await _create_inspection(auth_client, inspector_headers, asset_id)
    second_detail = await auth_client.get(
        f"/api/v1/inspections/{second['id']}", headers=inspector_headers
    )
    assert second_detail.json()["checklist"] is None


async def test_only_one_active_template_per_inspection_type(auth_client):
    admin_headers = await auth_headers(auth_client, ADMIN)
    first = await _create_template(auth_client, admin_headers, code="ROUTINE-OLD")
    second = await _create_template(auth_client, admin_headers, code="ROUTINE-NEW")

    listed = await auth_client.get(
        "/api/v1/master/checklist-templates?inspection_type=routine",
        headers=admin_headers,
    )
    assert listed.status_code == 200
    by_code = {item["code"]: item for item in listed.json()["items"]}
    assert by_code[first["code"]]["is_active"] is False
    assert by_code[second["code"]]["is_active"] is True
