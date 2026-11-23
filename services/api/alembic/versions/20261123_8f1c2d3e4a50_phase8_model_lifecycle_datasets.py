"""phase 8 model lifecycle metadata and dataset registry

Revision ID: 8f1c2d3e4a50
Revises: 7d2a4c9e3b10
Create Date: 2026-11-23 16:00:00 UTC

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "8f1c2d3e4a50"
down_revision: str | None = "7d2a4c9e3b10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=240), nullable=False),
        sa.Column("license_note", sa.String(length=240), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("class_names", sa.JSON(), nullable=False),
        sa.Column("image_count", sa.Integer(), nullable=False),
        sa.Column("split_train", sa.Integer(), nullable=False),
        sa.Column("split_validation", sa.Integer(), nullable=False),
        sa.Column("split_test", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("approval_notes", sa.Text(), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by_id", sa.Uuid(), nullable=True),
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
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        op.f("ix_datasets_approved_by_id"), "datasets", ["approved_by_id"], unique=False
    )
    op.create_index(op.f("ix_datasets_status"), "datasets", ["status"], unique=False)

    op.add_column(
        "ai_models",
        sa.Column("family", sa.String(length=64), nullable=False, server_default=""),
    )
    op.add_column(
        "ai_models",
        sa.Column(
            "approval_status",
            sa.String(length=24),
            nullable=False,
            server_default="draft",
        ),
    )
    op.add_column(
        "ai_models", sa.Column("dataset_version", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "ai_models", sa.Column("checksum_sha256", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "ai_models",
        sa.Column("class_names", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )
    op.add_column(
        "ai_models",
        sa.Column(
            "training_config", sa.JSON(), nullable=False, server_default=sa.text("'{}'")
        ),
    )
    op.add_column("ai_models", sa.Column("evaluation_metrics", sa.JSON(), nullable=True))
    op.add_column(
        "ai_models",
        sa.Column("evaluation_notes", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "ai_models",
        sa.Column("known_limitations", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "ai_models",
        sa.Column("approval_notes", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "ai_models", sa.Column("deployed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "ai_models", sa.Column("retired_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "ai_models", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("ai_models", sa.Column("approved_by_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_ai_models_approved_by_id_users",
        "ai_models",
        "users",
        ["approved_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_ai_models_family"), "ai_models", ["family"], unique=False)
    op.create_index(
        op.f("ix_ai_models_approval_status"),
        "ai_models",
        ["approval_status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ai_models_approved_by_id"),
        "ai_models",
        ["approved_by_id"],
        unique=False,
    )

    op.execute("UPDATE ai_models SET family = code WHERE family = ''")
    op.execute(
        "UPDATE ai_models SET approval_status = 'demo_only' WHERE is_demo = true"
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_models_approved_by_id"), table_name="ai_models")
    op.drop_index(op.f("ix_ai_models_approval_status"), table_name="ai_models")
    op.drop_index(op.f("ix_ai_models_family"), table_name="ai_models")
    op.drop_constraint(
        "fk_ai_models_approved_by_id_users", "ai_models", type_="foreignkey"
    )
    op.drop_column("ai_models", "approved_by_id")
    op.drop_column("ai_models", "approved_at")
    op.drop_column("ai_models", "retired_at")
    op.drop_column("ai_models", "deployed_at")
    op.drop_column("ai_models", "approval_notes")
    op.drop_column("ai_models", "known_limitations")
    op.drop_column("ai_models", "evaluation_notes")
    op.drop_column("ai_models", "evaluation_metrics")
    op.drop_column("ai_models", "training_config")
    op.drop_column("ai_models", "class_names")
    op.drop_column("ai_models", "checksum_sha256")
    op.drop_column("ai_models", "dataset_version")
    op.drop_column("ai_models", "approval_status")
    op.drop_column("ai_models", "family")
    op.drop_index(op.f("ix_datasets_status"), table_name="datasets")
    op.drop_index(op.f("ix_datasets_approved_by_id"), table_name="datasets")
    op.drop_table("datasets")
