async def test_not_found_uses_error_envelope(client):
    response = await client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "not_found"
    assert body["error"]["request_id"] == response.headers["x-request-id"]


async def test_method_not_allowed_uses_error_envelope(client):
    response = await client.put("/api/v1/meta")

    assert response.status_code == 405
    assert response.json()["error"]["code"] == "method_not_allowed"
