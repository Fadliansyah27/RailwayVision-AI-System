"""relabel seeded synthetic data from DEMO to SINTETIS

Revision ID: d1e2f3a4b5c6
Revises: c4d5e6f7a8b9
Create Date: 2026-11-23 18:10:00 UTC

The seed data created before this revision used "DEMO" identifiers and labels.
The records remain synthetic and are still flagged with media_objects/ai_models
flags in code; only the display labels and codes are relabelled here.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: str | None = "c4d5e6f7a8b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TEXT_COLUMNS: tuple[tuple[str, str], ...] = (
    ("scopes", "code"),
    ("scopes", "name"),
    ("scopes", "path"),
    ("users", "email"),
    ("users", "full_name"),
    ("locations", "code"),
    ("locations", "name"),
    ("locations", "description"),
    ("assets", "code"),
    ("assets", "name"),
    ("assets", "description"),
    ("asset_categories", "name"),
    ("inspections", "reference"),
    ("inspections", "notes"),
    ("inspection_reviews", "notes"),
    ("inspection_checklist_results", "item_label"),
    ("inspection_checklist_results", "notes"),
    ("checklist_templates", "name"),
    ("checklist_template_items", "label"),
    ("findings", "reference"),
    ("findings", "title"),
    ("findings", "description"),
    ("findings", "resolution_notes"),
    ("work_orders", "reference"),
    ("work_orders", "title"),
    ("work_orders", "instructions"),
    ("work_orders", "completion_notes"),
    ("work_orders", "verification_notes"),
    ("notifications", "title"),
    ("notifications", "body"),
    ("datasets", "code"),
    ("datasets", "name"),
    ("datasets", "source"),
    ("datasets", "license_note"),
    ("datasets", "description"),
    ("datasets", "approval_notes"),
    ("ai_models", "code"),
    ("ai_models", "family"),
    ("ai_models", "name"),
    ("ai_models", "version"),
    ("ai_models", "description"),
    ("ai_models", "dataset_version"),
    ("ai_models", "evaluation_notes"),
    ("ai_models", "known_limitations"),
    ("ai_models", "approval_notes"),
    ("ai_jobs", "error_code"),
    ("audit_events", "actor_label"),
    ("audit_events", "action"),
)

EXACT_REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("DEMO — Jaringan ilustratif", "Sintetis — Jaringan ilustratif"),
    ("DEMO — Koridor utara", "Sintetis — Koridor utara"),
    ("DEMO — Koridor selatan", "Sintetis — Koridor selatan"),
    ("DEMO Halaman Utara 01", "Halaman Sintetis Utara 01"),
    ("DEMO Halaman Selatan 01", "Halaman Sintetis Selatan 01"),
    ("DEMO segmen jalur utara A", "Segmen jalur sintetis utara A"),
    ("DEMO jembatan utara B-01", "Jembatan sintetis utara B-01"),
    ("DEMO wesel selatan T-01", "Wesel sintetis selatan T-01"),
    ("DEMO heuristik kualitas gambar", "Heuristik kualitas gambar sintetis"),
    (
        "Lokasi demonstrasi sintetis. Bukan lokasi resmi KCIC.",
        "Lokasi sintetis. Bukan lokasi resmi KCIC.",
    ),
    (
        "Catatan aset DEMO hanya untuk demonstrasi prototipe.",
        "Catatan aset sintetis untuk pengujian prototipe.",
    ),
    (
        "Metrik kualitas gambar deterministik yang hanya dipakai untuk mendemonstrasikan "
        "alur unggah dan antrean. Ini bukan pendeteksi kerusakan, tidak mengklaim akurasi, "
        "dan tidak boleh digunakan untuk keputusan keselamatan.",
        "Metrik kualitas gambar deterministik yang dipakai untuk menguji alur unggah "
        "dan antrean. Ini bukan pendeteksi kerusakan, tidak mengklaim akurasi, dan "
        "tidak boleh digunakan untuk keputusan keselamatan.",
    ),
)

TOKEN_REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("@demo.railwayvision.example", "@sintetis.railwayvision.example"),
    ("demo-image-quality", "synthetic-image-quality"),
    ("0.1.0-demo", "0.1.0-sintetis"),
    ("demo_only", "synthetic_only"),
    ("/demo-", "/sintetis-"),
    ("DEMO-", "SINTETIS-"),
    ("[DEMO]", "[SINTETIS]"),
    (" (DEMO)", ""),
    ("(DEMO)", ""),
    ("dan demonstrasi", "dan pengujian"),
    ("demonstrasi", "sintetis"),
    ("DEMO ", "Sintetis "),
    ("Demo ", "Sintetis "),
    ("DEMO", "SINTETIS"),
    ("Demo", "Sintetis"),
    ("demo", "sintetis"),
)

REVERSE_EXACT: tuple[tuple[str, str], ...] = tuple(
    (new, old) for old, new in EXACT_REPLACEMENTS
)
REVERSE_TOKENS: tuple[tuple[str, str], ...] = (
    ("@sintetis.railwayvision.example", "@demo.railwayvision.example"),
    ("synthetic-image-quality", "demo-image-quality"),
    ("0.1.0-sintetis", "0.1.0-demo"),
    ("synthetic_only", "demo_only"),
    ("/sintetis-", "/demo-"),
    ("SINTETIS-", "DEMO-"),
    ("[SINTETIS]", "[DEMO]"),
    ("Sintetis Administrator", "DEMO Administrator"),
)


def _replace(table: str, column: str, old: str, new: str) -> None:
    op.execute(
        sa.text(
            f"UPDATE {table} SET {column} = replace({column}, :old, :new) "
            f"WHERE {column} LIKE :pattern"
        ).bindparams(old=old, new=new, pattern=f"%{old}%")
    )


def _apply(pairs: tuple[tuple[str, str], ...]) -> None:
    for old, new in pairs:
        for table, column in TEXT_COLUMNS:
            _replace(table, column, old, new)


def _json_text_replace(table: str, column: str, old: str, new: str) -> None:
    op.execute(
        sa.text(
            f"UPDATE {table} SET {column} = "
            f"CAST(replace(CAST({column} AS TEXT), :old, :new) AS JSON) "
            f"WHERE CAST({column} AS TEXT) LIKE :pattern"
        ).bindparams(old=old, new=new, pattern=f"%{old}%")
    )


def upgrade() -> None:
    _apply(EXACT_REPLACEMENTS)
    _apply(TOKEN_REPLACEMENTS)

    op.execute(
        sa.text(
            "UPDATE ai_models SET approval_status = 'synthetic_only' "
            "WHERE approval_status = 'demo_only'"
        )
    )
    op.execute(
        sa.text(
            "UPDATE permissions SET name = "
            "'Kelola konsol operasi, deployment, dan reset data sintetis' "
            "WHERE code = 'ops:manage'"
        )
    )

    if op.get_bind().dialect.name == "postgresql":
        for old, new in EXACT_REPLACEMENTS + TOKEN_REPLACEMENTS:
            _json_text_replace("audit_events", "event_metadata", old, new)
            _json_text_replace("ai_jobs", "result", old, new)


def downgrade() -> None:
    # Best-effort reversal for labels and identifiers written by the old seed.
    _apply(REVERSE_TOKENS)
    _apply(REVERSE_EXACT)

    op.execute(
        sa.text(
            "UPDATE ai_models SET approval_status = 'demo_only' "
            "WHERE approval_status = 'synthetic_only'"
        )
    )
    op.execute(
        sa.text(
            "UPDATE permissions SET name = "
            "'Kelola konsol operasi, deployment, dan reset data demo' "
            "WHERE code = 'ops:manage'"
        )
    )
