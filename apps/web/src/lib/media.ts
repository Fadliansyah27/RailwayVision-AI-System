import type { AIJob } from "@/lib/api";
import type { Tone } from "@/lib/status";

export const MEDIA_STATUS_LABELS: Record<string, string> = {
  pending_upload: "Menunggu unggahan",
  ready: "Tersimpan & terverifikasi",
  quarantined: "Karantina",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  queued: "Dalam antrean",
  running: "Berjalan",
  succeeded: "Selesai",
  failed: "Gagal",
};

export const QUARANTINE_REASON_LABELS: Record<string, string> = {
  size_mismatch: "Ukuran unggahan tidak cocok dengan ukuran yang dideklarasikan",
  content_type_mismatch: "Tanda tangan berkas tidak cocok dengan jenis gambar yang dideklarasikan",
  checksum_mismatch: "Checksum SHA-256 tidak cocok dengan digest yang dideklarasikan",
  storage_unavailable: "Penyimpanan tidak tersedia saat memvalidasi unggahan",
};

export const QUALITY_FLAG_LABELS: Record<string, string> = {
  low_light: "Pencahayaan rendah",
  low_contrast: "Kontras rendah",
  possible_blur: "Kemungkinan kabur",
  low_resolution: "Resolusi rendah",
};

export const JOB_ERROR_LABELS: Record<string, string> = {
  queue_unavailable: "Antrean tugas tidak tersedia",
  media_unavailable: "Media tidak lagi tersedia",
  storage_unavailable: "Penyimpanan objek tidak tersedia",
  unsupported_image: "Gambar tidak dapat didekode",
  analysis_failed: "Analisis sintetis gagal",
};

export function mediaStatusTone(status: string): Tone {
  if (status === "ready") {
    return "success";
  }
  if (status === "quarantined") {
    return "critical";
  }
  return "warning";
}

export function jobStatusTone(status: string): Tone {
  if (status === "succeeded") {
    return "success";
  }
  if (status === "failed") {
    return "critical";
  }
  if (status === "running") {
    return "ai";
  }
  return "warning";
}

export function isJobActive(job: AIJob): boolean {
  return job.status === "queued" || job.status === "running";
}

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) {
    return "—";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KiB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MiB`;
}

export function shortSha(value: string | null, length = 12): string {
  if (!value) {
    return "—";
  }
  return value.slice(0, length);
}

export function quarantineReasonLabel(reason: string | null): string {
  if (!reason) {
    return "Ditolak validasi sisi server";
  }
  return QUARANTINE_REASON_LABELS[reason] ?? reason;
}

export function jobErrorLabel(code: string | null): string {
  if (!code) {
    return "Analisis tidak selesai";
  }
  return JOB_ERROR_LABELS[code] ?? code;
}
