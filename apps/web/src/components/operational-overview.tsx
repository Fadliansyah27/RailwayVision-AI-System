"use client";

import {
  ArrowRight,
  ClipboardList,
  Clock,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { InspectionStatusChip } from "@/components/records";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { apiRequest, ApiError, type DashboardOverview } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  FINDING_STATUS_LABELS,
  WORK_ORDER_STATUS_LABELS,
  formatDateTime,
  formatNumber,
} from "@/lib/domain";

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof ClipboardList;
  href: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-secondary">{label}</p>
        <Icon className="size-4 text-primary/70" aria-hidden="true" />
      </div>
      <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-ink">
        {formatNumber(value)}
      </p>
      <p className="mt-2 text-xs leading-5 text-secondary">{hint}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-strong"
      >
        Lihat detail
        <ArrowRight className="size-3" aria-hidden="true" />
      </Link>
    </Card>
  );
}

function TrendChart({ overview }: { overview: DashboardOverview }) {
  const points = overview.inspection_trend;
  const max = Math.max(...points.map((point) => point.count), 1);
  const description = points
    .map((point) => `${point.label}: ${point.count}`)
    .join(", ");

  return (
    <div role="img" aria-label={`Tren inspeksi enam bulan terakhir. ${description}.`}>
      <div className="flex h-44 items-end gap-3 px-1">
        {points.map((point) => (
          <div key={point.month} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] font-medium text-ink">
              {formatNumber(point.count)}
            </span>
            <div className="flex h-28 w-full items-end rounded bg-canvas/70">
              <div
                className={`w-full rounded-t ${point.count ? "bg-primary" : "bg-border"}`}
                style={{
                  height: point.count ? `${Math.max((point.count / max) * 100, 6)}%` : "3%",
                }}
              />
            </div>
            <span className="text-[10px] text-secondary">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionList({
  counts,
  labels,
}: {
  counts: Record<string, number>;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(labels).map(([status, label]) => ({
    status,
    label,
    count: counts[status] ?? 0,
  }));
  const max = Math.max(...entries.map((entry) => entry.count), 1);

  return (
    <ul className="space-y-2.5">
      {entries.map((entry) => (
        <li key={entry.status}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className={entry.count ? "text-secondary" : "text-secondary/60"}>
              {entry.label}
            </span>
            <span
              className={`font-mono ${entry.count ? "text-ink" : "text-secondary/60"}`}
            >
              {formatNumber(entry.count)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${(entry.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OperationalOverview() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<DashboardOverview>("/api/v1/dashboard/overview", {
        token,
      });
      setOverview(data);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Tidak dapat memuat ringkasan operasional.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Fetch-on-mount: state updates occur only after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error) {
    return (
      <Card className="p-5">
        <p
          role="alert"
          className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
        >
          {error}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Coba lagi
        </button>
      </Card>
    );
  }

  if (!overview || loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item} className="space-y-3 p-5">
              <div className="h-3 w-2/3 animate-pulse rounded bg-canvas" />
              <div className="h-8 w-1/3 animate-pulse rounded bg-canvas" />
              <div className="h-3 w-full animate-pulse rounded bg-canvas" />
            </Card>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-secondary">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Memuat ringkasan operasional…
        </div>
      </div>
    );
  }

  const { inspections, findings, work_orders } = overview;
  const trendEmpty = overview.inspection_trend.every((point) => point.count === 0);
  const hasAnyData = inspections.total + findings.total + work_orders.total > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total inspeksi"
          value={inspections.total}
          hint={`${formatNumber(inspections.this_month)} inspeksi tercatat bulan ini.`}
          icon={ClipboardList}
          href="/inspections"
        />
        <KpiCard
          label="Menunggu verifikasi manusia"
          value={inspections.awaiting_review}
          hint={`${formatNumber(
            inspections.counts.submitted ?? 0,
          )} dikirim · ${formatNumber(
            inspections.counts.ai_processed ?? 0,
          )} selesai diproses AI.`}
          icon={Clock}
          href="/inspections"
        />
        <KpiCard
          label="Temuan terbuka"
          value={findings.open}
          hint={`${formatNumber(
            findings.total,
          )} temuan tercatat dari inspeksi yang telah ditinjau manusia.`}
          icon={TriangleAlert}
          href="/findings"
        />
        <KpiCard
          label="Perintah kerja aktif"
          value={work_orders.active}
          hint={`${formatNumber(
            work_orders.overdue,
          )} melewati ${overview.overdue_after_days} hari sejak dibuat.`}
          icon={Wrench}
          href="/work-orders"
        />
      </div>

      {!hasAnyData ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="size-5" aria-hidden="true" />}
            title="Data operasional belum tersedia"
            description="Dasbor akan terisi otomatis dari PostgreSQL setelah inspeksi pertama dicatat. Akun dan catatan bersifat sintetis dan diberi label SINTETIS."
          />
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Tren inspeksi"
            description="Jumlah inspeksi berdasarkan tanggal inspeksi, enam bulan terakhir (WIB)."
            actions={
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
              >
                <RefreshCw className="size-3" aria-hidden="true" />
                Muat ulang
              </button>
            }
          />
          <div className="p-5">
            {trendEmpty ? (
              <EmptyState
                icon={<ClipboardList className="size-5" aria-hidden="true" />}
                title="Belum ada inspeksi pada periode ini"
                description="Buat inspeksi baru untuk mulai mengisi tren aktivitas. Angka berasal langsung dari catatan inspeksi dalam cakupan Anda."
              />
            ) : (
              <TrendChart overview={overview} />
            )}
            <p className="mt-4 text-[11px] text-secondary">
              Terakhir diperbarui {formatDateTime(overview.generated_at)} WIB · sumber:
              agregasi PostgreSQL sesuai cakupan akun.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Status temuan"
            description="Temuan hanya dibuat dari inspeksi yang telah ditinjau manusia."
          />
          <div className="p-5">
            {findings.total === 0 ? (
              <EmptyState
                icon={<TriangleAlert className="size-5" aria-hidden="true" />}
                title="Belum ada temuan"
                description="Temuan muncul setelah peninjau mencatat tindak lanjut pada inspeksi yang telah ditinjau."
              />
            ) : (
              <DistributionList
                counts={findings.counts}
                labels={FINDING_STATUS_LABELS}
              />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Inspeksi terbaru"
            description="Lima inspeksi terbaru berdasarkan tanggal inspeksi."
          />
          {overview.recent_inspections.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-5" aria-hidden="true" />}
              title="Belum ada inspeksi tercatat"
              description="Mulai dari menu Inspeksi untuk mencatat pemeriksaan aset di lapangan."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                    <th scope="col" className="px-5 py-2.5 font-semibold">
                      Referensi
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">
                      Aset
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">
                      Tanggal inspeksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recent_inspections.map((inspection) => (
                    <tr
                      key={inspection.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-5 py-2.5">
                        <Link
                          href={`/inspections/${inspection.id}`}
                          className="font-mono text-xs font-semibold text-primary hover:text-primary-strong"
                        >
                          {inspection.reference}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-ink">
                        <span className="font-mono text-[11px] text-secondary">
                          {inspection.asset.code}
                        </span>
                        <span className="block">{inspection.asset.name}</span>
                      </td>
                      <td className="px-5 py-2.5">
                        <InspectionStatusChip status={inspection.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-xs text-secondary">
                        {formatDateTime(inspection.inspected_at)} WIB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Status perintah kerja"
            description="Perintah kerja aktif adalah yang belum selesai atau dibatalkan."
          />
          <div className="p-5">
            {work_orders.total === 0 ? (
              <EmptyState
                icon={<Wrench className="size-5" aria-hidden="true" />}
                title="Belum ada perintah kerja"
                description="Supervisor dapat membuat perintah kerja dari temuan terverifikasi untuk melacak tindakan perbaikan."
              />
            ) : (
              <DistributionList
                counts={work_orders.counts}
                labels={WORK_ORDER_STATUS_LABELS}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
