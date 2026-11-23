import uuid
from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.session import get_db
from app.models.identity import AuthSession, Role, User
from app.services.auth import as_utc, utcnow
from app.services.security import decode_access_token


@dataclass(slots=True)
class AuthContext:
    user: User
    session: AuthSession
    permissions: frozenset[str]

    @property
    def scope_path(self) -> str:
        return self.user.scope.path

    def has(self, permission: str) -> bool:
        return permission in self.permissions


def _bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        raise AppError(401, "unauthorized", "Autentikasi diperlukan.")
    token = header[7:].strip()
    if not token or len(token) > 4096:
        raise AppError(401, "unauthorized", "Autentikasi diperlukan.")
    return token


async def get_auth_context(
    request: Request, db: AsyncSession = Depends(get_db)
) -> AuthContext:
    payload = decode_access_token(_bearer_token(request))
    try:
        user_id = uuid.UUID(str(payload["sub"]))
        session_id = uuid.UUID(str(payload["sid"]))
    except (ValueError, KeyError) as exc:
        raise AppError(401, "unauthorized", "Token sesi tidak valid.") from exc

    session = await db.get(AuthSession, session_id)
    if (
        session is None
        or session.user_id != user_id
        or session.revoked_at is not None
        or as_utc(session.expires_at) <= utcnow()
    ):
        raise AppError(401, "unauthorized", "Sesi tidak lagi valid.")

    stmt = (
        select(User)
        .options(
            selectinload(User.roles).selectinload(Role.permissions),
            selectinload(User.scope),
        )
        .where(User.id == user_id)
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None or not user.is_active:
        raise AppError(401, "unauthorized", "Sesi tidak lagi valid.")

    return AuthContext(
        user=user, session=session, permissions=user.permission_codes
    )


def require_permission(permission: str):
    async def dependency(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if permission not in ctx.permissions:
            raise AppError(403, "forbidden", "Izin tidak memadai.")
        return ctx

    return dependency


def require_any_permission(*permissions: str):
    async def dependency(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if not any(permission in ctx.permissions for permission in permissions):
            raise AppError(403, "forbidden", "Izin tidak memadai.")
        return ctx

    return dependency
