from tests.conftest import auth_headers

REVIEWER = "reviewer@sintetis.railwayvision.example"
INSPECTOR = "inspector@sintetis.railwayvision.example"
SUPERVISOR = "supervisor@sintetis.railwayvision.example"
ADMIN = "admin@sintetis.railwayvision.example"


async def _submitted_inspection(client, headers, notes="Review fixture"):
    assets = await client.get("/api/v1/assets", headers=headers)
    asset_id = assets.json()["items"][0]["id"]
    created = await client.post(
        "/api/v1/inspections", headers=headers, json={"asset_id": asset_id, "notes": notes}
    )
    assert created.status_code == 201, created.text
    inspection = created.json()
    submitted = await client.post(
        f"/api/v1/inspections/{inspection['id']}/submit", headers=headers
    )
    assert submitted.status_code == 200, submitted.text
    return submitted.json()


async def test_reviewer_accepts_submitted_inspection(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _submitted_inspection(auth_client, inspector_headers)

    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    reviewed = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review",
        headers=reviewer_headers,
        json={
            "decision": "accepted",
            "notes": "Record and evidence reviewed; complete.",
            "version": inspection["version"],
        },
    )
    assert reviewed.status_code == 200, reviewed.text
    body = reviewed.json()
    assert body["status"] == "reviewed"
    assert body["version"] == inspection["version"] + 1
    assert body["reviews"][0]["decision"] == "accepted"
    assert body["reviews"][0]["reviewer"]["full_name"] == "Peninjau Sintetis"
    assert body["reviews"][0]["notes"] == "Record and evidence reviewed; complete."

    admin_headers = await auth_headers(auth_client, ADMIN)
    events = await auth_client.get(
        "/api/v1/audit-events?page_size=50", headers=admin_headers
    )
    actions = {event["action"] for event in events.json()["items"]}
    assert "inspection.review_accepted" in actions


async def test_returned_inspection_reopens_for_revision_then_resubmits(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _submitted_inspection(auth_client, inspector_headers)
    reviewer_headers = await auth_headers(auth_client, REVIEWER)

    returned = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review",
        headers=reviewer_headers,
        json={"decision": "returned", "notes": "Add the missing observation detail."},
    )
    assert returned.status_code == 200, returned.text
    assert returned.json()["status"] == "draft"

    revised = await auth_client.patch(
        f"/api/v1/inspections/{inspection['id']}",
        headers=inspector_headers,
        json={"notes": "Observation detail added after review."},
    )
    assert revised.status_code == 200, revised.text

    resubmitted = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/submit", headers=inspector_headers
    )
    assert resubmitted.status_code == 200, resubmitted.text

    accepted = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review",
        headers=reviewer_headers,
        json={"decision": "accepted", "notes": "Revision reviewed and accepted."},
    )
    assert accepted.status_code == 200, accepted.text
    body = accepted.json()
    assert body["status"] == "reviewed"
    assert [review["decision"] for review in body["reviews"]] == ["accepted", "returned"]


async def test_review_requires_submitted_status(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    assets = await auth_client.get("/api/v1/assets", headers=inspector_headers)
    draft = await auth_client.post(
        "/api/v1/inspections",
        headers=inspector_headers,
        json={"asset_id": assets.json()["items"][0]["id"]},
    )
    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    response = await auth_client.post(
        f"/api/v1/inspections/{draft.json()['id']}/review",
        headers=reviewer_headers,
        json={"decision": "accepted", "notes": "Not ready for review."},
    )
    assert response.status_code == 409

    submitted = await _submitted_inspection(auth_client, inspector_headers)
    accepted = await auth_client.post(
        f"/api/v1/inspections/{submitted['id']}/review",
        headers=reviewer_headers,
        json={"decision": "accepted", "notes": "First decision accepted."},
    )
    assert accepted.status_code == 200
    repeat = await auth_client.post(
        f"/api/v1/inspections/{submitted['id']}/review",
        headers=reviewer_headers,
        json={"decision": "returned", "notes": "Second decision should fail."},
    )
    assert repeat.status_code == 409


async def test_assigned_inspector_cannot_review_own_record(auth_client):
    supervisor_headers = await auth_headers(auth_client, SUPERVISOR)
    inspection = await _submitted_inspection(auth_client, supervisor_headers)
    response = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review",
        headers=supervisor_headers,
        json={"decision": "accepted", "notes": "Self review must be rejected."},
    )
    assert response.status_code == 403


async def test_inspector_lacks_review_permission(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _submitted_inspection(auth_client, inspector_headers)
    response = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review",
        headers=inspector_headers,
        json={"decision": "accepted", "notes": "Inspector cannot decide."},
    )
    assert response.status_code == 403


async def test_review_version_conflict_changes_nothing(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _submitted_inspection(auth_client, inspector_headers)
    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    response = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review",
        headers=reviewer_headers,
        json={
            "decision": "accepted",
            "notes": "Stale version must not apply.",
            "version": inspection["version"] - 1,
        },
    )
    assert response.status_code == 409

    unchanged = await auth_client.get(
        f"/api/v1/inspections/{inspection['id']}", headers=reviewer_headers
    )
    assert unchanged.json()["status"] == "submitted"
    assert unchanged.json()["reviews"] == []


async def test_review_notes_are_required_and_bounded(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _submitted_inspection(auth_client, inspector_headers)
    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    short = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review",
        headers=reviewer_headers,
        json={"decision": "accepted", "notes": "ok"},
    )
    assert short.status_code == 422
    long = await auth_client.post(
        f"/api/v1/inspections/{inspection['id']}/review",
        headers=reviewer_headers,
        json={"decision": "accepted", "notes": "x" * 2001},
    )
    assert long.status_code == 422


async def test_cross_scope_review_returns_404(auth_client):
    admin_headers = await auth_headers(auth_client, ADMIN)
    assets = await auth_client.get("/api/v1/assets?page_size=50", headers=admin_headers)
    south_asset = next(
        item for item in assets.json()["items"] if item["code"] == "SINTETIS-AST-0003"
    )
    created = await auth_client.post(
        "/api/v1/inspections",
        headers=admin_headers,
        json={"asset_id": south_asset["id"], "notes": "South corridor inspection"},
    )
    assert created.status_code == 201, created.text
    await auth_client.post(
        f"/api/v1/inspections/{created.json()['id']}/submit", headers=admin_headers
    )

    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    response = await auth_client.post(
        f"/api/v1/inspections/{created.json()['id']}/review",
        headers=reviewer_headers,
        json={"decision": "accepted", "notes": "Cross-scope must be hidden."},
    )
    assert response.status_code == 404
