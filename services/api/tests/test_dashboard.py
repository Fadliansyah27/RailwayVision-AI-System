from tests.conftest import auth_headers

ADMIN = "admin@sintetis.railwayvision.example"
INSPECTOR = "inspector@sintetis.railwayvision.example"


async def test_dashboard_overview_reports_live_counts(auth_client):
    headers = await auth_headers(auth_client, ADMIN)
    response = await auth_client.get("/api/v1/dashboard/overview", headers=headers)
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["generated_at"]
    inspections = payload["inspections"]
    assert inspections["total"] >= 1
    assert set(inspections["counts"]) == {
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
    assert sum(inspections["counts"].values()) == inspections["total"]

    assert payload["findings"]["total"] >= 0
    assert payload["findings"]["open"] <= payload["findings"]["total"]
    assert payload["work_orders"]["active"] <= payload["work_orders"]["total"]
    assert payload["overdue_after_days"] == 14

    trend = payload["inspection_trend"]
    assert len(trend) == 6
    assert trend[-1]["month"] == payload["generated_at"][:7]
    assert all(point["count"] >= 0 for point in trend)

    recent = payload["recent_inspections"]
    assert 1 <= len(recent) <= 5
    assert recent[0]["asset"]["code"].startswith("SINTETIS-")


async def test_dashboard_requires_permission_and_authentication(auth_client):
    anonymous = await auth_client.get("/api/v1/dashboard/overview")
    assert anonymous.status_code == 401

    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    allowed = await auth_client.get(
        "/api/v1/dashboard/overview", headers=inspector_headers
    )
    assert allowed.status_code == 200, allowed.text
