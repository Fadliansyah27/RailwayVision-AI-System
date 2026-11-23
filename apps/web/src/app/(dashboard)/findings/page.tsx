"use client";

import { AlertTriangle, Info, Loader2, RefreshCw, ShieldX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import {
  DemoBadge,
  FindingPriorityChip,
  FindingStatusChip,
  Pagination,
} from "@/components/records";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type Finding,
  type FindingStats,
  type Page,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  FINDING_PRIORITY_LABELS,
  FINDING_STATUS_LABELS,
  buildQuery,
  formatDateTime,
} from "@/lib/domain";

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  ...Object.entries(FINDING_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

interface FindingQuery {
  status: string;
  priority: string;
  search: string;
  mine: boolean;
  page: number;
}

export default function FindingsPage() {
  const { token, user } = useAuth();
  const [query, setQuery] = useState<FindingQuery>({
    status: "",
    priority: "",
    search: "",
    mine: false,
    page: 1,
  });
  const [statusInput, setStatusInput] = useState("");
  const [priorityInput, setPriorityInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [mineInput, setMineInput] = useState(false);
  const [data, setData] = useState<Page<Finding> | null>(null);
  const [stats, setStats] = useState<FindingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadFindings = useCallback(
    async (current: FindingQuery) => {
      if (!token) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const page = await apiRequest<Page<Finding>>(
          `/api/v1/findings${buildQuery({
            page: current.page,
            page_size: PAGE_SIZE,
            status: current.status,
            priority: current.priority,
            search: current.search,
            mine: current.mine,
          })}`,
          { token },
        );
        setData(page);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "Tidak dapat memuat temuan.");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount and on query change
    void loadFindings(query);
  }, [loadFindings, query, reloadKey, token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    apiRequest<FindingStats>("/api/v1/findings/summary", { token })
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
    setQuery({
      status: statusInput,
      priority: priorityInput,
      search: searchInput.trim(),
      mine: mineInput,
      page: 1,
    });
  }

  function resetFilters() {
    setStatusInput("");
    setPriorityInput("");
    setSearchInput("");
    setMineInput(false);
    setQuery({ status: "", priority: "", search: "", mine: false, page: 1 });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operasional · Fase 7"
        title="Temuan"
        description="Observasi tindak lanjut yang dicatat manusia dan terhubung ke inspeksi yang telah ditinjau. Temuan adalah catatan pemeliharaan, bukan vonis keselamatan."
      />

      <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-soft px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-sm leading-6 text-ink">
          <span className="font-semibold">Hanya pelacakan pemeliharaan.</span> Temuan dan perintah
          kerja mendokumentasikan aktivitas tindak lanjut. Keduanya tidak menyatakan aset aman atau
          tidak aman dan tidak menggantikan prosedur KCIC yang disetujui.
        </p>
      </div>

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total dalam cakupan", value: stats.total },
            { label: "Terkonfirmasi", value: stats.counts.confirmed ?? 0 },
            {
              label: "Dalam tindakan perbaikan",
              value:
                (stats.counts.assigned ?? 0) +
                (stats.counts.in_progress ?? 0) +
                (stats.counts.awaiting_verification ?? 0),
            },
            { label: "Selesai", value: stats.counts.closed ?? 0 },
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
          title="Filter temuan"
          description={
            user
              ? `Cakupan ${user.scope.code}. Catatan di luar cakupan tidak dikembalikan API.`
              : undefined
          }
        />
        <form className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5" onSubmit={handleFilter}>
          <div>
            <label className={labelClass} htmlFor="finding-status-filter">
              Status
            </label>
            <select
              id="finding-status-filter"
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
          <div>
            <label className={labelClass} htmlFor="finding-priority-filter">
              Prioritas
            </label>
            <select
              id="finding-priority-filter"
              className={`${inputClass} mt-1`}
              value={priorityInput}
              onChange={(event) => setPriorityInput(event.target.value)}
            >
              <option value="">Semua prioritas</option>
              {Object.entries(FINDING_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="finding-search">
              Cari
            </label>
            <input
              id="finding-search"
              className={`${inputClass} mt-1`}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              maxLength={120}
              placeholder="Referensi atau judul"
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-xs text-ink">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={mineInput}
              onChange={(event) => setMineInput(event.target.checked)}
            />
            Dicatat oleh saya
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
          title="Register temuan"
          description={data ? `${data.total} temuan dalam cakupan Anda` : undefined}
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
            Memuat temuan…
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 px-5 py-8">
            <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink">Temuan tidak tersedia</p>
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
            icon={<AlertTriangle className="size-5" aria-hidden="true" />}
            title="Tidak ada temuan yang cocok"
            description="Peninjau mencatat temuan dari inspeksi yang telah ditinjau atau tidak dapat disimpulkan."
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
                      Judul
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Aset
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Prioritas
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Dicatat
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((finding) => (
                    <tr key={finding.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/findings/${finding.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {finding.reference}
                          </Link>
                          <DemoBadge reference={finding.reference} />
                        </div>
                      </td>
                      <td className="max-w-72 px-5 py-3 text-ink">{finding.title}</td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/assets/${finding.asset.id}`}
                          className="text-ink hover:text-primary"
                        >
                          {finding.asset.name}
                        </Link>
                        <p className="font-mono text-[10px] text-secondary">
                          {finding.asset.code}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <FindingPriorityChip priority={finding.priority} />
                      </td>
                      <td className="px-5 py-3 text-secondary">
                        {formatDateTime(finding.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <FindingStatusChip status={finding.status} />
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
