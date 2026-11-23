import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.rbac import ALL_PERMISSIONS, ROLE_DEFINITIONS, RoleCode
from app.db.session import SessionLocal
from app.models.assets import Asset, AssetCategory, Location
from app.models.identity import Permission, Role, Scope, User
from app.models.inspections import Inspection
from app.models.media import AIModel
from app.services.security import hash_password

logger = logging.getLogger("railwayvision.seed")

DEMO_PASSWORD_ENV = "DEMO_SEED_PASSWORD"

DEMO_USERS: tuple[tuple[str, str, str, tuple[str, ...]], ...] = (
    (
        "admin@demo.railwayvision.example",
        "DEMO Administrator",
        "DEMO-KCIC",
        (RoleCode.ADMINISTRATOR,),
    ),
    ("inspector@demo.railwayvision.example", "DEMO Inspector", "DEMO-NORTH", (RoleCode.INSPECTOR,)),
    ("reviewer@demo.railwayvision.example", "DEMO Reviewer", "DEMO-NORTH", (RoleCode.REVIEWER,)),
    (
        "supervisor@demo.railwayvision.example",
        "DEMO Supervisor",
        "DEMO-KCIC",
        (RoleCode.SUPERVISOR,),
    ),
    ("ai@demo.railwayvision.example", "DEMO AI Engineer", "DEMO-KCIC", (RoleCode.AI_ML_ENGINEER,)),
    ("auditor@demo.railwayvision.example", "DEMO Auditor", "DEMO-KCIC", (RoleCode.AUDITOR,)),
)

SCOPES: tuple[tuple[str, str, str | None], ...] = (
    ("DEMO-KCIC", "DEMO — Jaringan ilustratif", None),
    ("DEMO-NORTH", "DEMO — Koridor utara", "DEMO-KCIC"),
    ("DEMO-SOUTH", "DEMO — Koridor selatan", "DEMO-KCIC"),
)

CATEGORIES: tuple[tuple[str, str], ...] = (
    ("TRACK", "Jalur (DEMO)"),
    ("TURNOUT", "Wesel (DEMO)"),
    ("BRIDGE", "Jembatan (DEMO)"),
    ("TUNNEL", "Terowongan (DEMO)"),
    ("STATION", "Struktur stasiun (DEMO)"),
    ("DRAINAGE", "Drainase (DEMO)"),
)


async def _get_or_create_scope(
    db: AsyncSession, code: str, name: str, parent: Scope | None
) -> Scope:
    scope = (await db.execute(select(Scope).where(Scope.code == code))).scalar_one_or_none()
    if scope is not None:
        return scope
    path = f"{parent.path}/{code.lower()}" if parent else f"/{code.lower()}"
    scope = Scope(code=code, name=name, path=path, parent_id=parent.id if parent else None)
    db.add(scope)
    await db.flush()
    return scope


async def seed_rbac(db: AsyncSession) -> dict[str, Scope]:
    permissions: dict[str, Permission] = {}
    for code, name in ALL_PERMISSIONS:
        permission = (
            await db.execute(select(Permission).where(Permission.code == code))
        ).scalar_one_or_none()
        if permission is None:
            permission = Permission(code=code, name=name)
            db.add(permission)
            await db.flush()
        permissions[code] = permission

    for code, (name, description, permission_codes) in ROLE_DEFINITIONS.items():
        role = (await db.execute(select(Role).where(Role.code == code))).scalar_one_or_none()
        if role is None:
            role = Role(
                code=code,
                name=name,
                description=description,
                permissions=[permissions[code] for code in permission_codes],
            )
            db.add(role)

    scopes: dict[str, Scope] = {}
    for code, name, parent_code in SCOPES:
        parent = scopes.get(parent_code) if parent_code else None
        scopes[code] = await _get_or_create_scope(db, code, name, parent)

    await db.flush()
    return scopes


async def seed_demo_content(db: AsyncSession, scopes: dict[str, Scope]) -> None:
    settings = get_settings()
    password = settings.demo_seed_password
    if not password:
        logger.warning(
            "demo_seed_skipped_users",
            extra={"event": "demo_seed_skipped_users", "reason": DEMO_PASSWORD_ENV},
        )
        return

    for email, full_name, scope_code, role_codes in DEMO_USERS:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is not None:
            continue
        roles = (
            await db.execute(select(Role).where(Role.code.in_([str(code) for code in role_codes])))
        ).scalars().all()
        user = User(
            email=email,
            full_name=full_name,
            password_hash=hash_password(password),
            is_active=True,
            scope_id=scopes[scope_code].id,
            roles=list(roles),
        )
        db.add(user)
    await db.flush()

    categories: dict[str, AssetCategory] = {}
    for code, name in CATEGORIES:
        category = (
            await db.execute(select(AssetCategory).where(AssetCategory.code == code))
        ).scalar_one_or_none()
        if category is None:
            category = AssetCategory(code=code, name=name)
            db.add(category)
            await db.flush()
        categories[code] = category

    north = scopes["DEMO-NORTH"]
    south = scopes["DEMO-SOUTH"]

    async def get_or_create_location(code: str, name: str, scope: Scope) -> Location:
        location = (
            await db.execute(select(Location).where(Location.code == code))
        ).scalar_one_or_none()
        if location is None:
            location = Location(
                code=code,
                name=name,
                scope_id=scope.id,
                description="Lokasi demonstrasi sintetis. Bukan lokasi resmi KCIC.",
            )
            db.add(location)
            await db.flush()
        return location

    location_north = await get_or_create_location(
        "DEMO-LOC-N1", "DEMO Halaman Utara 01", north
    )
    location_south = await get_or_create_location(
        "DEMO-LOC-S1", "DEMO Halaman Selatan 01", south
    )

    async def get_or_create_asset(
        code: str,
        name: str,
        category: str,
        location: Location,
        scope: Scope,
    ) -> Asset:
        asset = (await db.execute(select(Asset).where(Asset.code == code))).scalar_one_or_none()
        if asset is None:
            asset = Asset(
                code=code,
                name=name,
                description="Catatan aset DEMO hanya untuk demonstrasi prototipe.",
                status="active",
                category_id=categories[category].id,
                location_id=location.id,
                scope_id=scope.id,
            )
            db.add(asset)
            await db.flush()
        return asset

    asset_one = await get_or_create_asset(
        "DEMO-AST-0001", "DEMO segmen jalur utara A", "TRACK", location_north, north
    )
    await get_or_create_asset(
        "DEMO-AST-0002", "DEMO jembatan utara B-01", "BRIDGE", location_north, north
    )
    await get_or_create_asset(
        "DEMO-AST-0003", "DEMO wesel selatan T-01", "TURNOUT", location_south, south
    )

    inspector = (
        await db.execute(select(User).where(User.email == "inspector@demo.railwayvision.example"))
    ).scalar_one_or_none()
    if inspector is not None:
        existing = (
            await db.execute(
                select(Inspection).where(Inspection.reference == "DEMO-INS-0001")
            )
        ).scalar_one_or_none()
        if existing is None:
            db.add(
                Inspection(
                    reference="DEMO-INS-0001",
                    status="submitted",
                    notes="[DEMO] Catatan inspeksi sintetis. Bukan data operasional KCIC.",
                    inspected_at=datetime.now(UTC),
                    asset_id=asset_one.id,
                    inspector_id=inspector.id,
                    scope_id=asset_one.scope_id,
                )
            )
    await db.flush()


async def seed_ai_registry(db: AsyncSession) -> None:
    model = (
        await db.execute(
            select(AIModel).where(AIModel.code == "demo-image-quality")
        )
    ).scalar_one_or_none()
    if model is not None:
        return
    db.add(
        AIModel(
            code="demo-image-quality",
            name="DEMO heuristik kualitas gambar",
            version="0.1.0-demo",
            modality="image",
            description=(
                "Metrik kualitas gambar deterministik yang hanya dipakai untuk mendemonstrasikan "
                "alur unggah dan antrean. Ini bukan pendeteksi kerusakan, tidak mengklaim akurasi, "
                "dan tidak boleh digunakan untuk keputusan keselamatan."
            ),
            is_demo=True,
            status="active",
            family="demo-image-quality",
            approval_status="demo_only",
            known_limitations=(
                "Heuristik kualitas gambar; bukan pendeteksi kerusakan dan tidak dievaluasi "
                "terhadap dataset inspeksi."
            ),
        )
    )
    await db.flush()


async def seed_all(db: AsyncSession) -> None:
    scopes = await seed_rbac(db)
    await seed_ai_registry(db)
    await seed_demo_content(db, scopes)
    await db.commit()


async def run_seed() -> None:
    async with SessionLocal() as db:
        await seed_all(db)


async def seed_on_startup() -> None:
    settings = get_settings()
    if settings.app_env != "local" or not settings.seed_demo_data:
        return
    try:
        await run_seed()
        logger.info("demo_seed_completed", extra={"event": "demo_seed_completed"})
    except Exception:
        logger.exception(
            "demo_seed_failed",
            extra={"event": "demo_seed_failed", "outcome": "error"},
        )


if __name__ == "__main__":
    asyncio.run(run_seed())
