import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.rbac import RoleCode
from app.schemas.common import RoleBrief, ScopeOut


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    description: str
    permissions: list[PermissionOut]


class UserAdminOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    last_login_at: datetime | None
    scope: ScopeOut
    roles: list[RoleBrief]
    created_at: datetime
    updated_at: datetime


class PasswordResetRequestOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    full_name: str
    status: str
    requested_at: datetime
    token_expires_at: datetime | None


class PasswordResetTokenOut(BaseModel):
    token: str
    expires_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=10, max_length=128)
    scope_id: uuid.UUID
    role_codes: list[RoleCode] = Field(min_length=1)
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    is_active: bool | None = None
    scope_id: uuid.UUID | None = None
    role_codes: list[RoleCode] | None = Field(default=None, min_length=1)


class RolePermissionsUpdate(BaseModel):
    permission_codes: list[str] = Field(min_length=1)


class ScopeCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
    name: str = Field(min_length=2, max_length=160)
    parent_id: uuid.UUID | None = None
