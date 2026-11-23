from tests.conftest import auth_headers

ADMIN = "admin@sintetis.railwayvision.example"
INSPECTOR = "inspector@sintetis.railwayvision.example"
REVIEWER = "reviewer@sintetis.railwayvision.example"
SUPERVISOR = "supervisor@sintetis.railwayvision.example"
AUDITOR = "auditor@sintetis.railwayvision.example"

FINDING = {
    "title": "SINTETIS surface observation",
    "description": "SINTETIS synthetic observation recorded for workflow testing only.",
    "priority": "high",
}


async def _reviewed_inspection(client, headers) -> dict:
    assets = await client.get("/api/v1/assets", headers=headers)
    created = await client.post(
        "/api/v1/inspections",
        headers=headers,
        json={"asset_id": assets.json()["items"][0]["id"], "notes": "Phase 7 fixture"},
    )
    assert created.status_code == 201, created.text
    inspection_id = created.json()["id"]
    submitted = await client.post(
        f"/api/v1/inspections/{inspection_id}/submit", headers=headers
    )
    assert submitted.status_code == 200, submitted.text
    reviewer_headers = await auth_headers(client, REVIEWER)
    reviewed = await client.post(
        f"/api/v1/inspections/{inspection_id}/review",
        headers=reviewer_headers,
        json={"decision": "accepted", "notes": "Record complete for follow-up."},
    )
    assert reviewed.status_code == 200, reviewed.text
    return reviewed.json()


async def _create_finding(client, headers, inspection_id: str) -> dict:
    response = await client.post(
        "/api/v1/findings",
        headers=headers,
        json={"inspection_id": inspection_id, **FINDING},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _inspector_id(client) -> str:
    admin_headers = await auth_headers(client, ADMIN)
    users = await client.get("/api/v1/users?page_size=50", headers=admin_headers)
    return next(item["id"] for item in users.json()["items"] if item["email"] == INSPECTOR)


async def _create_work_order(client, headers, finding_id: str, assignee_id: str) -> dict:
    response = await client.post(
        "/api/v1/work-orders",
        headers=headers,
        json={
            "finding_id": finding_id,
            "title": "SINTETIS corrective action",
            "instructions": "SINTETIS instruction text. Not a KCIC procedure.",
            "assignee_id": assignee_id,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_finding_created_from_reviewed_inspection(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _reviewed_inspection(auth_client, inspector_headers)
    reviewer_headers = await auth_headers(auth_client, REVIEWER)

    finding = await _create_finding(auth_client, reviewer_headers, inspection["id"])
    assert finding["reference"].startswith("FND-")
    assert finding["status"] == "confirmed"
    assert finding["priority"] == "high"
    assert finding["inspection"]["id"] == inspection["id"]
    assert finding["asset"]["code"] == inspection["asset"]["code"]
    assert finding["scope"]["code"] == inspection["scope"]["code"]

    detail = await auth_client.get(
        f"/api/v1/findings/{finding['id']}", headers=reviewer_headers
    )
    assert detail.status_code == 200
    assert detail.json()["work_orders"] == []

    summary = await auth_client.get("/api/v1/findings/summary", headers=reviewer_headers)
    assert summary.json()["counts"]["confirmed"] == 1

    admin_headers = await auth_headers(auth_client, ADMIN)
    events = await auth_client.get(
        "/api/v1/audit-events?page_size=50", headers=admin_headers
    )
    assert "finding.created" in {event["action"] for event in events.json()["items"]}

    supervisor_headers = await auth_headers(auth_client, SUPERVISOR)
    notifications = await auth_client.get(
        "/api/v1/notifications?unread_only=true", headers=supervisor_headers
    )
    kinds = {item["kind"] for item in notifications.json()["items"]}
    assert "finding.created" in kinds


async def test_finding_requires_reviewed_inspection_and_permission(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    assets = await auth_client.get("/api/v1/assets", headers=inspector_headers)
    draft = await auth_client.post(
        "/api/v1/inspections",
        headers=inspector_headers,
        json={"asset_id": assets.json()["items"][0]["id"]},
    )
    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    early = await auth_client.post(
        "/api/v1/findings",
        headers=reviewer_headers,
        json={"inspection_id": draft.json()["id"], **FINDING},
    )
    assert early.status_code == 409

    forbidden = await auth_client.post(
        "/api/v1/findings",
        headers=inspector_headers,
        json={"inspection_id": draft.json()["id"], **FINDING},
    )
    assert forbidden.status_code == 403


async def test_work_order_lifecycle_closes_finding(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _reviewed_inspection(auth_client, inspector_headers)
    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    supervisor_headers = await auth_headers(auth_client, SUPERVISOR)
    finding = await _create_finding(auth_client, reviewer_headers, inspection["id"])
    assignee_id = await _inspector_id(auth_client)

    work_order = await _create_work_order(
        auth_client, supervisor_headers, finding["id"], assignee_id
    )
    assert work_order["reference"].startswith("WO-")
    assert work_order["status"] == "open"
    assert work_order["assignee"]["id"] == assignee_id

    after_create = await auth_client.get(
        f"/api/v1/findings/{finding['id']}", headers=reviewer_headers
    )
    assert after_create.json()["status"] == "assigned"

    started = await auth_client.post(
        f"/api/v1/work-orders/{work_order['id']}/start", headers=inspector_headers
    )
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "in_progress"
    assert (
        await auth_client.get(
            f"/api/v1/findings/{finding['id']}", headers=reviewer_headers
        )
    ).json()["status"] == "in_progress"

    completed = await auth_client.post(
        f"/api/v1/work-orders/{work_order['id']}/complete",
        headers=inspector_headers,
        json={"notes": "SINTETIS corrective action completed; verification requested."},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "awaiting_verification"

    verify_denied = await auth_client.post(
        f"/api/v1/work-orders/{work_order['id']}/verify",
        headers=inspector_headers,
        json={"notes": "Assignee cannot verify its own completion."},
    )
    assert verify_denied.status_code == 403

    verified = await auth_client.post(
        f"/api/v1/work-orders/{work_order['id']}/verify",
        headers=supervisor_headers,
        json={"notes": "Completion independently verified for the sintetis record."},
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["status"] == "completed"

    closed = await auth_client.get(
        f"/api/v1/findings/{finding['id']}", headers=reviewer_headers
    )
    body = closed.json()
    assert body["status"] == "closed"
    assert body["closed_at"] is not None
    assert body["work_orders"][0]["status"] == "completed"

    summary = await auth_client.get("/api/v1/work-orders/summary", headers=supervisor_headers)
    assert summary.json()["counts"]["completed"] == 1

    admin_headers = await auth_headers(auth_client, ADMIN)
    events = await auth_client.get(
        "/api/v1/audit-events?page_size=50", headers=admin_headers
    )
    actions = {event["action"] for event in events.json()["items"]}
    assert {
        "work_order.created",
        "work_order.started",
        "work_order.completed",
        "work_order.verified",
    } <= actions


async def test_invalid_transitions_and_stale_versions(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _reviewed_inspection(auth_client, inspector_headers)
    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    supervisor_headers = await auth_headers(auth_client, SUPERVISOR)
    finding = await _create_finding(auth_client, reviewer_headers, inspection["id"])
    assignee_id = await _inspector_id(auth_client)
    work_order = await _create_work_order(
        auth_client, supervisor_headers, finding["id"], assignee_id
    )

    early = await auth_client.post(
        f"/api/v1/work-orders/{work_order['id']}/verify",
        headers=supervisor_headers,
        json={"notes": "Not yet completed."},
    )
    assert early.status_code == 409

    await auth_client.post(
        f"/api/v1/work-orders/{work_order['id']}/start", headers=inspector_headers
    )
    second_start = await auth_client.post(
        f"/api/v1/work-orders/{work_order['id']}/start", headers=inspector_headers
    )
    assert second_start.status_code == 409

    stale_order = await auth_client.patch(
        f"/api/v1/work-orders/{work_order['id']}",
        headers=supervisor_headers,
        json={"title": "SINTETIS stale edit", "version": work_order["version"]},
    )
    assert stale_order.status_code == 409

    stale_finding = await auth_client.patch(
        f"/api/v1/findings/{finding['id']}",
        headers=reviewer_headers,
        json={"title": "SINTETIS stale finding edit", "version": finding["version"]},
    )
    assert stale_finding.status_code == 409

    late_edit = await auth_client.patch(
        f"/api/v1/findings/{finding['id']}",
        headers=reviewer_headers,
        json={"title": "SINTETIS late edit"},
    )
    assert late_edit.status_code == 409

    cancel_denied = await auth_client.post(
        f"/api/v1/work-orders/{work_order['id']}/cancel",
        headers=reviewer_headers,
        json={"notes": "Reviewer cannot cancel work orders."},
    )
    assert cancel_denied.status_code == 403


async def test_work_order_cancel_reverts_finding(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _reviewed_inspection(auth_client, inspector_headers)
    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    supervisor_headers = await auth_headers(auth_client, SUPERVISOR)
    finding = await _create_finding(auth_client, reviewer_headers, inspection["id"])
    assignee_id = await _inspector_id(auth_client)
    work_order = await _create_work_order(
        auth_client, supervisor_headers, finding["id"], assignee_id
    )

    cancelled = await auth_client.post(
        f"/api/v1/work-orders/{work_order['id']}/cancel",
        headers=supervisor_headers,
        json={"notes": "SINTETIS cancellation; instruction withdrawn."},
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"

    reverted = await auth_client.get(
        f"/api/v1/findings/{finding['id']}", headers=reviewer_headers
    )
    assert reverted.json()["status"] == "confirmed"

    repeat = await auth_client.post(
        f"/api/v1/work-orders/{work_order['id']}/cancel",
        headers=supervisor_headers,
        json={"notes": "Already cancelled."},
    )
    assert repeat.status_code == 409


async def test_finding_reject_and_reopen(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _reviewed_inspection(auth_client, inspector_headers)
    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    supervisor_headers = await auth_headers(auth_client, SUPERVISOR)
    finding = await _create_finding(auth_client, reviewer_headers, inspection["id"])

    rejected = await auth_client.post(
        f"/api/v1/findings/{finding['id']}/reject",
        headers=reviewer_headers,
        json={"notes": "Duplicate of an existing sintetis record."},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["resolution_notes"] == "Duplicate of an existing sintetis record."

    assignee_id = await _inspector_id(auth_client)
    blocked = await auth_client.post(
        "/api/v1/work-orders",
        headers=supervisor_headers,
        json={
            "finding_id": finding["id"],
            "title": "SINTETIS blocked work order",
            "assignee_id": assignee_id,
        },
    )
    assert blocked.status_code == 409

    reopened = await auth_client.post(
        f"/api/v1/findings/{finding['id']}/reopen",
        headers=reviewer_headers,
        json={"notes": "Reopened after reassessing the sintetis evidence."},
    )
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["status"] == "confirmed"

    repeat = await auth_client.post(
        f"/api/v1/findings/{finding['id']}/reopen",
        headers=reviewer_headers,
        json={"notes": "Already confirmed."},
    )
    assert repeat.status_code == 409


async def test_cross_scope_findings_are_hidden(auth_client):
    admin_headers = await auth_headers(auth_client, ADMIN)
    assets = await auth_client.get("/api/v1/assets?page_size=50", headers=admin_headers)
    south_asset = next(
        item for item in assets.json()["items"] if item["code"] == "SINTETIS-AST-0003"
    )
    created = await auth_client.post(
        "/api/v1/inspections",
        headers=admin_headers,
        json={"asset_id": south_asset["id"], "notes": "South corridor follow-up"},
    )
    assert created.status_code == 201, created.text
    await auth_client.post(
        f"/api/v1/inspections/{created.json()['id']}/submit", headers=admin_headers
    )
    supervisor_headers = await auth_headers(auth_client, SUPERVISOR)
    reviewed = await auth_client.post(
        f"/api/v1/inspections/{created.json()['id']}/review",
        headers=supervisor_headers,
        json={"decision": "accepted", "notes": "South record complete."},
    )
    assert reviewed.status_code == 200, reviewed.text
    finding = await _create_finding(auth_client, supervisor_headers, created.json()["id"])
    assert finding["scope"]["code"] == "SINTETIS-SOUTH"

    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    hidden = await auth_client.get(
        f"/api/v1/findings/{finding['id']}", headers=reviewer_headers
    )
    assert hidden.status_code == 404

    assignee_id = await _inspector_id(auth_client)
    forbidden = await auth_client.post(
        "/api/v1/work-orders",
        headers=reviewer_headers,
        json={
            "finding_id": finding["id"],
            "title": "SINTETIS cross-scope attempt",
            "assignee_id": assignee_id,
        },
    )
    assert forbidden.status_code == 403

    south_work_order = await auth_client.post(
        "/api/v1/work-orders",
        headers=supervisor_headers,
        json={
            "finding_id": finding["id"],
            "title": "SINTETIS out-of-scope assignee",
            "assignee_id": assignee_id,
        },
    )
    assert south_work_order.status_code == 404


async def test_assignee_candidates_follow_the_scope_subtree(auth_client):
    supervisor_headers = await auth_headers(auth_client, SUPERVISOR)
    candidates = await auth_client.get(
        "/api/v1/work-orders/assignees", headers=supervisor_headers
    )
    assert candidates.status_code == 200, candidates.text
    assert "SINTETIS-NORTH" in {item["scope"]["code"] for item in candidates.json()}

    admin_headers = await auth_headers(auth_client, ADMIN)
    users = await auth_client.get("/api/v1/users?page_size=50", headers=admin_headers)
    by_email = {item["email"]: item["id"] for item in users.json()["items"]}
    candidate_ids = {item["id"] for item in candidates.json()}
    assert by_email[INSPECTOR] in candidate_ids
    assert by_email[REVIEWER] in candidate_ids
    assert by_email["ai@sintetis.railwayvision.example"] not in candidate_ids

    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    denied = await auth_client.get(
        "/api/v1/work-orders/assignees", headers=reviewer_headers
    )
    assert denied.status_code == 403


async def test_notifications_are_private_and_markable(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _reviewed_inspection(auth_client, inspector_headers)
    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    supervisor_headers = await auth_headers(auth_client, SUPERVISOR)
    finding = await _create_finding(auth_client, reviewer_headers, inspection["id"])
    assignee_id = await _inspector_id(auth_client)
    await _create_work_order(auth_client, supervisor_headers, finding["id"], assignee_id)

    inspector_notifications = await auth_client.get(
        "/api/v1/notifications", headers=inspector_headers
    )
    assert inspector_notifications.status_code == 200
    items = inspector_notifications.json()["items"]
    assert any(item["kind"] == "work_order.assigned" for item in items)
    notification_id = items[0]["id"]

    summary = await auth_client.get(
        "/api/v1/notifications/summary", headers=inspector_headers
    )
    assert summary.json()["unread"] >= 1

    auditor_headers = await auth_headers(auth_client, AUDITOR)
    foreign = await auth_client.post(
        f"/api/v1/notifications/{notification_id}/read", headers=auditor_headers
    )
    assert foreign.status_code == 404

    read = await auth_client.post(
        f"/api/v1/notifications/{notification_id}/read", headers=inspector_headers
    )
    assert read.status_code == 200
    assert read.json()["read_at"] is not None

    cleared = await auth_client.post(
        "/api/v1/notifications/read-all", headers=inspector_headers
    )
    assert cleared.status_code == 200
    assert cleared.json()["unread"] == 0
    remaining = await auth_client.get(
        "/api/v1/notifications/summary", headers=inspector_headers
    )
    assert remaining.json()["unread"] == 0


async def test_auditor_is_read_only_for_maintenance(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    inspection = await _reviewed_inspection(auth_client, inspector_headers)
    reviewer_headers = await auth_headers(auth_client, REVIEWER)
    finding = await _create_finding(auth_client, reviewer_headers, inspection["id"])

    auditor_headers = await auth_headers(auth_client, AUDITOR)
    visible = await auth_client.get(
        f"/api/v1/findings/{finding['id']}", headers=auditor_headers
    )
    assert visible.status_code == 200

    denied = await auth_client.patch(
        f"/api/v1/findings/{finding['id']}",
        headers=auditor_headers,
        json={"title": "Auditor edit attempt"},
    )
    assert denied.status_code == 403

    work_orders = await auth_client.get("/api/v1/work-orders", headers=auditor_headers)
    assert work_orders.status_code == 200
