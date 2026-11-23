"""inspection fields, workflow statuses, password reset requests

Revision ID: 9c4e1a2b7f30
Revises: 6b7f2e4d9a10
Create Date: 2026-11-23 21:10:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "9c4e1a2b7f30"
down_revision: str | None = "6b7f2e4d9a10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "inspections",
        sa.Column(
            "inspection_type",
            sa.String(length=24),
            server_default="routine",
            nullable=False,
        ),
    )
    op.add_column(
        "inspections",
        sa.Column(
            "location_reference",
            sa.String(length=200),
            server_default="",
            nullable=False,
        ),
    )

    op.execute(
        "UPDATE inspections SET status = 'under_review' WHERE status = 'review_pending'"
    )
    op.execute(
        "UPDATE inspections SET status = 'reviewed' WHERE status = 'completed'"
    )

    op.create_table(
        "password_reset_requests",
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("issued_by_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["issued_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_password_reset_requests_status"),
        "password_reset_requests",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_password_reset_requests_token_hash"),
        "password_reset_requests",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        op.f("ix_password_reset_requests_user_id"),
        "password_reset_requests",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_password_reset_requests_user_id"),
        table_name="password_reset_requests",
    )
    op.drop_index(
        op.f("ix_password_reset_requests_token_hash"),
        table_name="password_reset_requests",
    )
    op.drop_index(
        op.f("ix_password_reset_requests_status"),
        table_name="password_reset_requests",
    )
    op.drop_table("password_reset_requests")

    op.execute(
        "UPDATE inspections SET status = 'completed' WHERE status = 'reviewed'"
    )
    op.execute(
        "UPDATE inspections SET status = 'review_pending' WHERE status = 'under_review'"
    )
    op.execute(
        "UPDATE inspections SET status = 'review_pending' "
        "WHERE status IN ('ai_processed', 'ai_failed', 'inconclusive')"
    )

    op.drop_column("inspections", "location_reference")
    op.drop_column("inspections", "inspection_type")
