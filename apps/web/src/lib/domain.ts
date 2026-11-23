import type { Tone } from "@/lib/status";

export const ASSET_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  out_of_service: "Tidak Beroperasi",
  retired: "Dinonaktifkan",
};

export const INSPECTION_STATUS_LABELS: Record<string, string> = {
  draft: "Draf",
  submitted: "Dikirim",
  ai_processing: "Menunggu Pemrosesan AI",
  ai_processed: "AI Selesai Memproses",
  under_review: "Menunggu Verifikasi",
  reviewed: "Telah Ditinjau",
  ai_failed: "Pemrosesan AI Gagal",
  cancelled: "Dibatalkan",
  inconclusive: "Tidak Dapat Disimpulkan",
};

export const INSPECTION_TYPE_LABELS: Record<string, string> = {
  routine: "Rutin",
  detailed: "Terperinci",
  follow_up: "Tindak Lanjut",
  emergency: "Darurat",
};

export function assetStatusTone(status: string): Tone {
  if (status === "active") {
    return "success";
  }
  if (status === "out_of_service") {
    return "warning";
  }
  return "neutral";
}

export function inspectionStatusTone(status: string): Tone {
  if (status === "reviewed") {
    return "success";
  }
  if (status === "submitted" || status === "under_review") {
    return "warning";
  }
  if (status === "ai_processing" || status === "ai_processed") {
    return "ai";
  }
  if (status === "ai_failed") {
    return "critical";
  }
  return "neutral";
}

export const REVIEW_DECISION_LABELS: Record<string, string> = {
  accepted: "Diterima",
  returned: "Dikembalikan untuk Perbaikan",
  inconclusive: "Tidak Dapat Disimpulkan",
};

export function reviewDecisionTone(decision: string): Tone {
  if (decision === "accepted") {
    return "success";
  }
  if (decision === "inconclusive") {
    return "critical";
  }
  return "warning";
}

export const FINDING_STATUS_LABELS: Record<string, string> = {
  confirmed: "Terkonfirmasi",
  assigned: "Ditugaskan",
  in_progress: "Sedang Dikerjakan",
  awaiting_verification: "Menunggu Verifikasi",
  closed: "Selesai",
  rejected: "Ditolak",
};

export const FINDING_PRIORITY_LABELS: Record<string, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
};

export const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  open: "Terbuka",
  in_progress: "Sedang Dikerjakan",
  awaiting_verification: "Menunggu Verifikasi",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const NOTIFICATION_KIND_LABELS: Record<string, string> = {
  "finding.created": "Temuan baru",
  "finding.rejected": "Temuan ditolak",
  "finding.reopened": "Temuan dibuka kembali",
  "work_order.assigned": "Perintah kerja ditugaskan",
  "work_order.reassigned": "Perintah kerja dialihkan",
  "work_order.awaiting_verification": "Perintah kerja menunggu verifikasi",
  "work_order.verified": "Perintah kerja terverifikasi",
  "work_order.cancelled": "Perintah kerja dibatalkan",
};

export function findingStatusTone(status: string): Tone {
  if (status === "closed") {
    return "success";
  }
  if (status === "rejected") {
    return "critical";
  }
  if (status === "assigned" || status === "in_progress" || status === "awaiting_verification") {
    return "warning";
  }
  return "neutral";
}

export function workOrderStatusTone(status: string): Tone {
  if (status === "completed") {
    return "success";
  }
  if (status === "in_progress" || status === "awaiting_verification") {
    return "warning";
  }
  return "neutral";
}

export function findingPriorityTone(priority: string): Tone {
  if (priority === "high") {
    return "critical";
  }
  if (priority === "medium") {
    return "warning";
  }
  return "neutral";
}

export function notificationTargetHref(targetType: string | null, targetId: string | null): string | null {
  if (!targetType || !targetId) {
    return null;
  }
  if (targetType === "finding") {
    return `/findings/${targetId}`;
  }
  if (targetType === "work_order") {
    return `/work-orders/${targetId}`;
  }
  return null;
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  });
}

export function toDatetimeLocalValue(value: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function defaultDatetimeLocalValue(): string {
  return toDatetimeLocalValue(new Date().toISOString());
}

export function isSyntheticRecord(record: { code?: string; reference?: string }): boolean {
  return /sintetis/i.test(record.code ?? record.reference ?? "");
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "" || value === false) {
      continue;
    }
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}
