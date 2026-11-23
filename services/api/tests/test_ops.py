import json
import logging
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.models.assets import Asset, Location
from app.models.identity import AuditEvent, Scope, User
from app.models.inspections import Inspection
from app.models.media import AIJob, AIModel, MediaObject
from app.seed import seed_ai_registry, seed_demo_content, seed_rbac
from tests.conftest import FakeRedis, auth_headers

PASSWORD = "Test-Demo-Password-2026"
OPS = "/api/v1/ops"


@pytest.fixture
async def ops_env(api_app):
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async with session_factory() as session:
        scopes = await seed_rbac(session)
        await seed_ai_registry(session)
        await seed_demo_content(session, scopes)
        await session.commit()

    api_app.dependency_overrides[get_db] = override_get_db
    api_app.state.redis = FakeRedis()
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client, session_factory

    api_app.dependency_overrides.clear()
    await engine.dispose()


async def _add_ai_job(session_factory, scope_code: str, reference: str) -> uuid.UUID:
    async with session_factory() as session:
        scope = (
            await session.execute(select(Scope).where(Scope.code == scope_code))
        ).scalar_one()
        asset = (
            await session.execute(select(Asset).where(Asset.scope_id == scope.id))
        ).scalars().first()
        requester = (
            await session.execute(
                select(User).where(User.email == "admin@demo.railwayvision.example")
            )
        ).scalar_one()
        inspection = Inspection(
            reference=reference,
            status="submitted",
            inspected_at=datetime.now(UTC),
            asset_id=asset.id,
            inspector_id=requester.id,
            scope_id=scope.id,
        )
        session.add(inspection)
        await session.flush()
        model = (
            await session.execute(
                select(AIModel).where(AIModel.code == "demo-image-quality")
            )
        ).scalar_one()
        media = MediaObject(
            filename=f"{reference}.png",
            content_type="image/png",
            size_bytes=128,
            status="ready",
            bucket="railwayvision-media",
            object_key=f"probe/{uuid.uuid4()}.png",
            inspection_id=inspection.id,
            scope_id=scope.id,
            uploaded_by_id=requester.id,
        )
        session.add(media)
        await session.flush()
        job = AIJob(
            status="succeeded",
            inspection_id=inspection.id,
            media_id=media.id,
            model_id=model.id,
            requested_by_id=requester.id,
        )
        session.add(job)
        await session.commit()
        return job.id


async def test_ops_permissions_and_log_redaction(ops_env):
    client, _ = ops_env
    admin = await auth_headers(client, "admin@demo.railwayvision.example")
    auditor = await auth_headers(client, "auditor@demo.railwayvision.example")
    inspector = await auth_headers(client, "inspector@demo.railwayvision.example")

    for path in ("/logs", "/deployments", "/backup", "/demo-reset/preview"):
        assert (await client.get(f"{OPS}{path}", headers=inspector)).status_code == 403
    assert (await client.get(f"{OPS}/ai-jobs", headers=inspector)).status_code == 200
    assert (await client.get(f"{OPS}/logs", headers=auditor)).status_code == 200
    assert (await client.get(f"{OPS}/logs", headers=admin)).status_code == 200

    logging.getLogger("railwayvision.test").warning(
        "credential probe password=SuperSecret123 Authorization: Bearer abc.def.ghi",
        extra={"event": "probe"},
    )
    response = await client.get(f"{OPS}/logs?search=credential", headers=admin)
    assert response.status_code == 200, response.text
    page = response.json()
    assert page["items"]
    text = str(page["items"])
    assert "SuperSecret123" not in text
    assert "abc.def.ghi" not in text
    assert "[REDACTED]" in text
    assert page["capacity"] >= page["retained"]

    invalid_level = await client.get(f"{OPS}/logs?level=NOPE", headers=admin)
    assert invalid_level.status_code == 422
    invalid_status = await client.get(f"{OPS}/ai-jobs?status=nope", headers=admin)
    assert invalid_status.status_code == 422


async def test_ai_job_history_is_scope_filtered(ops_env):
    client, session_factory = ops_env
    north_job = await _add_ai_job(session_factory, "DEMO-NORTH", "PROBE-NORTH-1")
    await _add_ai_job(session_factory, "DEMO-SOUTH", "PROBE-SOUTH-1")

    admin = await auth_headers(client, "admin@demo.railwayvision.example")
    inspector = await auth_headers(client, "inspector@demo.railwayvision.example")

    all_jobs = await client.get(f"{OPS}/ai-jobs?page_size=50", headers=admin)
    assert all_jobs.status_code == 200, all_jobs.text
    assert all_jobs.json()["total"] == 2

    own_scope = await client.get(f"{OPS}/ai-jobs?page_size=50", headers=inspector)
    assert own_scope.status_code == 200
    payload = own_scope.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == str(north_job)
    assert payload["items"][0]["inspection_reference"] == "PROBE-NORTH-1"
    assert payload["items"][0]["requested_by"]["full_name"]


async def test_deployment_history_records_real_operator(ops_env):
    client, session_factory = ops_env
    admin = await auth_headers(client, "admin@demo.railwayvision.example")
    inspector = await auth_headers(client, "inspector@demo.railwayvision.example")

    denied = await client.post(
        f"{OPS}/deployments",
        headers=inspector,
        json={"version": "0.8.0", "environment": "test"},
    )
    assert denied.status_code == 403

    created = await client.post(
        f"{OPS}/deployments",
        headers=admin,
        json={
            "version": "0.8.0",
            "environment": "test",
            "commit_sha": "abcdef1234567",
            "notes": "Rilis konsol operasi",
        },
    )
    assert created.status_code == 201, created.text
    record = created.json()
    assert record["recorded_by"] == "admin@demo.railwayvision.example"
    assert record["commit_sha"] == "abcdef1234567"

    wrong_env = await client.post(
        f"{OPS}/deployments",
        headers=admin,
        json={"version": "0.8.1", "environment": "production"},
    )
    assert wrong_env.status_code == 422

    listed = await client.get(f"{OPS}/deployments", headers=admin)
    assert listed.status_code == 200
    assert listed.json()[0]["version"] == "0.8.0"

    async with session_factory() as session:
        audit = (
            await session.execute(
                select(AuditEvent).where(AuditEvent.action == "deployment.recorded")
            )
        ).scalar_one()
        assert audit.event_metadata["version"] == "0.8.0"


async def test_backup_status_never_infers_health(ops_env, tmp_path, monkeypatch):
    client, _ = ops_env
    admin = await auth_headers(client, "admin@demo.railwayvision.example")
    settings = get_settings()
    original = settings.backup_status_file
    monkeypatch.setattr(settings, "backup_status_file", None)

    unconfigured = await client.get(f"{OPS}/backup", headers=admin)
    assert unconfigured.status_code == 200
    assert unconfigured.json()["status"] == "not_configured"
    assert unconfigured.json()["configured"] is False

    missing = tmp_path / "missing.json"
    monkeypatch.setattr(settings, "backup_status_file", str(missing))
    unavailable = await client.get(f"{OPS}/backup", headers=admin)
    assert unavailable.json()["status"] == "unavailable"

    status_file = tmp_path / "backup-status.json"
    monkeypatch.setattr(settings, "backup_status_file", str(status_file))
    status_file.write_text("{not json", encoding="utf-8")
    invalid = await client.get(f"{OPS}/backup", headers=admin)
    assert invalid.json()["status"] == "invalid"

    status_file.write_text(
        json.dumps(
            {
                "last_backup_at": (datetime.now(UTC) - timedelta(hours=30)).isoformat(),
                "size_bytes": 1024,
                "checksum_sha256": "a" * 64,
            }
        ),
        encoding="utf-8",
    )
    stale = await client.get(f"{OPS}/backup", headers=admin)
    assert stale.json()["status"] == "stale"
    assert stale.json()["configured"] is True

    status_file.write_text(
        json.dumps(
            {
                "last_backup_at": (datetime.now(UTC) - timedelta(hours=1)).isoformat(),
                "size_bytes": 2048,
                "checksum_sha256": "b" * 64,
                "last_restore_test_at": (
                    datetime.now(UTC) - timedelta(hours=2)
                ).isoformat(),
            }
        ),
        encoding="utf-8",
    )
    healthy = await client.get(f"{OPS}/backup", headers=admin)
    body = healthy.json()
    assert body["status"] == "ok"
    assert body["size_bytes"] == 2048
    assert body["checksum_sha256"] == "b" * 64

    monkeypatch.setattr(settings, "backup_status_file", original)


async def test_demo_reset_requires_phrase_and_deletes_only_synthetic_rows(ops_env):
    client, session_factory = ops_env
    admin = await auth_headers(client, "admin@demo.railwayvision.example")
    inspector = await auth_headers(client, "inspector@demo.railwayvision.example")

    preview = await client.get(f"{OPS}/demo-reset/preview", headers=admin)
    assert preview.status_code == 200
    plan = preview.json()
    assert plan["enabled"] is True
    assert plan["scope_codes"] == ["DEMO-KCIC", "DEMO-NORTH", "DEMO-SOUTH"]
    assert plan["counts"]["inspections"] == 1
    assert plan["counts"]["assets"] == 3
    assert plan["counts"]["locations"] == 2
    assert plan["total"] > 0

    denied = await client.post(
        f"{OPS}/demo-reset", headers=inspector, json={"confirm": "RESET DATA DEMO"}
    )
    assert denied.status_code == 403

    wrong = await client.post(
        f"{OPS}/demo-reset", headers=admin, json={"confirm": "hapus"}
    )
    assert wrong.status_code == 422

    reset = await client.post(
        f"{OPS}/demo-reset", headers=admin, json={"confirm": "RESET DATA DEMO"}
    )
    assert reset.status_code == 200, reset.text
    result = reset.json()
    assert result["total"] == plan["total"]
    assert result["storage_cleanup"] == "not_needed"

    async with session_factory() as session:
        for model in (Inspection, Asset, Location):
            count = (
                await session.execute(select(func.count()).select_from(model))
            ).scalar_one()
            assert count == 0
        audit = (
            await session.execute(
                select(func.count())
                .select_from(AuditEvent)
                .where(AuditEvent.action == "demo_data.reset")
            )
        ).scalar_one()
        assert audit == 1

    again = await client.get(f"{OPS}/demo-reset/preview", headers=admin)
    assert again.json()["total"] == 0
