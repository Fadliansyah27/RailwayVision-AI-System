"""findings, work orders, notifications

Revision ID: 7d2a4c9e3b10
Revises: 9c4e1a2b7f30
Create Date: 2026-11-23 23:40:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "7d2a4c9e3b10"
down_revision: str | None = "9c4e1a2b7f30"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def _timestamps() -> tuple[sa.Column, sa.Column]:
    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def upgrade() -> None:
    op.create_table(
        "findings",
        sa.Column("reference", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("priority", sa.String(length=16), server_default="medium", nullable=False),
        sa.Column("status", sa.String(length=24), server_default="confirmed", nullable=False),
        sa.Column("resolution_notes", sa.Text(), server_default="", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("inspection_id", sa.Uuid(), nullable=False),
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column("scope_id", sa.Uuid(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["inspection_id"], ["inspections.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["scope_id"], ["scopes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("reference",):
        op.create_index(op.f(f"ix_findings_{column}"), "findings", [column], unique=True)
    for column in ("status", "inspection_id", "asset_id", "scope_id", "created_by_id"):
        op.create_index(op.f(f"ix_findings_{column}"), "findings", [column], unique=False)

    op.create_table(
        "work_orders",
        sa.Column("reference", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("instructions", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.String(length=24), server_default="open", nullable=False),
        sa.Column("completion_notes", sa.Text(), server_default="", nullable=False),
        sa.Column("verification_notes", sa.Text(), server_default="", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finding_id", sa.Uuid(), nullable=False),
        sa.Column("scope_id", sa.Uuid(), nullable=False),
        sa.Column("assignee_id", sa.Uuid(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["finding_id"], ["findings.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["scope_id"], ["scopes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_work_orders_reference"), "work_orders", ["reference"], unique=True)
    for column in ("status", "finding_id", "scope_id", "assignee_id", "created_by_id"):
        op.create_index(op.f(f"ix_work_orders_{column}"), "work_orders", [column], unique=False)

    op.create_table(
        "notifications",
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), server_default="", nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=True),
        sa.Column("target_id", sa.String(length=64), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_read_at"), "notifications", ["read_at"], unique=False)
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)

    op.execute(
        "INSERT INTO permissions (id, code, name, created_at, updated_at) "
        "SELECT gen_random_uuid(), 'work_orders:read', 'View work orders', now(), now() "
        "WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'work_orders:read')"
    )
    op.execute(
        "INSERT INTO role_permissions (role_id, permission_id) "
        "SELECT r.id, p.id FROM roles r, permissions p "
        "WHERE r.code = 'inspector' AND p.code = 'work_orders:read' "
        "AND NOT EXISTS (SELECT 1 FROM role_permissions rp "
        "WHERE rp.role_id = r.id AND rp.permission_id = p.id)"
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM role_permissions WHERE permission_id IN "
        "(SELECT id FROM permissions WHERE code = 'work_orders:read')"
    )
    op.execute("DELETE FROM permissions WHERE code = 'work_orders:read'")

    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_read_at"), table_name="notifications")
    op.drop_table("notifications")

    for column in ("created_by_id", "assignee_id", "scope_id", "finding_id", "status"):
        op.drop_index(op.f(f"ix_work_orders_{column}"), table_name="work_orders")
    op.drop_index(op.f("ix_work_orders_reference"), table_name="work_orders")
    op.drop_table("work_orders")

    for column in ("created_by_id", "scope_id", "asset_id", "inspection_id", "status"):
        op.drop_index(op.f(f"ix_findings_{column}"), table_name="findings")
    op.drop_index(op.f("ix_findings_reference"), table_name="findings")
    op.drop_table("findings")
