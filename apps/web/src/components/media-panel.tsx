"use client";

import {
  Bot,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileWarning,
  ImageOff,
  ImagePlus,
  Loader2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import { Card, CardHeader, Chip, EmptyState } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  fetchMediaBlob,
  uploadMediaContent,
  type AIJob,
  type MediaObject,
  type Page,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/domain";
import {
  JOB_STATUS_LABELS,
  MEDIA_STATUS_LABELS,
  QUALITY_FLAG_LABELS,
  formatBytes,
  isJobActive,
  jobErrorLabel,
  jobStatusTone,
  mediaStatusTone,
  quarantineReasonLabel,
  shortSha,
} from "@/lib/media";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const POLL_MS = 3000;
const CLOSED_STATUSES = ["reviewed", "cancelled", "inconclusive"];
const AI_QUEUE_STATUSES = ["submitted", "ai_processed", "ai_failed"];

async function fileSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readError(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

export function MediaPanel({
  inspectionId,
  inspectionStatus,
  inspectorId,
  onActivity,
}: {
  inspectionId: string;
  inspectionStatus: string;
  inspectorId: string;
  onActivity?: () => void;
}) {
  const { token, user, has } = useAuth();
  const [media, setMedia] = useState<MediaObject[]>([]);
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [openPreview, setOpenPreview] = useState<string | null>(null);
  const [busyMedia, setBusyMedia] = useState<string | null>(null);
  const [mediaKey, setMediaKey] = useState(0);
  const [jobsKey, setJobsKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  const pendingJobsRef = useRef<number | null>(null);

  const canRead = has("media:read");
  const canUploadPermission = has("media:upload");
  const canEnqueue = has("ai:enqueue");
  const canSeeJobs = has("detections:read");
  const attachable =
    canUploadPermission &&
    !CLOSED_STATUSES.includes(inspectionStatus) &&
    (inspectorId === user?.id || has("inspections:manage"));
  const canQueueJob = canEnqueue && AI_QUEUE_STATUSES.includes(inspectionStatus);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    if (!token || !canRead) {
      return;
    }
    let cancelled = false;
    apiRequest<Page<MediaObject>>(`/api/v1/inspections/${inspectionId}/media`, { token })
      .then((page) => {
        if (!cancelled) {
          setMedia(page.items);
          setMediaError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setMediaError(readError(caught, "Tidak dapat memuat bukti untuk inspeksi ini."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMedia(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, inspectionId, mediaKey, token]);

  useEffect(() => {
    if (!token || !canSeeJobs) {
      return;
    }
    let cancelled = false;
    apiRequest<Page<AIJob>>(`/api/v1/inspections/${inspectionId}/ai-jobs`, { token })
      .then((page) => {
        if (cancelled) {
          return;
        }
        const pending = page.items.filter(isJobActive).length;
        if (pendingJobsRef.current !== null && pendingJobsRef.current > 0 && pending === 0) {
          onActivity?.();
        }
        pendingJobsRef.current = pending;
        setJobs(page.items);
        setJobsError(null);
      })
      .catch((caught) => {
        if (!cancelled) {
          setJobsError(readError(caught, "Tidak dapat memuat pekerjaan analisis demo."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingJobs(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canSeeJobs, inspectionId, jobsKey, onActivity, token]);

  useEffect(() => {
    if (!jobs.some(isJobActive)) {
      return;
    }
    const timer = setTimeout(() => setJobsKey((value) => value + 1), POLL_MS);
    return () => clearTimeout(timer);
  }, [jobs]);

  async function handleUpload(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!file) {
      setUploadError("Pilih gambar untuk diunggah.");
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("Hanya gambar JPEG, PNG, dan WebP yang diterima.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("Gambar ini melebihi batas unggahan 10 MiB.");
      return;
    }
    if (!globalThis.crypto?.subtle) {
      setUploadError(
        "Menghitung SHA-256 memerlukan konteks peramban aman (HTTPS atau localhost).",
      );
      return;
    }
    setUploading(true);
    setUploadError(null);
    setNotice(null);
    setProgress(0);
    try {
      const sha256 = await fileSha256(file);
      const intent = await apiRequest<MediaObject>(
        `/api/v1/inspections/${inspectionId}/media`,
        {
          method: "POST",
          token,
          body: {
            filename: file.name,
            content_type: file.type,
            size_bytes: file.size,
            sha256,
          },
        },
      );
      const stored = await uploadMediaContent(intent.id, file, token, setProgress);
      setNotice(
        `${stored.filename} tersimpan. Server menghitung ulang digest SHA-256 sebelum menerimanya.`,
      );
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setMediaKey((value) => value + 1);
      onActivity?.();
    } catch (caught) {
      setUploadError(readError(caught, "Unggahan gagal."));
      setMediaKey((value) => value + 1);
      onActivity?.();
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function togglePreview(item: MediaObject) {
    if (openPreview === item.id) {
      setOpenPreview(null);
      return;
    }
    if (previews[item.id]) {
      setOpenPreview(item.id);
      return;
    }
    setBusyMedia(item.id);
    setUploadError(null);
    try {
      const blob = await fetchMediaBlob(item.id, token);
      const url = URL.createObjectURL(blob);
      objectUrls.current.push(url);
      setPreviews((current) => ({ ...current, [item.id]: url }));
      setOpenPreview(item.id);
    } catch (caught) {
      setUploadError(readError(caught, "Tidak dapat memuat pratinjau ini."));
    } finally {
      setBusyMedia(null);
    }
  }

  async function download(item: MediaObject) {
    setBusyMedia(item.id);
    setUploadError(null);
    try {
      const blob = await fetchMediaBlob(item.id, token, true);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (caught) {
      setUploadError(readError(caught, "Tidak dapat mengunduh berkas ini."));
    } finally {
      setBusyMedia(null);
    }
  }

  async function runDemoJob(item: MediaObject) {
    setBusyMedia(item.id);
    setJobsError(null);
    try {
      await apiRequest<AIJob>(`/api/v1/inspections/${inspectionId}/ai-jobs`, {
        method: "POST",
        token,
        body: { media_id: item.id },
      });
      setJobsKey((value) => value + 1);
      onActivity?.();
    } catch (caught) {
      setJobsError(readError(caught, "Tidak dapat mengantrekan analisis demo."));
    } finally {
      setBusyMedia(null);
    }
  }

  const mediaNames = new Map(media.map((item) => [item.id, item.filename]));

  return (
    <Card>
      <CardHeader
        title="Bukti dan pipeline AI demo"
        description="Gambar berada di penyimpanan objek privat dan hanya dapat diakses melalui pembacaan API yang berwenang. Setiap pembacaan diaudit."
        actions={
          <Chip tone="neutral">
            {media.filter((item) => item.status === "ready").length} tersimpan
          </Chip>
        }
      />
      <div className="space-y-5 p-5">
        {uploadError ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-critical/20 bg-critical-soft px-4 py-3"
          >
            <FileWarning className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden="true" />
            <div>
              <p className="text-sm text-ink">{uploadError}</p>
              {file && !uploading ? (
                <button
                  type="button"
                  className={`${secondaryButtonClass} mt-2`}
                  onClick={() => void handleUpload()}
                >
                  <UploadCloud className="size-3.5" aria-hidden="true" />
                  Coba unggah lagi
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {notice ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm text-ink"
          >
            <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
            {notice}
          </div>
        ) : null}

        {attachable ? (
          <form
            className="rounded-xl border border-border bg-canvas p-4"
            onSubmit={handleUpload}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className={labelClass} htmlFor="media-file">
                  Lampirkan gambar inspeksi
                </label>
                <input
                  ref={fileInputRef}
                  id="media-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className={`${inputClass} mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white`}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setUploadError(null);
                    setNotice(null);
                  }}
                  disabled={uploading}
                />
                <p className="mt-1 text-[11px] leading-4 text-secondary">
                  JPEG, PNG, atau WebP · hingga 10 MiB · SHA-256 dihitung di peramban dan
                  diverifikasi ulang oleh server. Ketidakcocokan dikarantina, tidak disimpan
                  sebagai bukti.
                </p>
              </div>
              <button
                type="submit"
                className={primaryButtonClass}
                disabled={uploading || !file}
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <UploadCloud className="size-3.5" aria-hidden="true" />
                )}
                {uploading ? "Mengunggah…" : "Unggah bukti"}
              </button>
            </div>
            {uploading ? (
              <div className="mt-3">
                <div
                  role="progressbar"
                  aria-label="Kemajuan unggahan"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  className="h-1.5 overflow-hidden rounded-full bg-border"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-right font-mono text-[10px] text-secondary">
                  {progress}% terunggah
                </p>
              </div>
            ) : null}
          </form>
        ) : canUploadPermission ? (
          <p className="rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-secondary">
            {["reviewed", "cancelled", "inconclusive"].includes(inspectionStatus)
              ? "Inspeksi ini telah ditutup dan tidak lagi menerima bukti."
              : "Hanya inspektur yang ditugaskan atau supervisor yang dapat melampirkan bukti."}
          </p>
        ) : null}

        {!canRead ? (
          <p className="rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-secondary">
            Melihat bukti memerlukan izin media:read.
          </p>
        ) : loadingMedia ? (
          <p className="flex items-center gap-2 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Memuat bukti…
          </p>
        ) : mediaError ? (
          <p className="text-sm text-critical">{mediaError}</p>
        ) : media.length === 0 ? (
          <EmptyState
            icon={<ImageOff className="size-5" aria-hidden="true" />}
            title="Belum ada bukti terlampir"
            description="Gambar inspeksi yang diunggah muncul di sini setelah server memverifikasi integritasnya."
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {media.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <ImagePlus className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="break-all text-sm font-semibold text-ink">{item.filename}</p>
                      <p className="mt-0.5 text-xs text-secondary">
                        {formatBytes(item.size_bytes)} · {item.content_type} ·{" "}
                        {item.uploaded_by.full_name}
                      </p>
                      <p className="text-xs text-secondary">
                        {item.uploaded_at
                          ? `Diunggah ${formatDateTime(item.uploaded_at)}`
                          : `Diminta ${formatDateTime(item.created_at)}`}
                      </p>
                    </div>
                  </div>
                  <Chip tone={mediaStatusTone(item.status)}>
                    {MEDIA_STATUS_LABELS[item.status] ?? item.status}
                  </Chip>
                </div>

                <p className="font-mono text-[10px] leading-4 text-secondary">
                  SHA-256 {shortSha(item.sha256, 24)}…
                  {item.sha256 ? <span title={item.sha256}> (terverifikasi server)</span> : null}
                </p>

                {item.status === "quarantined" ? (
                  <p className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink">
                    {quarantineReasonLabel(item.quarantine_reason)}. Objek yang dikarantina
                    dipertahankan untuk penyelidikan tetapi tidak dapat dianalisis atau
                    diunduh.
                  </p>
                ) : null}

                {item.status === "ready" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => togglePreview(item)}
                        disabled={busyMedia === item.id}
                      >
                        {openPreview === item.id ? (
                          <EyeOff className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Eye className="size-3.5" aria-hidden="true" />
                        )}
                        {openPreview === item.id ? "Sembunyikan pratinjau" : "Pratinjau"}
                      </button>
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => download(item)}
                        disabled={busyMedia === item.id}
                      >
                        <Download className="size-3.5" aria-hidden="true" />
                        Unduh
                      </button>
                      {canEnqueue ? (
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={() => runDemoJob(item)}
                          disabled={busyMedia === item.id || !canQueueJob}
                          title={
                            canQueueJob
                              ? "Antrekan pekerjaan kualitas gambar demo untuk gambar ini."
                              : "Analisis demo hanya dapat diantrekan selama inspeksi berstatus Dikirim, AI selesai memproses, atau Pemrosesan AI gagal."
                          }
                        >
                          <Bot className="size-3.5" aria-hidden="true" />
                          Jalankan pemeriksaan demo
                        </button>
                      ) : null}
                    </div>
                    {openPreview === item.id && previews[item.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- authorised blob URL from an audited API read
                      <img
                        src={previews[item.id]}
                        alt={`Pratinjau ${item.filename}`}
                        className="max-h-64 w-full rounded-lg border border-border bg-canvas object-contain"
                      />
                    ) : null}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canSeeJobs ? (
          <div className="border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <Bot className="size-4 text-ai" aria-hidden="true" />
                Pekerjaan analisis demo
              </h3>
              <Chip tone="ai">DEMO · saran saja</Chip>
            </div>
            <p className="mt-1 text-xs leading-5 text-secondary">
              Versi ini menjalankan heuristik kualitas gambar deterministik untuk menguji antrean
              dan pipeline penyimpanan. Tidak melakukan deteksi kerusakan, tidak menghasilkan
              tingkat keparahan atau vonis aman/tidak aman, dan tidak mengklaim akurasi. Penilaian
              manusia tetap wajib.
            </p>

            {jobsError ? <p className="mt-3 text-sm text-critical">{jobsError}</p> : null}

            {loadingJobs ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-secondary">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Memuat pekerjaan demo…
              </p>
            ) : jobs.length === 0 ? (
              <p className="mt-3 rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-secondary">
                Belum ada analisis demo yang diminta untuk inspeksi ini.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {jobs.map((job) => (
                  <li key={job.id} className="rounded-xl border border-border bg-canvas p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {job.model.name}{" "}
                          <span className="font-mono text-[10px] text-secondary">
                            {job.model.code} {job.model.version}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-secondary">
                          {mediaNames.get(job.media_id) ?? "Media"} · diminta oleh{" "}
                          {job.requested_by.full_name} · {formatDateTime(job.created_at)}
                        </p>
                      </div>
                      <Chip tone={jobStatusTone(job.status)}>
                        {JOB_STATUS_LABELS[job.status] ?? job.status}
                      </Chip>
                    </div>

                    {isJobActive(job) ? (
                      <p className="mt-2 flex items-center gap-2 text-xs text-secondary">
                        <Clock className="size-3.5 animate-pulse" aria-hidden="true" />
                        Menunggu worker AI. Halaman ini diperbarui otomatis.
                      </p>
                    ) : null}

                    {job.status === "failed" ? (
                      <p className="mt-2 text-xs text-critical">
                        {jobErrorLabel(job.error_code)}. Pekerjaan dapat dicoba ulang setelah
                        penyebabnya diselesaikan.
                      </p>
                    ) : null}

                    {job.status === "succeeded" && job.result ? (
                      <div className="mt-3 space-y-2">
                        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <div>
                            <dt className="text-secondary">Resolusi</dt>
                            <dd className="font-mono text-ink">
                              {job.result.metrics.width}×{job.result.metrics.height}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-secondary">Luminans rata-rata</dt>
                            <dd className="font-mono text-ink">
                              {job.result.metrics.mean_luminance.toFixed(1)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-secondary">Kontras (σ)</dt>
                            <dd className="font-mono text-ink">
                              {job.result.metrics.contrast_stddev.toFixed(1)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-secondary">Variansi tepi</dt>
                            <dd className="font-mono text-ink">
                              {job.result.metrics.edge_variance.toFixed(0)}
                            </dd>
                          </div>
                        </dl>
                        <div className="flex flex-wrap gap-1.5">
                          {job.result.quality_flags.length === 0 ? (
                            <Chip tone="neutral">Tidak ada flag kualitas aktif</Chip>
                          ) : (
                            job.result.quality_flags.map((flag) => (
                              <Chip key={flag} tone="warning">
                                {QUALITY_FLAG_LABELS[flag] ?? flag}
                              </Chip>
                            ))
                          )}
                        </div>
                        <p className="rounded-lg border border-warning/20 bg-warning-soft px-3 py-2 text-[11px] leading-4 text-ink">
                          {job.result.disclaimer}
                          {job.result.note ? ` ${job.result.note}` : ""}
                        </p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
