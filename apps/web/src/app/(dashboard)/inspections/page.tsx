"use client";

import {
  ClipboardList,
  ClipboardPlus,
  Info,
  Loader2,
  RefreshCw,
  ShieldX,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import { SyntheticBadge, InspectionStatusChip, Pagination } from "@/components/records";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type InspectionStats,
  type InspectionSummary,
  type Page,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  INSPECTION_STATUS_LABELS,
  INSPECTION_TYPE_LABELS,
  buildQuery,
  formatDateTime,
} from "@/lib/domain";

const PAGE_SIZE = 15;
const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  ...Object.entries(INSPECTION_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

interface InspectionQuery {
  status: string;
  mine: boolean;
  page: number;
}

export default function InspectionsPage() {
  const { token, has, user } = useAuth();
  const [query, setQuery] = useState<InspectionQuery>({ status: "", mine: false, page: 1 });
  const [statusInput, setStatusInput] = useState("");
  const [mineInput, setMineInput] = useState(false);
  const [data, setData] = useState<Page<InspectionSummary> | null>(null);
  const [stats, setStats] = useState<InspectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canWrite = has("inspections:write");

  const loadInspections = useCallback(
    async (current: InspectionQuery) => {
      if (!token) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const page = await apiRequest<Page<InspectionSummary>>(
          `/api/v1/inspections${buildQuery({
            page: current.page,
            page_size: PAGE_SIZE,
            status: current.status,
            mine: current.mine,
          })}`,
          { token },
        );
        setData(page);
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : "Tidak dapat memuat inspeksi.",
        );
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount and on query change; state updates follow the awaited request
    void loadInspections(query);
  }, [loadInspections, query, reloadKey, token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    apiRequest<InspectionStats>("/api/v1/inspections/summary", { token })
      .then((summary) => {
        if (!cancelled) {
          setStats(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStats(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, token]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery({ status: statusInput, mine: mineInput, page: 1 });
  }

  function resetFilters() {
    setStatusInput("");
    setMineInput(false);
    setQuery({ status: "", mine: false, page: 1 });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operasional · Fase 6"
        title="Inspeksi"
        description="Buat draf, kirim, dan pantau catatan inspeksi dalam cakupan organisasi Anda. Unggahan bukti diverifikasi integritasnya; pipeline sintetis berlabel jelas menguji antrean pekerjaan AI tanpa melakukan deteksi kerusakan."
        actions={
          canWrite ? (
            <Link href="/inspections/new" className={primaryButtonClass}>
              <ClipboardPlus className="size-3.5" aria-hidden="true" />
              Inspeksi baru
            </Link>
          ) : null
        }
      />

      <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-soft px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-sm leading-6 text-ink">
          <span className="font-semibold">Hanya catatan inspeksi.</span> Entri ini mendokumentasikan
          observasi; bukan izin keselamatan. Catatan yang telah ditinjau dapat memuat temuan
          terverifikasi manusia dan perintah kerja tindakan perbaikan, yang dilacak terpisah.
        </p>
      </div>

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total dalam cakupan", value: stats.total },
            { label: "Draf", value: stats.counts.draft ?? 0 },
            {
              label: "Menunggu verifikasi manusia",
              value: (stats.counts.submitted ?? 0) + (stats.counts.under_review ?? 0),
            },
            { label: "Telah Ditinjau", value: stats.counts.reviewed ?? 0 },
          ].map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-xs font-medium text-secondary">{item.label}</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-ink">{item.value}</p>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Filter inspeksi"
          description={
            user
              ? `Cakupan ${user.scope.code}. Catatan di luar cakupan tidak dikembalikan API.`
              : undefined
          }
        />
        <form className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={handleFilter}>
          <div>
            <label className={labelClass} htmlFor="inspection-status-filter">
              Status
            </label>
            <select
              id="inspection-status-filter"
              className={`${inputClass} mt-1`}
              value={statusInput}
              onChange={(event) => setStatusInput(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-xs text-ink">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={mineInput}
              onChange={(event) => setMineInput(event.target.checked)}
            />
            Hanya inspeksi yang ditugaskan kepada saya
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className={primaryButtonClass}>
              Terapkan filter
            </button>
            <button type="button" className={secondaryButtonClass} onClick={resetFilters}>
              Atur ulang
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Register inspeksi"
          description={
            data ? `${data.total} inspeksi dalam cakupan Anda` : undefined
          }
          actions={
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className={secondaryButtonClass}
              disabled={loading}
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Muat ulang
            </button>
          }
        />

        {loading ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Memuat inspeksi…
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 px-5 py-8">
            <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink">Inspeksi tidak tersedia</p>
              <p className="mt-1 text-sm text-secondary">{error}</p>
              <button
                type="button"
                className={`${secondaryButtonClass} mt-3`}
                onClick={() => setReloadKey((value) => value + 1)}
              >
                Coba Lagi
              </button>
            </div>
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-5" aria-hidden="true" />}
            title="Tidak ada inspeksi yang cocok"
            description={
              query.status || query.mine
                ? "Hapus atau ubah filter untuk melihat catatan inspeksi lain."
                : canWrite
                  ? "Buat inspeksi draf pertama dari aset atau tombol Inspeksi baru."
                  : "Catatan inspeksi yang dibuat tim lapangan akan tampil di sini."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Referensi
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Aset
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Inspektur
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Jenis
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Diperiksa
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((inspection) => (
                    <tr key={inspection.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/inspections/${inspection.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {inspection.reference}
                          </Link>
                          <SyntheticBadge reference={inspection.reference} />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/assets/${inspection.asset.id}`}
                          className="text-ink hover:text-primary"
                        >
                          {inspection.asset.name}
                        </Link>
                        <p className="font-mono text-[10px] text-secondary">
                          {inspection.asset.code}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-secondary">{inspection.inspector.full_name}</td>
                      <td className="px-5 py-3 text-secondary">
                        {INSPECTION_TYPE_LABELS[inspection.inspection_type] ??
                          inspection.inspection_type}
                      </td>
                      <td className="px-5 py-3 text-secondary">
                        {formatDateTime(inspection.inspected_at)}
                      </td>
                      <td className="px-5 py-3">
                        <InspectionStatusChip status={inspection.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              onPage={(page) => setQuery((current) => ({ ...current, page }))}
            />
          </>
        )}
      </Card>
    </div>
  );
}
