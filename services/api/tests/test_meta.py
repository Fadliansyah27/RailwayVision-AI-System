async def test_meta_returns_advisory_disclaimer(client):
    response = await client.get("/api/v1/meta")

    assert response.status_code == 200
    body = response.json()
    assert body["api_version"] == "v1"
    assert body["environment"] == "test"
    assert "saran" in body["ai_disclaimer"].lower()
    assert "aman atau tidak aman" in body["ai_disclaimer"].lower()


async def test_openapi_document_is_available_in_non_production(client):
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "RailwayVision AI API"
