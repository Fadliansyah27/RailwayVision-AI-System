from tests.conftest import auth_headers

ADMIN = "admin@sintetis.railwayvision.example"
AI_ENGINEER = "ai@sintetis.railwayvision.example"
INSPECTOR = "inspector@sintetis.railwayvision.example"
AUDITOR = "auditor@sintetis.railwayvision.example"

CHECKSUM = "a" * 64


async def _register(client, headers, code: str, version: str, **extra):
    payload = {
        "code": code,
        "name": f"SINTETIS {code}",
        "version": version,
        "family": "test-yolo-family",
        "checksum_sha256": CHECKSUM,
        "dataset_version": "sintetis-dataset-1.0",
        "class_names": ["retak", "korosi"],
        "known_limitations": "Hanya untuk unit test.",
        "is_demo": False,
        **extra,
    }
    response = await client.post("/api/v1/models", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def _approve(client, headers, model_id: str) -> None:
    submitted = await client.post(
        f"/api/v1/models/{model_id}/submit", headers=headers
    )
    assert submitted.status_code == 200, submitted.text
    approved = await client.post(
        f"/api/v1/models/{model_id}/approve",
        headers=headers,
        json={"notes": "Evaluasi teknis ditinjau pada lingkungan pengujian."},
    )
    assert approved.status_code == 200, approved.text


async def test_model_requires_evaluation_before_approval(auth_client):
    headers = await auth_headers(auth_client, ADMIN)
    model = await _register(auth_client, headers, "test-yolo-a", "1.0.0")

    missing_metrics = await auth_client.post(
        f"/api/v1/models/{model['id']}/submit", headers=headers
    )
    assert missing_metrics.status_code == 200, missing_metrics.text

    blocked = await auth_client.post(
        f"/api/v1/models/{model['id']}/approve",
        headers=headers,
        json={"notes": "Tanpa metrik evaluasi."},
    )
    assert blocked.status_code == 409
    assert "metrik evaluasi" in blocked.json()["error"]["message"]

    incomplete = await _register(
        auth_client,
        headers,
        "test-yolo-b",
        "1.0.0",
        checksum_sha256=None,
        dataset_version=None,
    )
    rejected = await auth_client.post(
        f"/api/v1/models/{incomplete['id']}/submit", headers=headers
    )
    assert rejected.status_code == 409
    assert "checksum SHA-256" in rejected.json()["error"]["message"]


async def test_model_deployment_and_rollback(auth_client):
    headers = await auth_headers(auth_client, ADMIN)
    metrics = {"precision": 0.5, "recall": 0.4, "source": "synthetic unit test"}
    first = await _register(
        auth_client, headers, "test-yolo-v1", "1.0.0", evaluation_metrics=metrics
    )
    await _approve(auth_client, headers, first["id"])
    deployed_first = await auth_client.post(
        f"/api/v1/models/{first['id']}/deploy", headers=headers
    )
    assert deployed_first.status_code == 200, deployed_first.text
    assert deployed_first.json()["status"] == "active"

    second = await _register(
        auth_client, headers, "test-yolo-v2", "2.0.0", evaluation_metrics=metrics
    )
    await _approve(auth_client, headers, second["id"])
    deployed_second = await auth_client.post(
        f"/api/v1/models/{second['id']}/deploy", headers=headers
    )
    assert deployed_second.status_code == 200
    assert deployed_second.json()["status"] == "active"

    listed = await auth_client.get("/api/v1/models", headers=headers)
    by_code = {item["code"]: item for item in listed.json()["items"]}
    assert by_code["test-yolo-v1"]["status"] == "retired"
    assert by_code["test-yolo-v2"]["status"] == "active"

    rollback = await auth_client.post(
        f"/api/v1/models/{first['id']}/deploy", headers=headers
    )
    assert rollback.status_code == 200, rollback.text
    listed = await auth_client.get("/api/v1/models", headers=headers)
    by_code = {item["code"]: item for item in listed.json()["items"]}
    assert by_code["test-yolo-v1"]["status"] == "active"
    assert by_code["test-yolo-v2"]["status"] == "retired"

    history = await auth_client.get(
        f"/api/v1/models/{first['id']}/history", headers=headers
    )
    assert history.status_code == 200, history.text
    actions = {event["action"] for event in history.json()}
    assert {"model.registered", "model.submitted", "model.approved", "model.deployed"} <= actions


async def test_sintetis_model_bypasses_approval_flow(auth_client):
    headers = await auth_headers(auth_client, ADMIN)
    sintetis = await _register(
        auth_client,
        headers,
        "synthetic-only-heuristic",
        "0.1.0",
        is_demo=True,
        dataset_version=None,
        checksum_sha256=None,
        class_names=[],
    )
    response = await auth_client.post(
        f"/api/v1/models/{sintetis['id']}/submit", headers=headers
    )
    assert response.status_code == 409
    assert "sintetis" in response.json()["error"]["message"]

    deploy = await auth_client.post(
        f"/api/v1/models/{sintetis['id']}/deploy", headers=headers
    )
    assert deploy.status_code == 409


async def test_registry_permissions_and_dataset_lifecycle(auth_client):
    inspector_headers = await auth_headers(auth_client, INSPECTOR)
    denied = await auth_client.post(
        "/api/v1/datasets",
        headers=inspector_headers,
        json={
            "code": "test-ds",
            "name": "Dataset sintetis",
            "version": "1.0",
            "source": "unit test",
            "license_note": "synthetic only",
        },
    )
    assert denied.status_code == 403

    engineer_headers = await auth_headers(auth_client, AI_ENGINEER)
    created = await auth_client.post(
        "/api/v1/datasets",
        headers=engineer_headers,
        json={
            "code": "test-ds",
            "name": "Dataset sintetis sintetis",
            "version": "1.0.0",
            "source": "Pembuatan sintetis untuk pengujian",
            "license_note": "Hanya pengujian; bukan data KCIC",
            "class_names": ["retak", "korosi"],
            "image_count": 30,
            "split_train": 20,
            "split_validation": 5,
            "split_test": 5,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "draft"

    duplicate = await auth_client.post(
        "/api/v1/datasets",
        headers=engineer_headers,
        json={
            "code": "test-ds",
            "name": "Duplikat",
            "version": "1.0.1",
            "source": "unit test",
            "license_note": "synthetic only",
        },
    )
    assert duplicate.status_code == 409

    invalid_split = await auth_client.post(
        "/api/v1/datasets",
        headers=engineer_headers,
        json={
            "code": "test-ds-overflow",
            "name": "Pembagian tidak valid",
            "version": "1.0.0",
            "source": "unit test",
            "license_note": "synthetic only",
            "image_count": 10,
            "split_train": 8,
            "split_validation": 8,
        },
    )
    assert invalid_split.status_code == 422

    dataset_id = created.json()["id"]
    submitted = await auth_client.post(
        f"/api/v1/datasets/{dataset_id}/submit", headers=engineer_headers
    )
    assert submitted.status_code == 200
    approved = await auth_client.post(
        f"/api/v1/datasets/{dataset_id}/approve",
        headers=engineer_headers,
        json={"notes": "Metadata dan izin penggunaan ditinjau untuk pengujian."},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert approved.json()["approved_by"]["full_name"]

    auditor_headers = await auth_headers(auth_client, AUDITOR)
    listed = await auth_client.get("/api/v1/datasets", headers=auditor_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["code"] == "test-ds"

    auditor_write = await auth_client.post(
        f"/api/v1/datasets/{dataset_id}/approve",
        headers=auditor_headers,
        json={"notes": "Tidak berwenang menyetujui."},
    )
    assert auditor_write.status_code == 403
