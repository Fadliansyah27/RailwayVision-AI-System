import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, require_permission
from app.core.errors import AppError
from app.db.session import get_db
from app.models.checklists import ChecklistTemplate, ChecklistTemplateItem
from app.schemas.checklists import (
    ChecklistTemplateCreate,
    ChecklistTemplateItemOut,
    ChecklistTemplateOut,
    ChecklistTemplateUpdate,
)
from app.schemas.common import Page
from app.services.audit import record_audit

router = APIRouter(tags=["checklists"])


def _template_out(template: ChecklistTemplate) -> ChecklistTemplateOut:
    return ChecklistTemplateOut(
        id=template.id,
        code=template.code,
        name=template.name,
        inspection_type=template.inspection_type,
        version=template.version,
        is_active=template.is_active,
        items=[
            ChecklistTemplateItemOut(
                id=item.id,
                code=item.code,
                label=item.label,
                position=item.position,
                is_required=item.is_required,
            )
            for item in template.items
        ],
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


async def _deactivate_siblings(db: AsyncSession, inspection_type: str, keep_id: uuid.UUID) -> None:
    await db.execute(
        update(ChecklistTemplate)
        .where(
            ChecklistTemplate.inspection_type == inspection_type,
            ChecklistTemplate.is_active.is_(True),
            ChecklistTemplate.id != keep_id,
        )
        .values(is_active=False)
    )


@router.get("/master/checklist-templates", response_model=Page[ChecklistTemplateOut])
async def list_checklist_templates(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    inspection_type: str | None = Query(default=None, max_length=24),
    is_active: bool | None = Query(default=None),
    ctx: AuthContext = Depends(require_permission("inspections:read")),
    db: AsyncSession = Depends(get_db),
) -> Page[ChecklistTemplateOut]:
    conditions = []
    if inspection_type:
        conditions.append(ChecklistTemplate.inspection_type == inspection_type)
    if is_active is not None:
        conditions.append(ChecklistTemplate.is_active.is_(is_active))

    total = (
        await db.execute(select(func.count()).select_from(ChecklistTemplate).where(*conditions))
    ).scalar_one()
    templates = (
        (
            await db.execute(
                select(ChecklistTemplate)
                .where(*conditions)
                .order_by(
                    ChecklistTemplate.inspection_type,
                    ChecklistTemplate.version.desc(),
                    ChecklistTemplate.created_at.desc(),
                )
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return Page[ChecklistTemplateOut](
        items=[_template_out(template) for template in templates],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/master/checklist-templates",
    response_model=ChecklistTemplateOut,
    status_code=201,
)
async def create_checklist_template(
    payload: ChecklistTemplateCreate,
    ctx: AuthContext = Depends(require_permission("inspections:manage")),
    db: AsyncSession = Depends(get_db),
) -> ChecklistTemplateOut:
    code = payload.code.strip().upper()
    existing = (
        await db.execute(select(ChecklistTemplate).where(ChecklistTemplate.code == code))
    ).scalar_one_or_none()
    if existing is not None:
        raise AppError(409, "conflict", "Kode template checklist sudah digunakan.")

    template = ChecklistTemplate(
        code=code,
        name=payload.name.strip(),
        inspection_type=payload.inspection_type,
        version=1,
        is_active=payload.is_active,
        items=[
            ChecklistTemplateItem(
                code=item.code.strip().upper(),
                label=item.label.strip(),
                position=item.position,
                is_required=item.is_required,
            )
            for item in payload.items
        ],
    )
    db.add(template)
    await db.flush()
    if template.is_active:
        await _deactivate_siblings(db, template.inspection_type, template.id)
    await record_audit(
        db,
        action="checklist_template.created",
        actor=ctx.user,
        target_type="checklist_template",
        target_id=template.id,
        scope_id=ctx.user.scope_id,
        metadata={
            "code": template.code,
            "inspection_type": template.inspection_type,
            "items": len(template.items),
            "is_active": template.is_active,
        },
    )
    await db.commit()
    refreshed = (
        await db.execute(select(ChecklistTemplate).where(ChecklistTemplate.id == template.id))
    ).scalar_one()
    return _template_out(refreshed)


@router.patch(
    "/master/checklist-templates/{template_id}",
    response_model=ChecklistTemplateOut,
)
async def update_checklist_template(
    template_id: uuid.UUID,
    payload: ChecklistTemplateUpdate,
    ctx: AuthContext = Depends(require_permission("inspections:manage")),
    db: AsyncSession = Depends(get_db),
) -> ChecklistTemplateOut:
    template = (
        await db.execute(select(ChecklistTemplate).where(ChecklistTemplate.id == template_id))
    ).scalar_one_or_none()
    if template is None:
        raise AppError(404, "not_found", "Template checklist tidak ditemukan.")

    changed: list[str] = []
    if payload.name is not None:
        template.name = payload.name.strip()
        changed.append("name")
    if payload.is_active is not None and payload.is_active != template.is_active:
        template.is_active = payload.is_active
        changed.append("is_active")
        if payload.is_active:
            await _deactivate_siblings(db, template.inspection_type, template.id)
    if not changed:
        raise AppError(400, "bad_request", "Tidak ada perubahan yang dikirim.")

    await record_audit(
        db,
        action="checklist_template.updated",
        actor=ctx.user,
        target_type="checklist_template",
        target_id=template.id,
        scope_id=ctx.user.scope_id,
        metadata={"code": template.code, "fields": changed},
    )
    await db.commit()
    refreshed = (
        await db.execute(select(ChecklistTemplate).where(ChecklistTemplate.id == template.id))
    ).scalar_one()
    return _template_out(refreshed)
