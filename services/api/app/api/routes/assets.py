import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, require_permission
from app.core.errors import AppError
from app.db.session import get_db
from app.models.assets import Asset, AssetCategory, Location
from app.models.identity import Scope
from app.models.inspections import Inspection
from app.schemas.assets import (
    AssetCreate,
    AssetDetail,
    AssetOut,
    AssetSummaryOut,
    AssetUpdate,
    CategoryCreate,
    CategoryUpdate,
    LocationCreate,
    LocationUpdate,
)
from app.schemas.common import CategoryOut, LocationOut, Page, ScopeOut
from app.services.access import accessible_scope_condition
from app.services.audit import record_audit

router = APIRouter(tags=["assets"])


def _asset_out(asset: Asset) -> AssetOut:
    return AssetOut(
        id=asset.id,
        code=asset.code,
        name=asset.name,
        description=asset.description,
        status=asset.status,
        category=CategoryOut.model_validate(asset.category),
        location=LocationOut.model_validate(asset.location) if asset.location else None,
        scope=ScopeOut.model_validate(asset.scope),
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


async def _get_accessible_asset(
    db: AsyncSession, ctx: AuthContext, asset_id: uuid.UUID
) -> Asset:
    stmt = (
        select(Asset)
        .join(Scope, Asset.scope_id == Scope.id)
        .where(Asset.id == asset_id, accessible_scope_condition(ctx.scope_path))
    )
    asset = (await db.execute(stmt)).scalar_one_or_none()
    if asset is None:
        raise AppError(404, "not_found", "Aset tidak ditemukan.")
    return asset


async def _resolve_location(
    db: AsyncSession, ctx: AuthContext, location_id: uuid.UUID | None
) -> Location | None:
    if location_id is None:
        return None
    stmt = (
        select(Location)
        .join(Scope, Location.scope_id == Scope.id)
        .where(Location.id == location_id, accessible_scope_condition(ctx.scope_path))
    )
    location = (await db.execute(stmt)).scalar_one_or_none()
    if location is None:
        raise AppError(422, "validation_error", "Lokasi tidak tersedia dalam cakupan Anda.")
    return location


async def _resolve_category(
    db: AsyncSession, category_id: uuid.UUID
) -> AssetCategory:
    category = await db.get(AssetCategory, category_id)
    if category is None:
        raise AppError(422, "validation_error", "Kategori aset tidak dikenal.")
    return category


@router.get("/asset-categories", response_model=list[CategoryOut])
async def list_categories(
    ctx: AuthContext = Depends(require_permission("assets:read")),
    db: AsyncSession = Depends(get_db),
) -> list[CategoryOut]:
    categories = (
        await db.execute(select(AssetCategory).order_by(AssetCategory.name.asc()))
    ).scalars().all()
    return [CategoryOut.model_validate(category) for category in categories]


@router.get("/locations", response_model=list[LocationOut])
async def list_locations(
    ctx: AuthContext = Depends(require_permission("assets:read")),
    db: AsyncSession = Depends(get_db),
) -> list[LocationOut]:
    stmt = (
        select(Location)
        .join(Scope, Location.scope_id == Scope.id)
        .where(accessible_scope_condition(ctx.scope_path))
        .order_by(Location.name.asc())
    )
    locations = (await db.execute(stmt)).scalars().all()
    return [LocationOut.model_validate(location) for location in locations]


@router.post("/asset-categories", response_model=CategoryOut, status_code=201)
async def create_category(
    payload: CategoryCreate,
    ctx: AuthContext = Depends(require_permission("assets:write")),
    db: AsyncSession = Depends(get_db),
) -> CategoryOut:
    code = payload.code.upper()
    if await db.scalar(select(AssetCategory.id).where(AssetCategory.code == code)) is not None:
        raise AppError(409, "conflict", "Kategori aset dengan kode ini sudah ada.")
    category = AssetCategory(code=code, name=payload.name.strip())
    db.add(category)
    await db.flush()
    await record_audit(
        db,
        action="asset_category.created",
        actor=ctx.user,
        target_type="asset_category",
        target_id=category.id,
        metadata={"code": code},
    )
    await db.commit()
    return CategoryOut.model_validate(category)


@router.patch("/asset-categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    ctx: AuthContext = Depends(require_permission("assets:write")),
    db: AsyncSession = Depends(get_db),
) -> CategoryOut:
    category = await db.get(AssetCategory, category_id)
    if category is None:
        raise AppError(404, "not_found", "Kategori aset tidak ditemukan.")
    category.name = payload.name.strip()
    await record_audit(
        db,
        action="asset_category.updated",
        actor=ctx.user,
        target_type="asset_category",
        target_id=category.id,
        metadata={"code": category.code},
    )
    await db.commit()
    return CategoryOut.model_validate(category)


@router.post("/locations", response_model=LocationOut, status_code=201)
async def create_location(
    payload: LocationCreate,
    ctx: AuthContext = Depends(require_permission("assets:write")),
    db: AsyncSession = Depends(get_db),
) -> LocationOut:
    scope = (
        await db.execute(
            select(Scope)
            .where(
                Scope.id == payload.scope_id,
                accessible_scope_condition(ctx.scope_path),
            )
        )
    ).scalar_one_or_none()
    if scope is None:
        raise AppError(422, "validation_error", "Cakupan tidak tersedia untuk akun Anda.")

    code = payload.code.upper()
    if await db.scalar(select(Location.id).where(Location.code == code)) is not None:
        raise AppError(409, "conflict", "Lokasi dengan kode ini sudah ada.")
    location = Location(
        code=code,
        name=payload.name.strip(),
        scope_id=scope.id,
        description=payload.description.strip(),
    )
    db.add(location)
    await db.flush()
    await record_audit(
        db,
        action="location.created",
        actor=ctx.user,
        target_type="location",
        target_id=location.id,
        scope_id=scope.id,
        metadata={"code": code},
    )
    await db.commit()
    return LocationOut.model_validate(location)


@router.patch("/locations/{location_id}", response_model=LocationOut)
async def update_location(
    location_id: uuid.UUID,
    payload: LocationUpdate,
    ctx: AuthContext = Depends(require_permission("assets:write")),
    db: AsyncSession = Depends(get_db),
) -> LocationOut:
    location = (
        await db.execute(
            select(Location)
            .join(Scope, Location.scope_id == Scope.id)
            .where(
                Location.id == location_id,
                accessible_scope_condition(ctx.scope_path),
            )
        )
    ).scalar_one_or_none()
    if location is None:
        raise AppError(404, "not_found", "Lokasi tidak ditemukan.")
    if payload.name is not None:
        location.name = payload.name.strip()
    if payload.description is not None:
        location.description = payload.description.strip()
    await record_audit(
        db,
        action="location.updated",
        actor=ctx.user,
        target_type="location",
        target_id=location.id,
        scope_id=location.scope_id,
        metadata={"code": location.code},
    )
    await db.commit()
    return LocationOut.model_validate(location)


@router.get("/assets", response_model=Page[AssetOut])
async def list_assets(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    status: str | None = Query(default=None, max_length=24),
    category_id: uuid.UUID | None = Query(default=None),
    location_id: uuid.UUID | None = Query(default=None),
    ctx: AuthContext = Depends(require_permission("assets:read")),
    db: AsyncSession = Depends(get_db),
) -> Page[AssetOut]:
    conditions = [accessible_scope_condition(ctx.scope_path)]
    if search:
        term = f"%{search.strip()}%"
        conditions.append(or_(Asset.code.ilike(term), Asset.name.ilike(term)))
    if status:
        conditions.append(Asset.status == status)
    if category_id is not None:
        conditions.append(Asset.category_id == category_id)
    if location_id is not None:
        conditions.append(Asset.location_id == location_id)

    total = (
        await db.execute(
            select(func.count())
            .select_from(Asset)
            .join(Scope, Asset.scope_id == Scope.id)
            .where(*conditions)
        )
    ).scalar_one()

    stmt = (
        select(Asset)
        .join(Scope, Asset.scope_id == Scope.id)
        .where(*conditions)
        .order_by(Asset.code.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    assets = (await db.execute(stmt)).scalars().all()
    return Page[AssetOut](
        items=[_asset_out(asset) for asset in assets],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/assets", response_model=AssetOut, status_code=201)
async def create_asset(
    payload: AssetCreate,
    ctx: AuthContext = Depends(require_permission("assets:write")),
    db: AsyncSession = Depends(get_db),
) -> AssetOut:
    code = payload.code.upper()
    if await db.scalar(select(Asset.id).where(Asset.code == code)) is not None:
        raise AppError(409, "conflict", "Aset dengan kode ini sudah ada.")

    category = await _resolve_category(db, payload.category_id)
    location = await _resolve_location(db, ctx, payload.location_id)
    asset = Asset(
        code=code,
        name=payload.name.strip(),
        description=payload.description.strip(),
        status=payload.status,
        category_id=category.id,
        location_id=location.id if location else None,
        scope_id=location.scope_id if location else ctx.user.scope_id,
    )
    db.add(asset)
    await db.flush()
    await record_audit(
        db,
        action="asset.created",
        actor=ctx.user,
        target_type="asset",
        target_id=asset.id,
        scope_id=asset.scope_id,
        metadata={"code": code},
    )
    await db.commit()
    return _asset_out(await _get_accessible_asset(db, ctx, asset.id))


@router.get("/assets/summary", response_model=AssetSummaryOut)
async def assets_summary(
    ctx: AuthContext = Depends(require_permission("assets:read")),
    db: AsyncSession = Depends(get_db),
) -> AssetSummaryOut:
    rows = (
        await db.execute(
            select(Asset.status, func.count())
            .join(Scope, Asset.scope_id == Scope.id)
            .where(accessible_scope_condition(ctx.scope_path))
            .group_by(Asset.status)
        )
    ).all()
    counts = {status: 0 for status in ("active", "out_of_service", "retired")}
    for status, count in rows:
        counts[status] = counts.get(status, 0) + count
    return AssetSummaryOut(
        total=sum(counts.values()),
        active=counts["active"],
        out_of_service=counts["out_of_service"],
        retired=counts["retired"],
    )


@router.get("/assets/{asset_id}", response_model=AssetDetail)
async def get_asset(
    asset_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("assets:read")),
    db: AsyncSession = Depends(get_db),
) -> AssetDetail:
    asset = await _get_accessible_asset(db, ctx, asset_id)
    inspection_stmt = (
        select(Inspection)
        .join(Scope, Inspection.scope_id == Scope.id)
        .where(
            Inspection.asset_id == asset.id,
            accessible_scope_condition(ctx.scope_path),
        )
        .order_by(Inspection.inspected_at.desc())
        .limit(20)
    )
    inspections = (await db.execute(inspection_stmt)).scalars().all()
    base = _asset_out(asset)
    return AssetDetail(
        **base.model_dump(),
        inspections=[
            {
                "id": inspection.id,
                "reference": inspection.reference,
                "status": inspection.status,
                "inspected_at": inspection.inspected_at,
            }
            for inspection in inspections
        ],
        latest_inspection=(
            {
                "id": inspections[0].id,
                "reference": inspections[0].reference,
                "status": inspections[0].status,
                "inspected_at": inspections[0].inspected_at,
            }
            if inspections
            else None
        ),
    )


@router.patch("/assets/{asset_id}", response_model=AssetOut)
async def update_asset(
    asset_id: uuid.UUID,
    payload: AssetUpdate,
    ctx: AuthContext = Depends(require_permission("assets:write")),
    db: AsyncSession = Depends(get_db),
) -> AssetOut:
    asset = await _get_accessible_asset(db, ctx, asset_id)
    changed: list[str] = []

    if payload.name is not None:
        asset.name = payload.name.strip()
        changed.append("name")
    if payload.description is not None:
        asset.description = payload.description.strip()
        changed.append("description")
    if payload.category_id is not None:
        category = await _resolve_category(db, payload.category_id)
        asset.category_id = category.id
        changed.append("category_id")
    if "location_id" in payload.model_fields_set:
        location = await _resolve_location(db, ctx, payload.location_id)
        asset.location_id = location.id if location else None
        if location is not None:
            asset.scope_id = location.scope_id
        changed.append("location_id")
    if payload.status is not None:
        asset.status = payload.status
        changed.append("status")

    await record_audit(
        db,
        action="asset.updated",
        actor=ctx.user,
        target_type="asset",
        target_id=asset.id,
        scope_id=asset.scope_id,
        metadata={"fields": changed},
    )
    await db.commit()
    return _asset_out(await _get_accessible_asset(db, ctx, asset.id))
