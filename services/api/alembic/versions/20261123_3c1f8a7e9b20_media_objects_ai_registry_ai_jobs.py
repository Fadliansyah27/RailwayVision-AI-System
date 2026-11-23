"""media objects ai registry ai jobs

Revision ID: 3c1f8a7e9b20
Revises: 22f92c1d5602
Create Date: 2026-11-23 12:20:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "3c1f8a7e9b20"
down_revision: str | None = "22f92c1d5602"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_models",
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("modality", sa.String(length=24), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "media_objects",
        sa.Column("filename", sa.String(length=200), nullable=False),
        sa.Column("content_type", sa.String(length=64), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("bucket", sa.String(length=64), nullable=False),
        sa.Column("object_key", sa.String(length=255), nullable=False),
        sa.Column("quarantine_reason", sa.String(length=120), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("inspection_id", sa.Uuid(), nullable=False),
        sa.Column("scope_id", sa.Uuid(), nullable=False),
        sa.Column("uploaded_by_id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["inspection_id"], ["inspections.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["scope_id"], ["scopes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_key"),
    )
    op.create_index(
        op.f("ix_media_objects_inspection_id"), "media_objects", ["inspection_id"], unique=False
    )
    op.create_index(
        op.f("ix_media_objects_scope_id"), "media_objects", ["scope_id"], unique=False
    )
    op.create_index(
        op.f("ix_media_objects_status"), "media_objects", ["status"], unique=False
    )
    op.create_index(
        op.f("ix_media_objects_uploaded_by_id"), "media_objects", ["uploaded_by_id"], unique=False
    )
    op.create_table(
        "ai_jobs",
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("inspection_id", sa.Uuid(), nullable=False),
        sa.Column("media_id", sa.Uuid(), nullable=False),
        sa.Column("model_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by_id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["inspection_id"], ["inspections.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["media_id"], ["media_objects.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["model_id"], ["ai_models.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_jobs_inspection_id"), "ai_jobs", ["inspection_id"], unique=False)
    op.create_index(op.f("ix_ai_jobs_media_id"), "ai_jobs", ["media_id"], unique=False)
    op.create_index(op.f("ix_ai_jobs_model_id"), "ai_jobs", ["model_id"], unique=False)
    op.create_index(
        op.f("ix_ai_jobs_requested_by_id"), "ai_jobs", ["requested_by_id"], unique=False
    )
    op.create_index(op.f("ix_ai_jobs_status"), "ai_jobs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_jobs_status"), table_name="ai_jobs")
    op.drop_index(op.f("ix_ai_jobs_requested_by_id"), table_name="ai_jobs")
    op.drop_index(op.f("ix_ai_jobs_model_id"), table_name="ai_jobs")
    op.drop_index(op.f("ix_ai_jobs_media_id"), table_name="ai_jobs")
    op.drop_index(op.f("ix_ai_jobs_inspection_id"), table_name="ai_jobs")
    op.drop_table("ai_jobs")
    op.drop_index(op.f("ix_media_objects_uploaded_by_id"), table_name="media_objects")
    op.drop_index(op.f("ix_media_objects_status"), table_name="media_objects")
    op.drop_index(op.f("ix_media_objects_scope_id"), table_name="media_objects")
    op.drop_index(op.f("ix_media_objects_inspection_id"), table_name="media_objects")
    op.drop_table("media_objects")
    op.drop_table("ai_models")
