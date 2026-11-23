import base64
import hashlib

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.seed import seed_ai_registry, seed_demo_content, seed_rbac
from app.services.queue import task_queue_dependency
from app.services.storage import storage_dependency
from tests.conftest import FakeRedis

PASSWORD = "Test-Demo-Password-2026"

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
PNG_SHA = hashlib.sha256(PNG_1X1).hexdigest()

JPEG_HEADER = b"\xff\xd8\xff\xe0" + b"\x00" * 32

INS = "/api/v1/inspections"
MEDIA = "/api/v1/media"


class FakeStorage:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}
        self.quarantined: list[tuple[str, bytes]] = []

    async def ensure_buckets(self) -> None:
        return None

    async def put_bytes(self, bucket, key, data, content_type) -> None:
        self.objects[(bucket, key)] = data

    async def get_bytes(self, bucket, key) -> bytes:
        return self.objects[(bucket, key)]

    async def move_to_quarantine(self, key, data, content_type) -> str:
        quarantine_key = f"quarantine/{key}"
        self.quarantined.append((key, data))
        self.objects[("railwayvision-quarantine", quarantine_key)] = data
        return quarantine_key


class FakeQueue:
    def __init__(self) -> None:
        self.jobs: list[str] = []

    async def enqueue_demo_quality_check(self, job_id: str) -> None:
        self.jobs.append(job_id)


@pytest.fixture
async def media_env(api_app):
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async with session_factory() as session:
        scopes = await seed_rbac(session)
        await seed_ai_registry(session)
        await seed_demo_content(session, scopes)
        await session.commit()

    storage = FakeStorage()
    queue = FakeQueue()
    api_app.dependency_overrides[get_db] = override_get_db
    api_app.dependency_overrides[storage_dependency] = lambda: storage
    api_app.dependency_overrides[task_queue_dependency] = lambda: queue
    api_app.state.redis = FakeRedis()

    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client, storage, queue, api_app

    api_app.dependency_overrides.clear()
    await engine.dispose()


async def _headers(client: AsyncClient, email: str) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _seed_inspection_id(client: AsyncClient, headers: dict[str, str]) -> str:
    response = await client.get(f"{INS}?mine=true", headers=headers)
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert items, "seed inspection missing"
    return items[0]["id"]


async def _intent(
    client, headers, inspection_id, *, size=None, sha=None, content_type="image/png"
):
    return await client.post(
        f"{INS}/{inspection_id}/media",
        headers=headers,
        json={
            "filename": "evidence.png",
            "content_type": content_type,
            "size_bytes": len(PNG_1X1) if size is None else size,
            "sha256": PNG_SHA if sha is None else sha,
        },
    )


async def test_media_upload_flow_and_download(media_env):
    client, storage, _, _ = media_env
    headers = await _headers(client, "inspector@demo.railwayvision.example")
    inspection_id = await _seed_inspection_id(client, headers)

    intent = await _intent(client, headers, inspection_id)
    assert intent.status_code == 201, intent.text
    media = intent.json()
    assert media["status"] == "pending_upload"

    upload = await client.put(
        f"{MEDIA}/{media['id']}/content",
        headers={**headers, "Content-Type": "image/png"},
        content=PNG_1X1,
    )
    assert upload.status_code == 200, upload.text
    uploaded = upload.json()
    assert uploaded["status"] == "ready"
    assert uploaded["sha256"] == PNG_SHA
    assert uploaded["quarantine_reason"] is None
    assert storage.objects

    listed = await client.get(f"{INS}/{inspection_id}/media", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    detail = await client.get(f"{INS}/{inspection_id}", headers=headers)
    assert detail.json()["media_count"] == 1

    content = await client.get(f"{MEDIA}/{media['id']}/content", headers=headers)
    assert content.status_code == 200
    assert content.content == PNG_1X1
    assert content.headers["content-type"] == "image/png"

    downloaded = await client.get(
        f"{MEDIA}/{media['id']}/content?download=true", headers=headers
    )
    assert "attachment" in downloaded.headers["content-disposition"]

    reviewer = await _headers(client, "reviewer@demo.railwayvision.example")
    reviewer_read = await client.get(f"{MEDIA}/{media['id']}/content", headers=reviewer)
    assert reviewer_read.status_code == 200


async def test_media_upload_rejects_checksum_mismatch_and_quarantines(media_env):
    client, storage, _, _ = media_env
    headers = await _headers(client, "inspector@demo.railwayvision.example")
    inspection_id = await _seed_inspection_id(client, headers)

    intent = await _intent(client, headers, inspection_id, sha="0" * 64)
    media = intent.json()
    tampered = PNG_1X1[:-1] + bytes([PNG_1X1[-1] ^ 0xFF])
    upload = await client.put(
        f"{MEDIA}/{media['id']}/content",
        headers={**headers, "Content-Type": "image/png"},
        content=tampered,
    )
    assert upload.status_code == 422, upload.text
    assert "checksum_mismatch" in upload.json()["error"]["message"]
    assert storage.quarantined

    listed = await client.get(f"{INS}/{inspection_id}/media", headers=headers)
    item = listed.json()["items"][0]
    assert item["status"] == "quarantined"
    assert item["quarantine_reason"] == "checksum_mismatch"

    blocked = await client.get(f"{MEDIA}/{media['id']}/content", headers=headers)
    assert blocked.status_code == 409

    admin = await _headers(client, "admin@demo.railwayvision.example")
    audit = await client.get(
        "/api/v1/audit-events?action=media.quarantined", headers=admin
    )
    assert audit.status_code == 200
    assert audit.json()["total"] == 1


async def test_upload_rejects_wrong_signature_and_size(media_env):
    client, storage, _, _ = media_env
    headers = await _headers(client, "inspector@demo.railwayvision.example")
    inspection_id = await _seed_inspection_id(client, headers)

    first = (await _intent(client, headers, inspection_id)).json()
    bad_type = await client.put(
        f"{MEDIA}/{first['id']}/content",
        headers={**headers, "Content-Type": "image/png"},
        content=JPEG_HEADER + b"\x00" * (len(PNG_1X1) - len(JPEG_HEADER)),
    )
    assert bad_type.status_code == 422
    assert "content_type_mismatch" in bad_type.json()["error"]["message"]

    second = (await _intent(client, headers, inspection_id)).json()
    short = await client.put(
        f"{MEDIA}/{second['id']}/content",
        headers={**headers, "Content-Type": "image/png"},
        content=PNG_1X1[:10],
    )
    assert short.status_code == 422
    assert "size_mismatch" in short.json()["error"]["message"]

    third = (await _intent(client, headers, inspection_id)).json()
    mismatch_header = await client.put(
        f"{MEDIA}/{third['id']}/content",
        headers={**headers, "Content-Type": "image/jpeg"},
        content=PNG_1X1,
    )
    assert mismatch_header.status_code == 422
    assert all(bucket == "railwayvision-quarantine" for bucket, _ in storage.objects)


async def test_upload_intent_validation(media_env):
    client, _, _, _ = media_env
    headers = await _headers(client, "inspector@demo.railwayvision.example")
    inspection_id = await _seed_inspection_id(client, headers)

    too_large = await _intent(client, headers, inspection_id, size=10_485_761)
    assert too_large.status_code == 413

    bad_hash = await _intent(client, headers, inspection_id, sha="not-a-hash")
    assert bad_hash.status_code == 422

    bad_type = await _intent(client, headers, inspection_id, content_type="image/gif")
    assert bad_type.status_code == 422


async def test_media_permissions_and_scope(media_env):
    client, _, _, _ = media_env
    inspector = await _headers(client, "inspector@demo.railwayvision.example")
    auditor = await _headers(client, "auditor@demo.railwayvision.example")
    admin = await _headers(client, "admin@demo.railwayvision.example")
    inspection_id = await _seed_inspection_id(client, inspector)

    denied = await _intent(client, auditor, inspection_id)
    assert denied.status_code == 403

    south_assets = await client.get(
        "/api/v1/assets?status=active", headers=admin
    )
    south_asset = next(
        item for item in south_assets.json()["items"] if item["code"] == "DEMO-AST-0003"
    )
    created = await client.post(
        INS,
        headers=admin,
        json={"asset_id": south_asset["id"], "notes": "cross-scope probe"},
    )
    assert created.status_code == 201
    south_inspection_id = created.json()["id"]

    hidden = await client.get(f"{INS}/{south_inspection_id}/media", headers=inspector)
    assert hidden.status_code == 404

    intent = await _intent(client, inspector, inspection_id)
    other_upload = await client.put(
        f"{MEDIA}/{intent.json()['id']}/content",
        headers={**auditor, "Content-Type": "image/png"},
        content=PNG_1X1,
    )
    assert other_upload.status_code == 403


async def test_ai_job_requires_ready_media_and_dedupes(media_env):
    client, _, queue, _ = media_env
    headers = await _headers(client, "inspector@demo.railwayvision.example")
    reviewer = await _headers(client, "reviewer@demo.railwayvision.example")
    auditor = await _headers(client, "auditor@demo.railwayvision.example")
    inspection_id = await _seed_inspection_id(client, headers)
    media = (await _intent(client, headers, inspection_id)).json()

    early = await client.post(
        f"{INS}/{inspection_id}/ai-jobs", headers=headers, json={"media_id": media["id"]}
    )
    assert early.status_code == 409

    await client.put(
        f"{MEDIA}/{media['id']}/content",
        headers={**headers, "Content-Type": "image/png"},
        content=PNG_1X1,
    )

    denied = await client.post(
        f"{INS}/{inspection_id}/ai-jobs", headers=reviewer, json={"media_id": media["id"]}
    )
    assert denied.status_code == 403

    created = await client.post(
        f"{INS}/{inspection_id}/ai-jobs", headers=headers, json={"media_id": media["id"]}
    )
    assert created.status_code == 201, created.text
    job = created.json()
    assert job["status"] == "queued"
    assert job["model"]["code"] == "demo-image-quality"
    assert queue.jobs == [job["id"]]

    duplicate = await client.post(
        f"{INS}/{inspection_id}/ai-jobs", headers=headers, json={"media_id": media["id"]}
    )
    assert duplicate.status_code == 409

    listed = await client.get(f"{INS}/{inspection_id}/ai-jobs", headers=auditor)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    detail = await client.get(f"{INS}/{inspection_id}", headers=headers)
    assert detail.json()["pending_detections"] == 1


async def test_model_registry_permissions(media_env):
    client, _, _, _ = media_env
    inspector = await _headers(client, "inspector@demo.railwayvision.example")
    reviewer = await _headers(client, "reviewer@demo.railwayvision.example")
    admin = await _headers(client, "admin@demo.railwayvision.example")

    listed = await client.get("/api/v1/models", headers=reviewer)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["is_demo"] is True

    denied = await client.post(
        "/api/v1/models",
        headers=inspector,
        json={"code": "demo-extra", "name": "Demo extra", "version": "0.1"},
    )
    assert denied.status_code == 403

    created = await client.post(
        "/api/v1/models",
        headers=admin,
        json={
            "code": "demo-extra",
            "name": "Demo extra",
            "version": "0.1",
            "description": "Registry test entry",
        },
    )
    assert created.status_code == 201, created.text

    duplicate = await client.post(
        "/api/v1/models",
        headers=admin,
        json={"code": "demo-extra", "name": "Demo extra", "version": "0.2"},
    )
    assert duplicate.status_code == 409
