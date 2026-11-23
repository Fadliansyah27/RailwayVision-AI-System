"use client";

import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import { InspectionStatusChip } from "@/components/records";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  downloadFile,
  type ReportSummary,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  FINDING_STATUS_LABELS,
  INSPECTION_STATUS_LABELS,
  INSPECTION_TYPE_LABELS,
  WORK_ORDER_STATUS_LABELS,
  buildQuery,
  formatDate,
  formatDateTime,
  formatNumber,
} from "@/lib/domain";

function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
}

function jakartaMonthStart(): string {
  const [year, month] = jakartaToday().split("-");
  return `${year}-${month}-01`;
}

function CountList({
  counts,
  labels,
}: {
  counts: Record<string, number>;
  labels: Record<string, string>;
}) {
  return (
    <ul className="divide-y divide-border">
      {Object.entries(labels).map(([status, label]) => (
        <li key={status} className="flex items-center justify-between gap-3 py-2 text-xs">
          <span className="text-secondary">{label}</span>
          <span className="font-mono text-ink">{formatNumber(counts[status] ?? 0)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReportsPage() {
  const { token } = useAuth();
  const [dateFrom, setDateFrom] = useState(jakartaMonthStart);
  const [dateTo, setDateTo] = useState(jakartaToday);
  const [range, setRange] = useState({ dateFrom: jakartaMonthStart(), dateTo: jakartaToday() });
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const query = buildQuery({
        date_from: range.dateFrom,
        date_to: range.dateTo,
      });
      const data = await apiRequest<ReportSummary>(`/api/v1/reports/summary${query}`, {
        token,
      });
      setSummary(data);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Tidak dapat memuat laporan.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, range]);

  useEffect(() => {
    // Fetch-on-mount: state updates occur only after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function handleApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dateFrom > dateTo) {
      setError("Tanggal awal tidak boleh melewati tanggal akhir.");
      return;
    }
    setRange({ dateFrom, dateTo });
  }

  async function handleExport(format: "pdf" | "xlsx") {
    if (!token) {
      return;
    }
    setExporting(format);
    setExportError(null);
    try {
      const query = buildQuery({
        date_from: range.dateFrom,
        date_to: range.dateTo,
      });
      await downloadFile(
        `/api/v1/reports/inspections.${format}${query}`,
        token,
        `railwayvision-inspeksi.${format}`,
      );
    } catch (caught) {
      setExportError(
        caught instanceof ApiError
          ? caught.message
          : "Tidak dapat mengunduh laporan.",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tata kelola · Fase 8"
        title="Laporan operasional"
        description="Ringkasan inspeksi, temuan, dan perintah kerja dalam periode terpilih. Angka dihitung langsung dari PostgreSQL sesuai cakupan akun dan dapat diunduh sebagai PDF atau Excel."
        actions={
          <>
            <button
              type="button"
              onClick={() => void handleExport("pdf")}
              disabled={exporting !== null || !summary}
              className={secondaryButtonClass}
            >
              {exporting === "pdf" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileText className="size-3.5" aria-hidden="true" />
              )}
              Unduh PDF
            </button>
            <button
              type="button"
              onClick={() => void handleExport("xlsx")}
              disabled={exporting !== null || !summary}
              className={secondaryButtonClass}
            >
              {exporting === "xlsx" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileSpreadsheet className="size-3.5" aria-hidden="true" />
              )}
              Unduh Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!summary}
              className={primaryButtonClass}
            >
              <Printer className="size-3.5" aria-hidden="true" />
              Cetak
            </button>
          </>
        }
      />

      <Card>
        <form
          onSubmit={handleApply}
          className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="report-from" className={labelClass}>
              Tanggal awal
            </label>
            <input
              id="report-from"
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(event) => setDateFrom(event.target.value)}
              className={`${inputClass} w-44`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="report-to" className={labelClass}>
              Tanggal akhir
            </label>
            <input
              id="report-to"
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(event) => setDateTo(event.target.value)}
              className={`${inputClass} w-44`}
            />
          </div>
          <button type="submit" className={primaryButtonClass} disabled={loading}>
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Terapkan periode
          </button>
          <p className="text-[11px] text-secondary">
            Zona waktu Asia/Jakarta. Periode bawaan: awal bulan ini sampai hari ini.
          </p>
        </form>

        <div className="space-y-5 p-5">
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
            >
              {error}
            </p>
          ) : null}
          {exportError ? (
            <p
              role="alert"
              className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
            >
              {exportError}
            </p>
          ) : null}

          {loading && !summary ? (
            <div className="flex items-center gap-2 py-10 text-sm text-secondary">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Memuat laporan…
            </div>
          ) : null}

          {summary ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Inspeksi", value: summary.totals.inspections },
                  { label: "Temuan baru", value: summary.totals.findings },
                  {
                    label: "Perintah kerja baru",
                    value: summary.totals.work_orders,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-border bg-canvas/60 px-4 py-3"
                  >
                    <p className="text-xs font-medium text-secondary">{item.label}</p>
                    <p className="mt-1 font-mono text-2xl font-semibold text-ink">
                      {formatNumber(item.value)}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-secondary">
                Periode {formatDate(summary.date_from)} – {formatDate(summary.date_to)} ·
                dibuat {formatDateTime(summary.generated_at)} WIB
                {summary.inspections.length === 2000
                  ? " · tabel dibatasi 2.000 baris terbaru, ringkasan menghitung seluruh catatan"
                  : ""}
              </p>

              <div className="grid gap-5 lg:grid-cols-3">
                <div>
                  <h3 className="mb-1 text-xs font-semibold text-ink">Status inspeksi</h3>
                  <CountList
                    counts={summary.inspection_counts}
                    labels={INSPECTION_STATUS_LABELS}
                  />
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold text-ink">
                    Status temuan baru
                  </h3>
                  <CountList
                    counts={summary.finding_counts}
                    labels={FINDING_STATUS_LABELS}
                  />
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold text-ink">
                    Status perintah kerja baru
                  </h3>
                  <CountList
                    counts={summary.work_order_counts}
                    labels={WORK_ORDER_STATUS_LABELS}
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-ink">
                  Rincian inspeksi
                </h3>
                {summary.inspections.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="size-5" aria-hidden="true" />}
                    title="Tidak ada inspeksi pada periode ini"
                    description="Ubah rentang tanggal atau catat inspeksi baru untuk mengisi laporan."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="rv-table min-w-[760px]">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                          <th scope="col" className="px-3 py-2 font-semibold">
                            Referensi
                          </th>
                          <th scope="col" className="px-3 py-2 font-semibold">
                            Aset
                          </th>
                          <th scope="col" className="px-3 py-2 font-semibold">
                            Jenis
                          </th>
                          <th scope="col" className="px-3 py-2 font-semibold">
                            Status
                          </th>
                          <th scope="col" className="px-3 py-2 font-semibold">
                            Inspektur
                          </th>
                          <th scope="col" className="px-3 py-2 font-semibold">
                            Tanggal inspeksi
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.inspections.map((row) => (
                          <tr key={row.id} className="border-b border-border last:border-0">
                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink">
                              {row.reference}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-ink">
                              <span className="block font-mono text-[11px] text-secondary">
                                {row.asset.code}
                              </span>
                              {row.asset.name}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-secondary">
                              {INSPECTION_TYPE_LABELS[row.inspection_type] ??
                                row.inspection_type}
                            </td>
                            <td className="px-3 py-2.5">
                              <InspectionStatusChip status={row.status} />
                            </td>
                            <td className="px-3 py-2.5 text-xs text-secondary">
                              {row.inspector.full_name}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-secondary">
                              {formatDateTime(row.inspected_at)} WIB
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <p className="flex items-center gap-1.5 border-t border-border pt-4 text-[11px] leading-5 text-secondary">
                <Download className="size-3.5 shrink-0" aria-hidden="true" />
                Ekspor PDF dan Excel mencantumkan periode, cakupan, dan catatan bahwa sistem ini
                adalah alat bantu keputusan tanpa keputusan keselamatan otomatis.
              </p>
            </>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
