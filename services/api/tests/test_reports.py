from tests.conftest import auth_headers

ADMIN = "admin@demo.railwayvision.example"
REVIEWER = "reviewer@demo.railwayvision.example"
INSPECTOR = "inspector@demo.railwayvision.example"


async def test_report_summary_uses_scope_and_period(auth_client):
    headers = await auth_headers(auth_client, REVIEWER)
    response = await auth_client.get("/api/v1/reports/summary", headers=headers)
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["totals"]["inspections"] == len(payload["inspections"])
    assert payload["date_from"] <= payload["date_to"]
    assert payload["generated_at"]
    assert "reviewed" in payload["inspection_counts"]
    if payload["inspections"]:
        row = payload["inspections"][0]
        assert "INS-" in row["reference"]
        assert row["asset"]["code"].startswith("DEMO-")


async def test_report_exports_return_files(auth_client):
    headers = await auth_headers(auth_client, ADMIN)

    xlsx = await auth_client.get("/api/v1/reports/inspections.xlsx", headers=headers)
    assert xlsx.status_code == 200, xlsx.text
    assert xlsx.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument"
    )
    assert "attachment;" in xlsx.headers["content-disposition"]
    assert xlsx.content[:2] == b"PK"

    pdf = await auth_client.get("/api/v1/reports/inspections.pdf", headers=headers)
    assert pdf.status_code == 200, pdf.text
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content[:4] == b"%PDF"


async def test_report_validation_and_permissions(auth_client):
    headers = await auth_headers(auth_client, REVIEWER)
    invalid = await auth_client.get(
        "/api/v1/reports/summary?date_from=2026-11-30&date_to=2026-11-01",
        headers=headers,
    )
    assert invalid.status_code == 422
    assert "Tanggal awal" in invalid.json()["error"]["message"]

    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    denied = await auth_client.get(
        "/api/v1/reports/summary", headers=inspector_headers
    )
    assert denied.status_code == 403

    anonymous = await auth_client.get("/api/v1/reports/summary")
    assert anonymous.status_code == 401
