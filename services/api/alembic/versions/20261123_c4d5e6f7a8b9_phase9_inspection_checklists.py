"""phase 9 configurable inspection checklists

Revision ID: c4d5e6f7a8b9
Revises: 8f1c2d3e4a50
Create Date: 2026-11-23 16:30:00 UTC

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c4d5e6f7a8b9"
down_revision: str | None = "8f1c2d3e4a50"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> list[sa.Column]:
    return [
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
    ]


def upgrade() -> None:
    op.create_table(
        "checklist_templates",
        sa.Column("code", sa.String(length=48), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("inspection_type", sa.String(length=24), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        op.f("ix_checklist_templates_inspection_type"),
        "checklist_templates",
        ["inspection_type"],
        unique=False,
    )

    op.create_table(
        "checklist_template_items",
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=48), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["template_id"], ["checklist_templates.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_id", "code"),
        sa.UniqueConstraint("template_id", "position"),
    )
    op.create_index(
        op.f("ix_checklist_template_items_template_id"),
        "checklist_template_items",
        ["template_id"],
        unique=False,
    )

    op.create_table(
        "inspection_checklist_results",
        sa.Column("inspection_id", sa.Uuid(), nullable=False),
        sa.Column("template_id", sa.Uuid(), nullable=True),
        sa.Column("item_code", sa.String(length=48), nullable=False),
        sa.Column("item_label", sa.String(length=200), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False),
        sa.Column("result", sa.String(length=16), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("recorded_by_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["inspection_id"], ["inspections.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["template_id"], ["checklist_templates.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["recorded_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("inspection_id", "item_code"),
    )
    op.create_index(
        op.f("ix_inspection_checklist_results_inspection_id"),
        "inspection_checklist_results",
        ["inspection_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_inspection_checklist_results_inspection_id"),
        table_name="inspection_checklist_results",
    )
    op.drop_table("inspection_checklist_results")
    op.drop_index(
        op.f("ix_checklist_template_items_template_id"),
        table_name="checklist_template_items",
    )
    op.drop_table("checklist_template_items")
    op.drop_index(
        op.f("ix_checklist_templates_inspection_type"),
        table_name="checklist_templates",
    )
    op.drop_table("checklist_templates")
