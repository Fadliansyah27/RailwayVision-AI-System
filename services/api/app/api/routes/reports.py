import html
import io
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import AuthContext, require_permission
from app.core.constants import AI_DISCLAIMER
from app.core.errors import AppError
from app.core.inspection_workflow import INSPECTION_STATUSES
from app.core.maintenance_workflow import FINDING_STATUSES, WORK_ORDER_STATUSES
from app.db.session import get_db
from app.models.identity import Scope
from app.models.inspections import Inspection
from app.models.maintenance import Finding, WorkOrder
from app.schemas.common import AssetBrief, UserBrief
from app.schemas.reports import (
    ReportInspectionRow,
    ReportSummaryOut,
    ReportTotals,
)
from app.services.access import accessible_scope_condition
from app.services.audit import record_audit

router = APIRouter(tags=["reports"])

JAKARTA = ZoneInfo("Asia/Jakarta")
PRIMARY_HEX = "C61F33"
MAX_REPORT_ROWS = 2000

INSPECTION_STATUS_LABELS = {
    "draft": "Draf",
    "submitted": "Dikirim",
    "ai_processing": "Menunggu Pemrosesan AI",
    "ai_processed": "AI Selesai Memproses",
    "under_review": "Menunggu Verifikasi",
    "reviewed": "Telah Ditinjau",
    "ai_failed": "Pemrosesan AI Gagal",
    "cancelled": "Dibatalkan",
    "inconclusive": "Tidak Dapat Disimpulkan",
}

INSPECTION_TYPE_LABELS = {
    "routine": "Rutin",
    "detailed": "Terperinci",
    "follow_up": "Tindak Lanjut",
    "emergency": "Darurat",
}


def _resolve_range(
    date_from: date | None, date_to: date | None
) -> tuple[date, date, datetime, datetime]:
    today = datetime.now(JAKARTA).date()
    start_date = date_from or today.replace(day=1)
    end_date = date_to or today
    if start_date > end_date:
        raise AppError(
            422,
            "validation_error",
            "Tanggal awal tidak boleh melewati tanggal akhir.",
        )
    start_utc = datetime.combine(start_date, time.min, tzinfo=JAKARTA).astimezone(UTC)
    end_utc = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=JAKARTA).astimezone(
        UTC
    )
    return start_date, end_date, start_utc, end_utc


async def _status_counts(
    db: AsyncSession,
    model: Any,
    scope_path: str,
    column: Any,
    start_utc: datetime,
    end_utc: datetime,
) -> dict[str, int]:
    rows = (
        await db.execute(
            select(model.status, func.count())
            .join(Scope, model.scope_id == Scope.id)
            .where(
                accessible_scope_condition(scope_path),
                column >= start_utc,
                column < end_utc,
            )
            .group_by(model.status)
        )
    ).all()
    return {status: count for status, count in rows}


def _filled(raw: dict[str, int], statuses: tuple[str, ...]) -> dict[str, int]:
    return {status: raw.get(status, 0) for status in statuses}


async def _load_summary(
    db: AsyncSession,
    ctx: AuthContext,
    start_date: date,
    end_date: date,
    start_utc: datetime,
    end_utc: datetime,
) -> ReportSummaryOut:
    inspection_rows = (
        (
            await db.execute(
                select(Inspection)
                .join(Scope, Inspection.scope_id == Scope.id)
                .options(
                    selectinload(Inspection.asset),
                    selectinload(Inspection.inspector),
                )
                .where(
                    accessible_scope_condition(ctx.scope_path),
                    Inspection.inspected_at >= start_utc,
                    Inspection.inspected_at < end_utc,
                )
                .order_by(Inspection.inspected_at.asc())
                .limit(MAX_REPORT_ROWS)
            )
        )
        .scalars()
        .all()
    )

    inspection_counts = _filled(
        await _status_counts(
            db,
            Inspection,
            ctx.scope_path,
            Inspection.inspected_at,
            start_utc,
            end_utc,
        ),
        INSPECTION_STATUSES,
    )
    finding_counts = _filled(
        await _status_counts(
            db,
            Finding,
            ctx.scope_path,
            Finding.created_at,
            start_utc,
            end_utc,
        ),
        FINDING_STATUSES,
    )
    work_order_counts = _filled(
        await _status_counts(
            db,
            WorkOrder,
            ctx.scope_path,
            WorkOrder.created_at,
            start_utc,
            end_utc,
        ),
        WORK_ORDER_STATUSES,
    )

    return ReportSummaryOut(
        date_from=start_date,
        date_to=end_date,
        generated_at=datetime.now(UTC),
        totals=ReportTotals(
            inspections=sum(inspection_counts.values()),
            findings=sum(finding_counts.values()),
            work_orders=sum(work_order_counts.values()),
        ),
        inspection_counts=inspection_counts,
        finding_counts=finding_counts,
        work_order_counts=work_order_counts,
        inspections=[
            ReportInspectionRow(
                id=inspection.id,
                reference=inspection.reference,
                status=inspection.status,
                inspection_type=inspection.inspection_type,
                asset=AssetBrief.model_validate(inspection.asset),
                inspector=UserBrief(
                    id=inspection.inspector.id,
                    full_name=inspection.inspector.full_name,
                ),
                inspected_at=inspection.inspected_at,
            )
            for inspection in inspection_rows
        ],
    )


def _period_label(summary: ReportSummaryOut) -> str:
    return f"{summary.date_from.strftime('%d-%m-%Y')} s.d. {summary.date_to.strftime('%d-%m-%Y')}"


def _local_time(value: datetime) -> str:
    local = value if value.tzinfo else value.replace(tzinfo=UTC)
    return local.astimezone(JAKARTA).strftime("%d-%m-%Y %H:%M")


def _build_xlsx(summary: ReportSummaryOut) -> bytes:
    workbook = Workbook()
    header_fill = PatternFill("solid", fgColor=PRIMARY_HEX)
    header_font = Font(bold=True, color="FFFFFF")

    sheet = workbook.active
    sheet.title = "Ringkasan"
    rows: list[tuple[str, Any]] = [
        ("Laporan", "RailwayVision AI - Laporan Inspeksi"),
        ("Periode", _period_label(summary)),
        ("Dibuat", _local_time(summary.generated_at) + " WIB"),
        ("Total inspeksi", summary.totals.inspections),
        ("Total temuan baru", summary.totals.findings),
        ("Total perintah kerja baru", summary.totals.work_orders),
        ("", ""),
        ("Status inspeksi", "Jumlah"),
    ]
    for status in INSPECTION_STATUSES:
        rows.append(
            (
                INSPECTION_STATUS_LABELS.get(status, status),
                summary.inspection_counts.get(status, 0),
            )
        )
    rows.extend(
        [
            ("", ""),
            ("Status temuan baru", "Jumlah"),
            *[(status, count) for status, count in summary.finding_counts.items()],
            ("", ""),
            ("Status perintah kerja baru", "Jumlah"),
            *[(status, count) for status, count in summary.work_order_counts.items()],
            ("", ""),
            ("Catatan", AI_DISCLAIMER),
        ]
    )
    for row in rows:
        sheet.append(row)
    for cell in sheet[8]:
        cell.fill = header_fill
        cell.font = header_font
    sheet.column_dimensions["A"].width = 34
    sheet.column_dimensions["B"].width = 70
    sheet["A1"].font = Font(bold=True, size=14, color=PRIMARY_HEX)
    for row in sheet.iter_rows(min_row=1, max_row=sheet.max_row):
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=True)

    detail = workbook.create_sheet("Inspeksi")
    headers = [
        "Referensi",
        "Kode aset",
        "Nama aset",
        "Jenis inspeksi",
        "Status",
        "Inspektur",
        "Tanggal inspeksi",
    ]
    detail.append(headers)
    for cell in detail[1]:
        cell.fill = header_fill
        cell.font = header_font
    for row in summary.inspections:
        detail.append(
            [
                row.reference,
                row.asset.code,
                row.asset.name,
                INSPECTION_TYPE_LABELS.get(row.inspection_type, row.inspection_type),
                INSPECTION_STATUS_LABELS.get(row.status, row.status),
                row.inspector.full_name,
                _local_time(row.inspected_at),
            ]
        )
    widths = [24, 20, 34, 18, 26, 28, 20]
    for index, width in enumerate(widths, start=1):
        detail.column_dimensions[get_column_letter(index)].width = width
    detail.freeze_panes = "A2"

    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _build_pdf(summary: ReportSummaryOut) -> bytes:
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title="Laporan Inspeksi RailwayVision AI",
        author="RailwayVision AI",
    )
    styles = getSampleStyleSheet()
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=8.5, leading=11)
    cell = ParagraphStyle("Cell", parent=body, fontSize=8, leading=10)
    elements: list[Any] = [
        Paragraph(
            "<b>RailwayVision AI - Laporan Inspeksi (SINTETIS)</b>", styles["Title"]
        ),
        Paragraph(f"Periode: {_period_label(summary)}", body),
        Paragraph(f"Dibuat: {_local_time(summary.generated_at)} WIB", body),
        Spacer(1, 4 * mm),
    ]

    summary_rows = [
        ["Total inspeksi", str(summary.totals.inspections)],
        ["Total temuan baru", str(summary.totals.findings)],
        ["Total perintah kerja baru", str(summary.totals.work_orders)],
    ]
    for status in INSPECTION_STATUSES:
        summary_rows.append(
            [
                f"Inspeksi - {INSPECTION_STATUS_LABELS.get(status, status)}",
                str(summary.inspection_counts.get(status, 0)),
            ]
        )
    summary_table = Table(summary_rows, colWidths=[90 * mm, 30 * mm])
    summary_table.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, -1), "Helvetica", 8),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E4E7EC")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F7F8FA")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    elements.append(summary_table)
    elements.append(Spacer(1, 5 * mm))

    table_data: list[list[Any]] = [
        [
            "Referensi",
            "Aset",
            "Jenis",
            "Status",
            "Inspektur",
            "Tanggal inspeksi",
        ]
    ]
    for row in summary.inspections:
        table_data.append(
            [
                row.reference,
                Paragraph(html.escape(f"{row.asset.code} - {row.asset.name}"), cell),
                INSPECTION_TYPE_LABELS.get(row.inspection_type, row.inspection_type),
                INSPECTION_STATUS_LABELS.get(row.status, row.status),
                Paragraph(html.escape(row.inspector.full_name), cell),
                _local_time(row.inspected_at),
            ]
        )
    if len(table_data) == 1:
        table_data.append(["Belum ada inspeksi pada periode ini.", "", "", "", "", ""])

    detail = Table(
        table_data,
        repeatRows=1,
        colWidths=[38 * mm, 62 * mm, 24 * mm, 34 * mm, 38 * mm, 34 * mm],
    )
    detail.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8),
                ("FONT", (0, 1), (-1, -1), "Helvetica", 7.5),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{PRIMARY_HEX}")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E4E7EC")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F8FA")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(detail)
    elements.append(Spacer(1, 5 * mm))
    elements.append(Paragraph(f"<b>Catatan:</b> {html.escape(AI_DISCLAIMER)}", body))
    elements.append(
        Paragraph(
            "Seluruh angka berasal dari basis data operasional sesuai cakupan akun. "
            "Catatan sintetis diberi label SINTETIS dan bukan data operasional KCIC.",
            body,
        )
    )
    document.build(elements)
    return buffer.getvalue()


async def _audit_export(
    db: AsyncSession,
    ctx: AuthContext,
    summary: ReportSummaryOut,
    export_format: str,
) -> None:
    await record_audit(
        db,
        action="report.exported",
        actor=ctx.user,
        target_type="report",
        metadata={
            "format": export_format,
            "date_from": summary.date_from.isoformat(),
            "date_to": summary.date_to.isoformat(),
            "inspections": summary.totals.inspections,
        },
    )
    await db.commit()


@router.get("/reports/summary", response_model=ReportSummaryOut)
async def report_summary(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    ctx: AuthContext = Depends(require_permission("reports:read")),
    db: AsyncSession = Depends(get_db),
) -> ReportSummaryOut:
    start_date, end_date, start_utc, end_utc = _resolve_range(date_from, date_to)
    return await _load_summary(db, ctx, start_date, end_date, start_utc, end_utc)


@router.get("/reports/inspections.xlsx")
async def export_inspections_xlsx(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    ctx: AuthContext = Depends(require_permission("reports:read")),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    start_date, end_date, start_utc, end_utc = _resolve_range(date_from, date_to)
    summary = await _load_summary(db, ctx, start_date, end_date, start_utc, end_utc)
    content = _build_xlsx(summary)
    await _audit_export(db, ctx, summary, "xlsx")
    filename = f"railwayvision-inspeksi-{start_date:%Y%m%d}-{end_date:%Y%m%d}.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type=("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/inspections.pdf")
async def export_inspections_pdf(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    ctx: AuthContext = Depends(require_permission("reports:read")),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    start_date, end_date, start_utc, end_utc = _resolve_range(date_from, date_to)
    summary = await _load_summary(db, ctx, start_date, end_date, start_utc, end_utc)
    content = _build_pdf(summary)
    await _audit_export(db, ctx, summary, "pdf")
    filename = f"railwayvision-inspeksi-{start_date:%Y%m%d}-{end_date:%Y%m%d}.pdf"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


__all__ = ["router"]
