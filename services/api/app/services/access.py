import uuid

from sqlalchemy import ColumnElement, or_

from app.models.identity import Scope, User
from app.schemas.auth import UserOut
from app.schemas.common import RoleBrief, ScopeOut, UserBrief
from app.schemas.users import UserAdminOut


def accessible_scope_condition(user_scope_path: str) -> ColumnElement[bool]:
    """Resources are visible inside the user's scope subtree only."""
    return or_(
        Scope.path == user_scope_path,
        Scope.path.startswith(f"{user_scope_path}/"),
    )


def can_access_scope(user_scope_path: str, resource_scope_path: str) -> bool:
    return resource_scope_path == user_scope_path or resource_scope_path.startswith(
        f"{user_scope_path}/"
    )


def user_brief(user: User) -> UserBrief:
    return UserBrief(id=user.id, full_name=user.full_name)


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        scope=ScopeOut.model_validate(user.scope),
        roles=[RoleBrief.model_validate(role) for role in user.roles],
        permissions=sorted(user.permission_codes),
    )


def user_admin_out(user: User) -> UserAdminOut:
    return UserAdminOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        scope=ScopeOut.model_validate(user.scope),
        roles=[RoleBrief.model_validate(role) for role in user.roles],
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def ensure_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise ValueError("Malformed identifier") from exc
