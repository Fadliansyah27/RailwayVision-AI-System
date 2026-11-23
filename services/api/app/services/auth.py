from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.identity import AuthSession, Role, User
from app.services.security import hash_refresh_token

_USER_LOAD_OPTIONS = (
    selectinload(User.roles).selectinload(Role.permissions),
    selectinload(User.scope),
)


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def load_user(db: AsyncSession, user_id) -> User | None:
    stmt = select(User).options(*_USER_LOAD_OPTIONS).where(User.id == user_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def load_user_by_email(db: AsyncSession, email: str) -> User | None:
    stmt = select(User).options(*_USER_LOAD_OPTIONS).where(User.email == email.strip().lower())
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_session(
    db: AsyncSession,
    user: User,
    refresh_token: str,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> AuthSession:
    settings = get_settings()
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        expires_at=utcnow() + timedelta(days=settings.refresh_token_days),
        user_agent=(user_agent or "")[:255] or None,
        ip_address=(ip_address or "")[:64] or None,
    )
    db.add(session)
    await db.flush()
    return session
