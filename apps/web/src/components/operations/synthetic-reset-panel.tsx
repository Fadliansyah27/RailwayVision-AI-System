"use client";

import { AlertTriangle, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { inputClass, labelClass, secondaryButtonClass } from "@/components/admin/form-styles";
import { formatTimestamp } from "@/components/operations/format";
import { Card, CardHeader, Chip } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type SyntheticResetPreview,
  type SyntheticResetResult,
} from "@/lib/api";

const COUNT_LABELS: Record<string, string> = {
  inspections: "Inspeksi",
  inspection_reviews: "Tinjauan inspeksi",
  checklist_results: "Hasil checklist",
  ai_jobs: "Pekerjaan AI",
  media_objects: "Objek media",
  findings: "Temuan",
  work_orders: "Perintah kerja",
  notifications: "Notifikasi",
  assets: "Aset",
  locations: "Lokasi",
};

const CLEANUP_LABELS: Record<string, string> = {
  not_needed: "Tidak diperlukan",
  completed: "Selesai",
  partial: "Sebagian gagal",
  unavailable: "Penyimpanan tidak tersedia",
};

export function SyntheticResetPanel({ token }: { token: string }) {
  const [preview, setPreview] = useState<SyntheticResetPreview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<SyntheticResetResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<SyntheticResetPreview>(
        "/api/v1/ops/synthetic-reset/preview",
        { token },
      );
      setPreview(data);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Tidak dapat menghitung rencana reset data sintetis.",
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || confirmation.trim() !== preview.confirmation_phrase) {
      return;
    }
    setResetting(true);
    setError(null);
    try {
      const data = await apiRequest<SyntheticResetResult>("/api/v1/ops/synthetic-reset", {
        method: "POST",
        token,
        body: { confirm: confirmation.trim() },
      });
      setResult(data);
      setConfirmation("");
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Reset data sintetis gagal.");
    } finally {
      setResetting(false);
    }
  }

  const canReset =
    preview !== null &&
    preview.enabled &&
    preview.total > 0 &&
    confirmation.trim() === preview.confirmation_phrase;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Reset data sintetis"
          description="Menghapus data transaksi milik cakupan sintetis. Akun, cakupan, kategori, dan template tetap dipertahankan."
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
              Hitung ulang
            </button>
          }
        />
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning-soft p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-xs leading-5 text-secondary">
              Tindakan ini tidak dapat dibatalkan. Reset hanya tersedia pada lingkungan local atau
              test, dibatasi izin <code className="font-mono">ops:manage</code>, dan dicatat pada
              riwayat audit sebagai <code className="font-mono">synthetic_data.reset</code>.
            </p>
          </div>

          {loading && !preview ? (
            <div className="flex items-center gap-2 py-8 text-sm text-secondary">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Menghitung data sintetis…
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

          {preview ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                <Chip tone={preview.enabled ? "success" : "neutral"}>
                  {preview.enabled ? "Reset diaktifkan" : "Reset dinonaktifkan"}
                </Chip>
                <span>
                  Lingkungan <span className="font-mono">{preview.environment}</span> · cakupan{" "}
                  {preview.scope_codes.length > 0 ? preview.scope_codes.join(", ") : "tidak ditemukan"}
                </span>
              </div>

              {preview.reason ? (
                <p className="rounded-lg border border-border bg-canvas px-3 py-2 text-xs leading-5 text-secondary">
                  {preview.reason}
                </p>
              ) : null}

              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(preview.counts).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="text-xs text-secondary">{COUNT_LABELS[key] ?? key}</span>
                    <span className="text-sm font-semibold text-ink">{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs font-semibold text-ink">
                Total baris yang akan dihapus: {preview.total}
              </p>

              <form className="flex flex-wrap items-end gap-3" onSubmit={handleSubmit}>
                <label className="min-w-64 flex-1 space-y-1">
                  <span className={labelClass}>
                    Ketik frasa konfirmasi:{" "}
                    <code className="font-mono text-primary">{preview.confirmation_phrase}</code>
                  </span>
                  <input
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    disabled={!preview.enabled || resetting}
                    className={`${inputClass} font-mono`}
                    placeholder={preview.confirmation_phrase}
                  />
                </label>
                <button
                  type="submit"
                  disabled={!canReset || resetting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetting ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  )}
                  Hapus data sintetis
                </button>
              </form>
            </>
          ) : null}
        </div>
      </Card>

      {result ? (
        <Card>
          <CardHeader
            title="Hasil reset"
            description="Dihapus melalui API dan dicatat pada audit. Objek penyimpanan dibersihkan setelah transaksi basis data."
          />
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
              <Chip tone={result.storage_failures === 0 ? "success" : "warning"}>
                Media: {CLEANUP_LABELS[result.storage_cleanup] ?? result.storage_cleanup}
              </Chip>
              <span>
                {result.storage_objects_deleted} objek dihapus · {result.storage_failures} gagal ·{" "}
                {formatTimestamp(result.completed_at)}
              </span>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(result.deleted).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <dt className="text-xs text-secondary">{COUNT_LABELS[key] ?? key}</dt>
                  <dd className="font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs font-semibold text-ink">
              Total {result.total} baris dihapus. Halaman lain akan menampilkan data terkini pada
              pemuatan berikutnya.
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
