"use client";

import { DatabaseBackup, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { secondaryButtonClass } from "@/components/admin/form-styles";
import { formatBytes, formatTimestamp } from "@/components/operations/format";
import { Card, CardHeader, Chip } from "@/components/ui";
import { apiRequest, ApiError, type BackupStatus } from "@/lib/api";
import type { Tone } from "@/lib/status";

const STATUS_LABELS: Record<string, string> = {
  ok: "Dalam batas umur",
  stale: "Kedaluwarsa",
  unavailable: "Tidak tersedia",
  invalid: "Tidak valid",
  not_configured: "Belum dikonfigurasi",
};

function statusTone(status: string): Tone {
  if (status === "ok") {
    return "success";
  }
  if (status === "stale") {
    return "warning";
  }
  if (status === "unavailable" || status === "invalid") {
    return "critical";
  }
  return "neutral";
}

export function BackupStatusPanel({ token }: { token: string }) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<BackupStatus>("/api/v1/ops/backup", { token });
      setStatus(data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat membaca status backup.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Fetch-on-mount: state updates occur only after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader
        title="Status backup"
        description="Dibaca dari berkas status yang dikonfigurasi administrator. Konsol tidak menjalankan backup dan tidak menyimpulkan kesehatan di luar isi berkas."
        actions={
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className={secondaryButtonClass}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Periksa
          </button>
        }
      />

      <div className="space-y-4 p-5">
        {loading && !status ? (
          <div className="flex items-center gap-2 py-10 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Membaca status backup…
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
          >
            {error}
          </p>
        ) : null}

        {status ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <DatabaseBackup className="size-5 text-primary" aria-hidden="true" />
              <Chip tone={statusTone(status.status)}>
                {STATUS_LABELS[status.status] ?? status.status}
              </Chip>
              <span className="text-xs text-secondary">
                Diperiksa {formatTimestamp(status.checked_at)} · batas umur {status.max_age_hours} jam
              </span>
            </div>

            <p className="rounded-lg border border-border bg-canvas px-3 py-2 text-xs leading-5 text-secondary">
              {status.detail}
            </p>

            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Backup terakhir
                </dt>
                <dd className="mt-1 text-ink">{formatTimestamp(status.last_backup_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Umur
                </dt>
                <dd className="mt-1 text-ink">
                  {status.age_hours === null ? "—" : `${status.age_hours} jam`}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Ukuran
                </dt>
                <dd className="mt-1 text-ink">{formatBytes(status.size_bytes)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Uji pemulihan terakhir
                </dt>
                <dd className="mt-1 text-ink">{formatTimestamp(status.last_restore_test_at)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Checksum SHA-256
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-ink">
                  {status.checksum_sha256 ?? "Tidak dilaporkan"}
                </dd>
              </div>
            </dl>

            {!status.configured ? (
              <p className="text-xs leading-5 text-secondary">
                Administrator dapat mengatur <code className="font-mono">BACKUP_STATUS_FILE</code>{" "}
                pada layanan API. Selama belum diatur, status backup tidak diklaim sehat.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}
