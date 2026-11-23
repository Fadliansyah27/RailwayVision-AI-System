import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import AuthContext, require_any_permission, require_permission
from app.core.errors import AppError
from app.db.session import get_db
from app.models.identity import AuditEvent
from app.models.media import AIModel, Dataset
from app.schemas.datasets import DatasetCreate, DatasetOut, ReviewNotes
from app.schemas.media import AIModelOut
from app.services.access import user_brief
from app.services.audit import record_audit

router = APIRouter(tags=["ai-registry"])

READ_PERMISSIONS = ("models:manage", "audit:read")


def _now() -> datetime:
    return datetime.now(UTC)


async def _get_model(db: AsyncSession, model_id: uuid.UUID) -> AIModel:
    model = (
        await db.execute(select(AIModel).where(AIModel.id == model_id))
    ).scalar_one_or_none()
    if model is None:
        raise AppError(404, "not_found", "Model tidak ditemukan.")
    return model


def _model_out(model: AIModel) -> AIModelOut:
    return AIModelOut(
        id=model.id,
        code=model.code,
        name=model.name,
        version=model.version,
        family=model.family,
        modality=model.modality,
        description=model.description,
        is_demo=model.is_demo,
        status=model.status,
        approval_status=model.approval_status,
        dataset_version=model.dataset_version,
        checksum_sha256=model.checksum_sha256,
        class_names=model.class_names or [],
        training_config=model.training_config or {},
        evaluation_metrics=model.evaluation_metrics,
        evaluation_notes=model.evaluation_notes,
        known_limitations=model.known_limitations,
        approval_notes=model.approval_notes,
        approved_at=model.approved_at,
        deployed_at=model.deployed_at,
        retired_at=model.retired_at,
        created_at=model.created_at,
    )


async def _load_dataset(db: AsyncSession, dataset_id: uuid.UUID) -> Dataset:
    dataset = (
        await db.execute(
            select(Dataset)
            .options(selectinload(Dataset.approved_by))
            .where(Dataset.id == dataset_id)
        )
    ).scalar_one_or_none()
    if dataset is None:
        raise AppError(404, "not_found", "Dataset tidak ditemukan.")
    return dataset


def _dataset_out(dataset: Dataset) -> DatasetOut:
    return DatasetOut(
        id=dataset.id,
        code=dataset.code,
        name=dataset.name,
        version=dataset.version,
        source=dataset.source,
        license_note=dataset.license_note,
        description=dataset.description,
        class_names=dataset.class_names or [],
        image_count=dataset.image_count,
        split_train=dataset.split_train,
        split_validation=dataset.split_validation,
        split_test=dataset.split_test,
        status=dataset.status,
        approval_notes=dataset.approval_notes,
        approved_at=dataset.approved_at,
        approved_by=(
            user_brief(dataset.approved_by) if dataset.approved_by is not None else None
        ),
        created_at=dataset.created_at,
        updated_at=dataset.updated_at,
    )


@router.post("/models/{model_id}/submit", response_model=AIModelOut)
async def submit_model(
    model_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("models:manage")),
    db: AsyncSession = Depends(get_db),
) -> AIModelOut:
    model = await _get_model(db, model_id)
    if model.is_demo or model.approval_status == "demo_only":
        raise AppError(
            409,
            "conflict",
            "Model demonstrasi tidak mengikuti alur persetujuan penggunaan.",
        )
    if model.approval_status not in ("draft", "rejected"):
        raise AppError(
            409,
            "conflict",
            "Model ini sudah diajukan atau telah diputuskan.",
        )
    missing: list[str] = []
    if not model.checksum_sha256:
        missing.append("checksum SHA-256")
    if not model.dataset_version:
        missing.append("versi dataset")
    if not model.class_names:
        missing.append("pemetaan kelas")
    if missing:
        raise AppError(
            409,
            "conflict",
            "Kelengkapan model belum terpenuhi: " + ", ".join(missing) + ".",
        )

    model.approval_status = "pending_approval"
    model.approval_notes = ""
    await record_audit(
        db,
        action="model.submitted",
        actor=ctx.user,
        target_type="ai_model",
        target_id=model.id,
        metadata={"code": model.code, "version": model.version},
    )
    await db.commit()
    return _model_out(model)


@router.post("/models/{model_id}/approve", response_model=AIModelOut)
async def approve_model(
    model_id: uuid.UUID,
    payload: ReviewNotes,
    ctx: AuthContext = Depends(require_permission("models:manage")),
    db: AsyncSession = Depends(get_db),
) -> AIModelOut:
    model = await _get_model(db, model_id)
    if model.approval_status != "pending_approval":
        raise AppError(
            409, "conflict", "Hanya model yang menunggu persetujuan dapat disetujui."
        )
    if not model.evaluation_metrics:
        raise AppError(
            409,
            "conflict",
            "Model belum memiliki metrik evaluasi terekam; persetujuan ditolak.",
        )

    model.approval_status = "approved"
    model.approval_notes = payload.notes.strip()
    model.approved_at = _now()
    model.approved_by_id = ctx.user.id
    await record_audit(
        db,
        action="model.approved",
        actor=ctx.user,
        target_type="ai_model",
        target_id=model.id,
        metadata={
            "code": model.code,
            "version": model.version,
            "metrics": model.evaluation_metrics,
        },
    )
    await db.commit()
    return _model_out(model)


@router.post("/models/{model_id}/reject", response_model=AIModelOut)
async def reject_model(
    model_id: uuid.UUID,
    payload: ReviewNotes,
    ctx: AuthContext = Depends(require_permission("models:manage")),
    db: AsyncSession = Depends(get_db),
) -> AIModelOut:
    model = await _get_model(db, model_id)
    if model.approval_status != "pending_approval":
        raise AppError(
            409, "conflict", "Hanya model yang menunggu persetujuan dapat ditolak."
        )
    model.approval_status = "rejected"
    model.approval_notes = payload.notes.strip()
    await record_audit(
        db,
        action="model.rejected",
        actor=ctx.user,
        target_type="ai_model",
        target_id=model.id,
        metadata={"code": model.code, "version": model.version},
    )
    await db.commit()
    return _model_out(model)


@router.post("/models/{model_id}/deploy", response_model=AIModelOut)
async def deploy_model(
    model_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("models:manage")),
    db: AsyncSession = Depends(get_db),
) -> AIModelOut:
    model = await _get_model(db, model_id)
    if model.is_demo:
        raise AppError(
            409, "conflict", "Model demonstrasi tidak dapat diterapkan sebagai model operasional."
        )
    if model.approval_status != "approved":
        raise AppError(
            409, "conflict", "Model harus disetujui sebelum dapat diterapkan."
        )
    if model.status == "active":
        raise AppError(409, "conflict", "Model ini sudah aktif.")

    peers = (
        await db.execute(
            select(AIModel).where(
                AIModel.family == model.family,
                AIModel.id != model.id,
                AIModel.status == "active",
            )
        )
    ).scalars().all()
    previous = [f"{peer.code}:{peer.version}" for peer in peers]
    for peer in peers:
        peer.status = "retired"
        peer.retired_at = _now()

    model.status = "active"
    model.deployed_at = _now()
    model.retired_at = None
    await record_audit(
        db,
        action="model.deployed",
        actor=ctx.user,
        target_type="ai_model",
        target_id=model.id,
        metadata={
            "code": model.code,
            "version": model.version,
            "family": model.family,
            "replaced": previous,
        },
    )
    await db.commit()
    return _model_out(model)


@router.post("/models/{model_id}/retire", response_model=AIModelOut)
async def retire_model(
    model_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("models:manage")),
    db: AsyncSession = Depends(get_db),
) -> AIModelOut:
    model = await _get_model(db, model_id)
    if model.is_demo:
        raise AppError(
            409, "conflict", "Model demonstrasi dikelola otomatis dan tidak dapat dipensiunkan."
        )
    if model.status != "active":
        raise AppError(409, "conflict", "Hanya model aktif yang dapat dipensiunkan.")
    model.status = "retired"
    model.retired_at = _now()
    await record_audit(
        db,
        action="model.retired",
        actor=ctx.user,
        target_type="ai_model",
        target_id=model.id,
        metadata={"code": model.code, "version": model.version},
    )
    await db.commit()
    return _model_out(model)


@router.get("/models/{model_id}/history")
async def model_history(
    model_id: uuid.UUID,
    ctx: AuthContext = Depends(require_any_permission(*READ_PERMISSIONS)),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    await _get_model(db, model_id)
    events = (
        await db.execute(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "ai_model",
                AuditEvent.target_id == str(model_id),
            )
            .order_by(AuditEvent.created_at.desc())
            .limit(50)
        )
    ).scalars().all()
    return [
        {
            "id": str(event.id),
            "action": event.action,
            "actor_label": event.actor_label,
            "outcome": event.outcome,
            "event_metadata": event.event_metadata,
            "created_at": event.created_at.isoformat(),
        }
        for event in events
    ]


@router.get("/datasets", response_model=list[DatasetOut])
async def list_datasets(
    ctx: AuthContext = Depends(require_any_permission(*READ_PERMISSIONS)),
    db: AsyncSession = Depends(get_db),
) -> list[DatasetOut]:
    datasets = (
        await db.execute(
            select(Dataset)
            .options(selectinload(Dataset.approved_by))
            .order_by(Dataset.created_at.desc())
        )
    ).scalars().all()
    return [_dataset_out(dataset) for dataset in datasets]


@router.post("/datasets", response_model=DatasetOut, status_code=201)
async def create_dataset(
    payload: DatasetCreate,
    ctx: AuthContext = Depends(require_permission("models:manage")),
    db: AsyncSession = Depends(get_db),
) -> DatasetOut:
    duplicate = (
        await db.execute(select(Dataset.id).where(Dataset.code == payload.code))
    ).scalar_one_or_none()
    if duplicate is not None:
        raise AppError(409, "conflict", "Dataset dengan kode ini sudah ada.")
    split_total = payload.split_train + payload.split_validation + payload.split_test
    if payload.image_count and split_total > payload.image_count:
        raise AppError(
            422,
            "validation_error",
            "Jumlah pembagian dataset melebihi jumlah gambar.",
        )

    dataset = Dataset(
        code=payload.code,
        name=payload.name.strip(),
        version=payload.version.strip(),
        source=payload.source.strip(),
        license_note=payload.license_note.strip(),
        description=payload.description.strip(),
        class_names=payload.class_names,
        image_count=payload.image_count,
        split_train=payload.split_train,
        split_validation=payload.split_validation,
        split_test=payload.split_test,
        status="draft",
    )
    db.add(dataset)
    await db.flush()
    await record_audit(
        db,
        action="dataset.created",
        actor=ctx.user,
        target_type="dataset",
        target_id=dataset.id,
        metadata={"code": dataset.code, "version": dataset.version},
    )
    await db.commit()
    return _dataset_out(await _load_dataset(db, dataset.id))


@router.post("/datasets/{dataset_id}/submit", response_model=DatasetOut)
async def submit_dataset(
    dataset_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("models:manage")),
    db: AsyncSession = Depends(get_db),
) -> DatasetOut:
    dataset = await _load_dataset(db, dataset_id)
    if dataset.status not in ("draft", "rejected"):
        raise AppError(409, "conflict", "Dataset ini sudah diajukan atau diputuskan.")
    missing: list[str] = []
    if not dataset.source:
        missing.append("sumber data")
    if not dataset.license_note:
        missing.append("izin penggunaan")
    if not dataset.class_names:
        missing.append("pemetaan kelas")
    if missing:
        raise AppError(
            409,
            "conflict",
            "Kelengkapan dataset belum terpenuhi: " + ", ".join(missing) + ".",
        )
    dataset.status = "pending_approval"
    dataset.approval_notes = ""
    await record_audit(
        db,
        action="dataset.submitted",
        actor=ctx.user,
        target_type="dataset",
        target_id=dataset.id,
        metadata={"code": dataset.code, "version": dataset.version},
    )
    await db.commit()
    return _dataset_out(await _load_dataset(db, dataset.id))


@router.post("/datasets/{dataset_id}/approve", response_model=DatasetOut)
async def approve_dataset(
    dataset_id: uuid.UUID,
    payload: ReviewNotes,
    ctx: AuthContext = Depends(require_permission("models:manage")),
    db: AsyncSession = Depends(get_db),
) -> DatasetOut:
    dataset = await _load_dataset(db, dataset_id)
    if dataset.status != "pending_approval":
        raise AppError(
            409, "conflict", "Hanya dataset yang menunggu persetujuan dapat disetujui."
        )
    dataset.status = "approved"
    dataset.approval_notes = payload.notes.strip()
    dataset.approved_at = _now()
    dataset.approved_by_id = ctx.user.id
    dataset.approved_by = ctx.user
    await record_audit(
        db,
        action="dataset.approved",
        actor=ctx.user,
        target_type="dataset",
        target_id=dataset.id,
        metadata={"code": dataset.code, "version": dataset.version},
    )
    await db.commit()
    return _dataset_out(await _load_dataset(db, dataset.id))


@router.post("/datasets/{dataset_id}/reject", response_model=DatasetOut)
async def reject_dataset(
    dataset_id: uuid.UUID,
    payload: ReviewNotes,
    ctx: AuthContext = Depends(require_permission("models:manage")),
    db: AsyncSession = Depends(get_db),
) -> DatasetOut:
    dataset = await _load_dataset(db, dataset_id)
    if dataset.status != "pending_approval":
        raise AppError(
            409, "conflict", "Hanya dataset yang menunggu persetujuan dapat ditolak."
        )
    dataset.status = "rejected"
    dataset.approval_notes = payload.notes.strip()
    await record_audit(
        db,
        action="dataset.rejected",
        actor=ctx.user,
        target_type="dataset",
        target_id=dataset.id,
        metadata={"code": dataset.code, "version": dataset.version},
    )
    await db.commit()
    return _dataset_out(await _load_dataset(db, dataset.id))
