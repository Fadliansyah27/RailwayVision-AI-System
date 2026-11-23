"use client";

import { ChevronLeft, ChevronRight, Cpu, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { inputClass, secondaryButtonClass } from "@/components/admin/form-styles";
import { formatTimestamp } from "@/components/operations/format";
import { Card, CardHeader, Chip, EmptyState } from "@/components/ui";
import { apiRequest, ApiError, type OpsAIJob, type Page } from "@/lib/api";
import type { Tone } from "@/lib/status";

const PAGE_SIZE = 20;

const JOB_STATUS_LABELS: Record<string, string> = {
  queued: "Menunggu",
  running: "Berjalan",
  succeeded: "Berhasil",
  failed: "Gagal",
};

function jobStatusTone(status: string): Tone {
  if (status === "succeeded") {
    return "success";
  }
  if (status === "failed") {
    return "critical";
  }
  if (status === "running" || status === "queued") {
    return "warning";
  }
  return "neutral";
}

export function AIJobHistory({ token }: { token: string }) {
  const [jobs, setJobs] = useState<Page<OpsAIJob> | null>(null);
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (status) {
        params.set("status", status);
      }
      if (search) {
        params.set("search", search);
      }
      const data = await apiRequest<Page<OpsAIJob>>(`/api/v1/ops/ai-jobs?${params}`, { token });
      setJobs(data);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Tidak dapat memuat riwayat pekerjaan AI.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, page, status, search]);

  useEffect(() => {
    // Fetch-on-mount: state updates occur only after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleStatus(value: string) {
    setLoading(true);
    setPage(1);
    setStatus(value);
  }

  const totalPages = jobs ? Math.max(1, Math.ceil(jobs.total / PAGE_SIZE)) : 1;

  return (
    <Card>
      <CardHeader
        title="Riwayat pekerjaan AI"
        description="Antrean dan hasil pipeline AI dalam cakupan organisasi Anda. Semua keluaran bersifat saran dan memerlukan verifikasi manusia."
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              value={status}
              onChange={(event) => handleStatus(event.target.value)}
              aria-label="Filter status pekerjaan AI"
              className={`${inputClass} w-auto py-1.5 text-xs`}
            >
              <option value="">Semua status</option>
              {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <form className="flex gap-2" onSubmit={handleSearch}>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-secondary"
                  aria-hidden="true"
                />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Referensi atau berkas"
                  aria-label="Cari referensi inspeksi atau nama berkas"
                  className={`${inputClass} w-48 py-1.5 pl-8 text-xs`}
                />
              </div>
              <button type="submit" className={secondaryButtonClass}>
                Cari
              </button>
            </form>
          </div>
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

        {loading && !jobs ? (
          <div className="flex items-center gap-2 py-10 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Memuat pekerjaan AI…
          </div>
        ) : null}

        {!loading && jobs && jobs.items.length === 0 ? (
          <EmptyState
            icon={<Cpu className="size-5" aria-hidden="true" />}
            title="Belum ada pekerjaan AI"
            description="Antrekan pemeriksaan dari panel bukti sebuah inspeksi. Pekerjaan yang berjalan akan muncul di sini tanpa penyegaran manual."
          />
        ) : null}

        {jobs && jobs.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="rv-table min-w-[880px]">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                  <th className="py-2 pr-3 font-semibold">Dibuat</th>
                  <th className="py-2 pr-3 font-semibold">Inspeksi</th>
                  <th className="py-2 pr-3 font-semibold">Berkas</th>
                  <th className="py-2 pr-3 font-semibold">Model</th>
                  <th className="py-2 pr-3 font-semibold">Diminta oleh</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.items.map((job) => (
                  <tr key={job.id} className="align-top">
                    <td className="py-2.5 pr-3 text-xs text-secondary">
                      {formatTimestamp(job.created_at)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="font-mono text-xs text-ink">{job.inspection_reference}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-secondary">{job.media_filename}</td>
                    <td className="py-2.5 pr-3 text-xs text-secondary">
                      <span className="block font-mono text-[11px] text-ink">{job.model.code}</span>
                      <span>v{job.model.version}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-secondary">
                      {job.requested_by.full_name}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Chip tone={jobStatusTone(job.status)}>
                        {JOB_STATUS_LABELS[job.status] ?? job.status}
                      </Chip>
                    </td>
                    <td className="py-2.5 text-xs text-secondary">
                      {job.error_code ? (
                        <span className="font-mono text-[11px] text-critical">{job.error_code}</span>
                      ) : job.finished_at ? (
                        <span>Selesai {formatTimestamp(job.finished_at)}</span>
                      ) : job.started_at ? (
                        <span>Mulai {formatTimestamp(job.started_at)}</span>
                      ) : (
                        "Belum dimulai"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {jobs && jobs.total > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
            <span>
              {jobs.total} pekerjaan · halaman {jobs.page} dari {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setPage((value) => Math.max(1, value - 1));
                }}
                disabled={page <= 1}
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
                disabled={page >= totalPages}
                className={secondaryButtonClass}
              >
                Berikutnya
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
