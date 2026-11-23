import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models.checklists import ChecklistTemplate, InspectionChecklistResult
from app.models.inspections import Inspection
from app.schemas.inspections import (
    InspectionChecklistItemOut,
    InspectionChecklistOut,
)
from app.services.access import user_brief


async def find_active_template(db: AsyncSession, inspection_type: str) -> ChecklistTemplate | None:
    stmt = (
        select(ChecklistTemplate)
        .where(
            ChecklistTemplate.inspection_type == inspection_type,
            ChecklistTemplate.is_active.is_(True),
        )
        .order_by(ChecklistTemplate.version.desc(), ChecklistTemplate.created_at.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def snapshot_checklist(
    db: AsyncSession,
    inspection: Inspection,
    template: ChecklistTemplate | None = None,
) -> int:
    if template is None:
        template = await find_active_template(db, inspection.inspection_type)
    if template is None:
        return 0
    db.add_all(
        [
            InspectionChecklistResult(
                inspection_id=inspection.id,
                template_id=template.id,
                item_code=item.code,
                item_label=item.label,
                position=item.position,
                is_required=item.is_required,
            )
            for item in template.items
        ]
    )
    return len(template.items)


async def replace_checklist_snapshot(db: AsyncSession, inspection: Inspection) -> int:
    rows = (
        (
            await db.execute(
                select(InspectionChecklistResult).where(
                    InspectionChecklistResult.inspection_id == inspection.id
                )
            )
        )
        .scalars()
        .all()
    )
    if any(row.result is not None or row.notes.strip() for row in rows):
        raise AppError(
            409,
            "conflict",
            "Jenis inspeksi tidak dapat diubah karena checklist sudah memiliki jawaban.",
        )
    if rows:
        await db.execute(
            delete(InspectionChecklistResult).where(
                InspectionChecklistResult.inspection_id == inspection.id
            )
        )
    return await snapshot_checklist(db, inspection)


async def load_checklist_results(
    db: AsyncSession, inspection_id: uuid.UUID
) -> list[InspectionChecklistResult]:
    stmt = (
        select(InspectionChecklistResult)
        .where(InspectionChecklistResult.inspection_id == inspection_id)
        .order_by(InspectionChecklistResult.position)
    )
    return list((await db.execute(stmt)).scalars().all())


async def checklist_for_inspection(
    db: AsyncSession, inspection_id: uuid.UUID
) -> InspectionChecklistOut | None:
    rows = await load_checklist_results(db, inspection_id)
    if not rows:
        return None
    template = (
        await db.execute(
            select(ChecklistTemplate).where(ChecklistTemplate.id == rows[0].template_id)
        )
    ).scalar_one_or_none()
    answered = sum(1 for row in rows if row.result is not None)
    required_unanswered = sum(1 for row in rows if row.is_required and row.result is None)
    return InspectionChecklistOut(
        template_id=template.id if template else None,
        template_code=template.code if template else None,
        template_name=template.name if template else None,
        template_version=template.version if template else None,
        total=len(rows),
        required_total=sum(1 for row in rows if row.is_required),
        answered=answered,
        required_unanswered=required_unanswered,
        items=[
            InspectionChecklistItemOut(
                item_code=row.item_code,
                item_label=row.item_label,
                position=row.position,
                is_required=row.is_required,
                result=row.result,
                notes=row.notes,
                recorded_by=user_brief(row.recorded_by) if row.recorded_by else None,
                updated_at=row.updated_at,
            )
            for row in rows
        ],
    )


async def ensure_checklist_complete(db: AsyncSession, inspection_id: uuid.UUID) -> None:
    rows = await load_checklist_results(db, inspection_id)
    missing = [row for row in rows if row.is_required and row.result is None]
    if missing:
        raise AppError(
            422,
            "checklist_incomplete",
            f"Lengkapi {len(missing)} item checklist wajib sebelum mengirim inspeksi.",
        )
