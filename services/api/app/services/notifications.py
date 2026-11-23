"""In-app notification helpers.

Notifications are stored per user and delivered only through the authenticated API.
There is no e-mail/SMS transport in this build.
"""

import uuid
from collections.abc import Iterable
from typing import Literal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.identity import (
    Permission,
    Scope,
    User,
    role_permissions,
    user_roles,
)
from app.models.maintenance import Notification


def _ancestor_paths(scope_path: str) -> list[str]:
    """Paths that contain the resource scope, including itself.

    Notifications travel up the scope tree: a supervisor at the network root
    must hear about a finding recorded in a corridor child scope.
    """
    parts = [part for part in scope_path.split("/") if part]
    return ["/" + "/".join(parts[:depth]) for depth in range(1, len(parts) + 1)]


def _descendant_condition(scope_path: str):
    """Match scopes at or below ``scope_path`` for downward candidate lists."""
    return or_(Scope.path == scope_path, Scope.path.like(f"{scope_path}/%"))


async def create_notifications(
    db: AsyncSession,
    *,
    user_ids: Iterable[uuid.UUID],
    kind: str,
    title: str,
    body: str,
    target_type: str | None = None,
    target_id: str | None = None,
) -> int:
    created = 0
    for user_id in dict.fromkeys(user_ids):
        db.add(
            Notification(
                user_id=user_id,
                kind=kind,
                title=title,
                body=body,
                target_type=target_type,
                target_id=target_id,
            )
        )
        created += 1
    await db.flush()
    return created


async def users_with_permission(
    db: AsyncSession,
    *,
    permission_code: str,
    scope_path: str,
    exclude_user_id: uuid.UUID | None = None,
    direction: Literal["up", "down"] = "up",
) -> list[uuid.UUID]:
    """Active users whose roles grant the permission, within the scope.

    ``direction="up"`` matches the given scope and its ancestors (notification
    recipients). ``direction="down"`` matches the given scope and its
    descendants (assignable users for work orders).
    """
    has_permission = (
        select(1)
        .select_from(user_roles)
        .join(role_permissions, role_permissions.c.role_id == user_roles.c.role_id)
        .join(Permission, Permission.id == role_permissions.c.permission_id)
        .where(user_roles.c.user_id == User.id, Permission.code == permission_code)
        .exists()
    )
    scope_match = (
        Scope.path.in_(_ancestor_paths(scope_path))
        if direction == "up"
        else _descendant_condition(scope_path)
    )
    stmt = (
        select(User.id)
        .join(Scope, User.scope_id == Scope.id)
        .where(
            User.is_active.is_(True),
            scope_match,
            has_permission,
        )
    )
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    return list((await db.execute(stmt)).scalars().all())


async def notify_permission_holders(
    db: AsyncSession,
    *,
    permission_code: str,
    scope_path: str,
    exclude_user_id: uuid.UUID | None,
    kind: str,
    title: str,
    body: str,
    target_type: str | None = None,
    target_id: str | None = None,
) -> int:
    user_ids = await users_with_permission(
        db,
        permission_code=permission_code,
        scope_path=scope_path,
        exclude_user_id=exclude_user_id,
        direction="up",
    )
    return await create_notifications(
        db,
        user_ids=user_ids,
        kind=kind,
        title=title,
        body=body,
        target_type=target_type,
        target_id=target_id,
    )
