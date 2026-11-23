"""inspection review decisions

Revision ID: 6b7f2e4d9a10
Revises: 3c1f8a7e9b20
Create Date: 2026-11-23 15:40:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "6b7f2e4d9a10"
down_revision: str | None = "3c1f8a7e9b20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "inspection_reviews",
        sa.Column("decision", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("inspection_id", sa.Uuid(), nullable=False),
        sa.Column("reviewer_id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["inspection_id"], ["inspections.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_inspection_reviews_inspection_id"),
        "inspection_reviews",
        ["inspection_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_inspection_reviews_reviewer_id"),
        "inspection_reviews",
        ["reviewer_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_inspection_reviews_reviewer_id"), table_name="inspection_reviews"
    )
    op.drop_index(
        op.f("ix_inspection_reviews_inspection_id"), table_name="inspection_reviews"
    )
    op.drop_table("inspection_reviews")
