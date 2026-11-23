"use client";

import { Loader2, RefreshCw, ScrollText, Search } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { inputClass, secondaryButtonClass } from "@/components/admin/form-styles";
import { formatDuration, formatTimestamp } from "@/components/operations/format";
import { Card, CardHeader, Chip, EmptyState } from "@/components/ui";
import { apiRequest, ApiError, type OpsLogPage } from "@/lib/api";
import type { Tone } from "@/lib/status";

const LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];

function levelTone(level: string): Tone {
  if (level === "ERROR" || level === "CRITICAL") {
    return "critical";
  }
  if (level === "WARNING") {
    return "warning";
  }
  return "neutral";
}

export function OpsLogViewer({ token }: { token: string }) {
  const [logs, setLogs] = useState<OpsLogPage | null>(null);
  const [level, setLevel] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (level) {
        params.set("level", level);
      }
      if (search) {
        params.set("search", search);
      }
      const data = await apiRequest<OpsLogPage>(`/api/v1/ops/logs?${params}`, { token });
      setLogs(data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat memuat log API.");
    } finally {
      setLoading(false);
    }
  }, [token, level, search]);

  useEffect(() => {
    // Fetch-on-mount: state updates occur only after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setSearch(searchInput.trim());
  }

  return (
    <Card>
      <CardHeader
        title="Log API terbatas"
        description="Cuplikan buffer memori proses API. Catatan lama hilang saat API restart; ini bukan pengganti log agregasi infrastruktur."
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              value={level}
              onChange={(event) => {
                setLoading(true);
                setLevel(event.target.value);
              }}
              aria-label="Filter level log"
              className={`${inputClass} w-auto py-1.5 text-xs`}
            >
              <option value="">Semua level</option>
              {LEVELS.map((value) => (
                <option key={value} value={value}>
                  {value}
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
                  placeholder="Cari pesan"
                  aria-label="Cari pesan log"
                  className={`${inputClass} w-44 py-1.5 pl-8 text-xs`}
                />
              </div>
              <button type="submit" className={secondaryButtonClass}>
                Cari
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className={secondaryButtonClass}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Muat ulang
            </button>
          </div>
        }
      />

      <div className="space-y-4 p-5">
        <p className="rounded-lg border border-border bg-canvas px-3 py-2 text-xs leading-5 text-secondary">
          {logs
            ? `${logs.retained} dari ${logs.capacity} entri tertahan · dibuat ${formatTimestamp(logs.generated_at)}. ${logs.note}`
            : "Memuat keterangan buffer log…"}
        </p>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
          >
            {error}
          </p>
        ) : null}

        {loading && !logs ? (
          <div className="flex items-center gap-2 py-10 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Memuat log…
          </div>
        ) : null}

        {!loading && logs && logs.items.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-5" aria-hidden="true" />}
            title="Tidak ada log yang cocok"
            description="Ubah filter level atau kata kunci. Buffer hanya menyimpan entri sejak proses API terakhir dimulai."
          />
        ) : null}

        {logs && logs.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="rv-table min-w-[820px]">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                  <th className="py-2 pr-3 font-semibold">Waktu</th>
                  <th className="py-2 pr-3 font-semibold">Level</th>
                  <th className="py-2 pr-3 font-semibold">Logger</th>
                  <th className="py-2 pr-3 font-semibold">Pesan</th>
                  <th className="py-2 font-semibold">Konteks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.items.map((entry, index) => (
                  <tr key={`${entry.ts}-${index}`} className="align-top">
                    <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-secondary">
                      {formatTimestamp(entry.ts)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Chip tone={levelTone(entry.level)}>{entry.level}</Chip>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] text-secondary">
                      {entry.logger}
                    </td>
                    <td className="max-w-md py-2.5 pr-3 text-xs leading-5 text-ink">
                      <span className="break-words">{entry.message}</span>
                      {entry.exception ? (
                        <span className="mt-1 block font-mono text-[11px] text-critical">
                          {entry.exception}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-[11px] leading-5 text-secondary">
                      {entry.event ? <span className="block font-mono">event={entry.event}</span> : null}
                      {entry.method && entry.path ? (
                        <span className="block font-mono">
                          {entry.method} {entry.path}
                        </span>
                      ) : null}
                      {entry.status_code !== null ? (
                        <span className="block">status={entry.status_code}</span>
                      ) : null}
                      {entry.duration_ms !== null ? (
                        <span className="block">durasi={formatDuration(entry.duration_ms)}</span>
                      ) : null}
                      {entry.request_id ? (
                        <span className="block truncate font-mono">req={entry.request_id}</span>
                      ) : null}
                      {entry.error_code ? (
                        <span className="block font-mono text-critical">{entry.error_code}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
