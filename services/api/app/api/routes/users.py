import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import AuthContext, require_permission
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.rbac import RoleCode
from app.db.session import get_db
from app.models.identity import (
    AuthSession,
    PasswordResetRequest,
    Permission,
    Role,
    Scope,
    User,
)
from app.schemas.common import Page, ScopeOut
from app.schemas.users import (
    PasswordResetRequestOut,
    PasswordResetTokenOut,
    PermissionOut,
    RoleOut,
    RolePermissionsUpdate,
    ScopeCreate,
    UserAdminOut,
    UserCreate,
    UserUpdate,
)
from app.services.access import accessible_scope_condition, user_admin_out
from app.services.audit import record_audit
from app.services.auth import load_user, utcnow
from app.services.security import (
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
)

router = APIRouter(tags=["administration"])

_USER_OPTIONS = (
    selectinload(User.roles).selectinload(Role.permissions),
    selectinload(User.scope),
)


async def _resolve_roles(db: AsyncSession, role_codes: list[str]) -> list[Role]:
    roles = (await db.execute(select(Role).where(Role.code.in_(role_codes)))).scalars().all()
    if len({role.code for role in roles}) != len(set(role_codes)):
        raise AppError(422, "validation_error", "Satu atau lebih peran tidak dikenal.")
    return list(roles)


async def _resolve_scope(db: AsyncSession, ctx: AuthContext, scope_id: uuid.UUID) -> Scope:
    scope = await db.get(Scope, scope_id)
    if scope is None or not (
        scope.path == ctx.scope_path or scope.path.startswith(f"{ctx.scope_path}/")
    ):
        raise AppError(404, "not_found", "Cakupan tidak ditemukan.")
    return scope


async def _get_accessible_user(db: AsyncSession, ctx: AuthContext, user_id: uuid.UUID) -> User:
    stmt = (
        select(User)
        .join(Scope, User.scope_id == Scope.id)
        .options(*_USER_OPTIONS)
        .where(User.id == user_id, accessible_scope_condition(ctx.scope_path))
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise AppError(404, "not_found", "Pengguna tidak ditemukan.")
    return user


@router.get("/users", response_model=Page[UserAdminOut])
async def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    scope_id: uuid.UUID | None = Query(default=None),
    role_code: str | None = Query(default=None, max_length=64),
    is_active: bool | None = Query(default=None),
    ctx: AuthContext = Depends(require_permission("users:manage")),
    db: AsyncSession = Depends(get_db),
) -> Page[UserAdminOut]:
    conditions = [accessible_scope_condition(ctx.scope_path)]
    if scope_id is not None:
        conditions.append(User.scope_id == scope_id)
    if role_code:
        conditions.append(User.roles.any(Role.code == role_code))
    if is_active is not None:
        conditions.append(User.is_active.is_(is_active))
    if search:
        term = f"%{search.strip()}%"
        conditions.append(or_(User.email.ilike(term), User.full_name.ilike(term)))

    total = (
        await db.execute(
            select(func.count())
            .select_from(User)
            .join(Scope, User.scope_id == Scope.id)
            .where(*conditions)
        )
    ).scalar_one()

    stmt = (
        select(User)
        .join(Scope, User.scope_id == Scope.id)
        .options(*_USER_OPTIONS)
        .where(*conditions)
        .order_by(User.full_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    users = (await db.execute(stmt)).scalars().all()
    return Page[UserAdminOut](
        items=[user_admin_out(user) for user in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/users", response_model=UserAdminOut, status_code=201)
async def create_user(
    payload: UserCreate,
    ctx: AuthContext = Depends(require_permission("users:manage")),
    db: AsyncSession = Depends(get_db),
) -> UserAdminOut:
    email = str(payload.email).strip().lower()
    if len(payload.password) < 10:
        raise AppError(422, "validation_error", "Kata sandi terlalu pendek.")
    if await db.scalar(select(User.id).where(User.email == email)) is not None:
        raise AppError(409, "conflict", "Pengguna dengan email ini sudah ada.")

    scope = await _resolve_scope(db, ctx, payload.scope_id)
    roles = await _resolve_roles(db, [str(code) for code in payload.role_codes])
    user = User(
        email=email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        is_active=payload.is_active,
        scope_id=scope.id,
        roles=roles,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError(409, "conflict", "Pengguna dengan email ini sudah ada.") from exc

    await record_audit(
        db,
        action="user.created",
        actor=ctx.user,
        target_type="user",
        target_id=user.id,
        scope_id=scope.id,
        metadata={"roles": sorted(str(code) for code in payload.role_codes)},
    )
    await db.commit()
    created = await load_user(db, user.id)
    return user_admin_out(created)


@router.get("/users/{user_id}", response_model=UserAdminOut)
async def get_user(
    user_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("users:manage")),
    db: AsyncSession = Depends(get_db),
) -> UserAdminOut:
    return user_admin_out(await _get_accessible_user(db, ctx, user_id))


@router.patch("/users/{user_id}", response_model=UserAdminOut)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    ctx: AuthContext = Depends(require_permission("users:manage")),
    db: AsyncSession = Depends(get_db),
) -> UserAdminOut:
    user = await _get_accessible_user(db, ctx, user_id)
    changed: list[str] = []

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
        changed.append("full_name")
    if payload.scope_id is not None:
        scope = await _resolve_scope(db, ctx, payload.scope_id)
        user.scope_id = scope.id
        changed.append("scope")
    if payload.role_codes is not None:
        codes = [str(code) for code in payload.role_codes]
        if user.id == ctx.user.id and RoleCode.ADMINISTRATOR not in codes:
            raise AppError(
                409,
                "conflict",
                "Anda tidak dapat mencabut peran administrator milik sendiri.",
            )
        user.roles = await _resolve_roles(db, codes)
        changed.append("roles")
    if payload.is_active is not None:
        if user.id == ctx.user.id and payload.is_active is False:
            raise AppError(409, "conflict", "Anda tidak dapat menonaktifkan akun sendiri.")
        user.is_active = payload.is_active
        changed.append("is_active")
        if not payload.is_active:
            await db.execute(
                update(AuthSession)
                .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
                .values(revoked_at=utcnow())
            )

    await record_audit(
        db,
        action="user.updated",
        actor=ctx.user,
        target_type="user",
        target_id=user.id,
        scope_id=user.scope_id,
        metadata={"fields": changed},
    )
    await db.commit()
    return user_admin_out(await _get_accessible_user(db, ctx, user.id))


@router.post("/users/{user_id}/deactivate", response_model=UserAdminOut)
async def deactivate_user(
    user_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("users:manage")),
    db: AsyncSession = Depends(get_db),
) -> UserAdminOut:
    if user_id == ctx.user.id:
        raise AppError(409, "conflict", "Anda tidak dapat menonaktifkan akun sendiri.")
    user = await _get_accessible_user(db, ctx, user_id)
    user.is_active = False
    await db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    await record_audit(
        db,
        action="user.deactivated",
        actor=ctx.user,
        target_type="user",
        target_id=user.id,
        scope_id=user.scope_id,
    )
    await db.commit()
    return user_admin_out(await _get_accessible_user(db, ctx, user.id))


@router.get("/roles", response_model=list[RoleOut])
async def list_roles(
    ctx: AuthContext = Depends(require_permission("users:manage")),
    db: AsyncSession = Depends(get_db),
) -> list[RoleOut]:
    roles = (await db.execute(select(Role).order_by(Role.code.asc()))).scalars().all()
    return [RoleOut.model_validate(role) for role in roles]


@router.patch("/roles/{role_id}/permissions", response_model=RoleOut)
async def update_role_permissions(
    role_id: uuid.UUID,
    payload: RolePermissionsUpdate,
    ctx: AuthContext = Depends(require_permission("users:manage")),
    db: AsyncSession = Depends(get_db),
) -> RoleOut:
    role = (await db.execute(select(Role).where(Role.id == role_id))).scalar_one_or_none()
    if role is None:
        raise AppError(404, "not_found", "Peran tidak ditemukan.")
    if role.code == RoleCode.ADMINISTRATOR:
        raise AppError(409, "conflict", "Izin administrator sengaja dibuat tetap.")

    permissions = (
        (await db.execute(select(Permission).where(Permission.code.in_(payload.permission_codes))))
        .scalars()
        .all()
    )
    if len(permissions) != len(set(payload.permission_codes)):
        raise AppError(422, "validation_error", "Satu atau lebih izin tidak dikenal.")

    before = sorted(permission.code for permission in role.permissions)
    role.permissions = list(permissions)
    await record_audit(
        db,
        action="role.permissions_updated",
        actor=ctx.user,
        target_type="role",
        target_id=role.id,
        metadata={
            "before": before,
            "after": sorted(payload.permission_codes),
        },
    )
    await db.commit()
    role = (
        await db.execute(
            select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
        )
    ).scalar_one()
    return RoleOut.model_validate(role)


@router.get("/permissions", response_model=list[PermissionOut])
async def list_permissions(
    ctx: AuthContext = Depends(require_permission("users:manage")),
    db: AsyncSession = Depends(get_db),
) -> list[PermissionOut]:
    permissions = (
        (await db.execute(select(Permission).order_by(Permission.code.asc()))).scalars().all()
    )
    return [PermissionOut.model_validate(permission) for permission in permissions]


@router.get("/scopes", response_model=list[ScopeOut])
async def list_scopes(
    ctx: AuthContext = Depends(require_permission("assets:read")),
    db: AsyncSession = Depends(get_db),
) -> list[ScopeOut]:
    scopes = (
        (
            await db.execute(
                select(Scope)
                .where(accessible_scope_condition(ctx.scope_path))
                .order_by(Scope.path.asc())
            )
        )
        .scalars()
        .all()
    )
    return [ScopeOut.model_validate(scope) for scope in scopes]


@router.post("/scopes", response_model=ScopeOut, status_code=201)
async def create_scope(
    payload: ScopeCreate,
    ctx: AuthContext = Depends(require_permission("users:manage")),
    db: AsyncSession = Depends(get_db),
) -> ScopeOut:
    code = payload.code.upper()
    if await db.scalar(select(Scope.id).where(Scope.code == code)) is not None:
        raise AppError(409, "conflict", "Cakupan dengan kode ini sudah ada.")

    parent: Scope | None = None
    if payload.parent_id is not None:
        parent = await _resolve_scope(db, ctx, payload.parent_id)
        path = f"{parent.path}/{code.lower()}"
    else:
        path = f"/{code.lower()}"

    scope = Scope(
        code=code,
        name=payload.name.strip(),
        path=path,
        parent_id=parent.id if parent else None,
    )
    db.add(scope)
    await db.flush()
    await record_audit(
        db,
        action="scope.created",
        actor=ctx.user,
        target_type="scope",
        target_id=scope.id,
        scope_id=scope.id,
        metadata={"code": code, "path": path},
    )
    await db.commit()
    return ScopeOut.model_validate(scope)


@router.get("/password-reset-requests", response_model=list[PasswordResetRequestOut])
async def list_password_reset_requests(
    status: str | None = Query(default="pending", max_length=16),
    ctx: AuthContext = Depends(require_permission("users:manage")),
    db: AsyncSession = Depends(get_db),
) -> list[PasswordResetRequestOut]:
    conditions = [accessible_scope_condition(ctx.scope_path)]
    if status:
        conditions.append(PasswordResetRequest.status == status)
    rows = (
        await db.execute(
            select(PasswordResetRequest, User)
            .join(User, PasswordResetRequest.user_id == User.id)
            .join(Scope, User.scope_id == Scope.id)
            .where(*conditions)
            .order_by(PasswordResetRequest.requested_at.desc())
            .limit(100)
        )
    ).all()
    return [
        PasswordResetRequestOut(
            id=request.id,
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            status=request.status,
            requested_at=request.requested_at,
            token_expires_at=request.token_expires_at,
        )
        for request, user in rows
    ]


@router.post("/users/{user_id}/password-reset-token", response_model=PasswordResetTokenOut)
async def issue_password_reset_token(
    user_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("users:manage")),
    db: AsyncSession = Depends(get_db),
) -> PasswordResetTokenOut:
    settings = get_settings()
    user = await _get_accessible_user(db, ctx, user_id)
    request = (
        await db.execute(
            select(PasswordResetRequest)
            .where(
                PasswordResetRequest.user_id == user.id,
                PasswordResetRequest.status.in_(("pending", "issued")),
            )
            .order_by(PasswordResetRequest.requested_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if request is None:
        raise AppError(
            409,
            "conflict",
            "Pengguna ini tidak memiliki permintaan reset kata sandi tertunda.",
        )

    token = generate_refresh_token()
    expires_at = utcnow() + timedelta(minutes=settings.password_reset_minutes)
    request.token_hash = hash_refresh_token(token)
    request.token_expires_at = expires_at
    request.status = "issued"
    request.issued_by_id = ctx.user.id
    request.used_at = None
    await record_audit(
        db,
        action="auth.password_reset_issued",
        actor=ctx.user,
        target_type="user",
        target_id=user.id,
        scope_id=user.scope_id,
        metadata={"expires_at": expires_at.isoformat()},
    )
    await db.commit()
    return PasswordResetTokenOut(token=token, expires_at=expires_at)
