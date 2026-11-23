"use client";

import { ChevronLeft, ChevronRight, Loader2, ScrollText, Search } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { inputClass, secondaryButtonClass } from "@/components/admin/form-styles";
import { Card, CardHeader, Chip, EmptyState, PageHeader } from "@/components/ui";
import { apiRequest, ApiError, type AuditEvent, type Page } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const PAGE_SIZE = 25;

const OUTCOME_LABELS: Record<string, string> = {
  success: "Berhasil",
  failure: "Gagal",
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  });
}

export default function AuditPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<Page<AuditEvent> | null>(null);
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (query) {
        params.set("action", query);
      }
      const data = await apiRequest<Page<AuditEvent>>(`/api/v1/audit-events?${params}`, {
        token,
      });
      setEvents(data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat memuat peristiwa audit.");
    } finally {
      setLoading(false);
    }
  }, [token, page, query]);

  useEffect(() => {
    // Fetch-on-mount: state updates occur only after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = action.trim();
    setLoading(true);
    if (page === 1 && term === query) {
      void load();
    } else {
      setPage(1);
      setQuery(term);
    }
  }

  const totalPages = events ? Math.max(1, Math.ceil(events.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tata kelola · Fase 2"
        title="Riwayat aktivitas"
        description="Catatan hanya-tambah untuk autentikasi dan tindakan alur kerja material. Peristiwa dibatasi pada cakupan organisasi akun Anda."
      />

      <Card>
        <CardHeader
          title="Peristiwa tercatat"
          description="Terbaru lebih dulu. Filter berdasarkan nama tindakan persis, misalnya auth.login atau inspection.created."
          actions={
            <form className="flex gap-2" onSubmit={handleFilter}>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-secondary"
                  aria-hidden="true"
                />
                <input
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                  placeholder="Filter tindakan"
                  aria-label="Filter berdasarkan tindakan audit"
                  className={`${inputClass} w-48 py-1.5 pl-8 text-xs`}
                />
              </div>
              <button type="submit" className={secondaryButtonClass}>
                Terapkan
              </button>
            </form>
          }
        />

        <div className="space-y-4 p-5">
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
            >
              {error}
            </p>
          ) : null}

          {loading && !events ? (
            <div className="flex items-center gap-2 py-10 text-sm text-secondary">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Memuat peristiwa audit…
            </div>
          ) : null}

          {!loading && events && events.items.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="size-5" aria-hidden="true" />}
              title="Tidak ada peristiwa yang cocok"
              description="Catatan audit muncul saat pengguna masuk dan melakukan tindakan alur kerja material."
            />
          ) : null}

          {events && events.items.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="rv-table min-w-[860px]">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Waktu
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Tindakan
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Pelaku
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Target
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Hasil
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Permintaan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.items.map((event) => (
                      <tr key={event.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-secondary">
                          {formatTimestamp(event.created_at)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-ink">
                          {event.action}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-ink">
                          {event.actor_label ?? "sistem"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-secondary">
                          {event.target_type ? (
                            <>
                              <span className="text-ink">{event.target_type}</span>
                              {event.target_id ? (
                                <span
                                  className="block max-w-[20ch] truncate font-mono text-[10px]"
                                  title={event.target_id}
                                >
                                  {event.target_id}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Chip tone={event.outcome === "failure" ? "critical" : "success"}>
                            {OUTCOME_LABELS[event.outcome] ?? event.outcome}
                          </Chip>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-secondary">
                          {event.request_id ? (
                            <span
                              className="block max-w-[26ch] truncate"
                              title={event.request_id}
                            >
                              {event.request_id}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-secondary">
                  {events.total} peristiwa · halaman {events.page} dari {totalPages}
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      setPage((value) => Math.max(1, value - 1));
                    }}
                    disabled={page <= 1 || loading}
                    className={secondaryButtonClass}
                  >
                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      setPage((value) => Math.min(totalPages, value + 1));
                    }}
                    disabled={page >= totalPages || loading}
                    className={secondaryButtonClass}
                  >
                    Berikutnya
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
