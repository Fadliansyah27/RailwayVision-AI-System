import type { ComponentState, ReadinessResponse } from "@/lib/api";

export type Tone = "success" | "warning" | "critical" | "neutral" | "ai";

export interface ReadinessSummary {
  label: string;
  tone: Tone;
  detail: string;
}

export function summarizeReadiness(readiness: ReadinessResponse): ReadinessSummary {
  if (readiness.status !== "ok") {
    return {
      label: "Layanan terganggu",
      tone: "critical",
      detail: "Dependensi wajib (basis data atau antrean) tidak tersedia.",
    };
  }
  if (readiness.components.worker !== "ok") {
    return {
      label: "Operasional — worker AI nonaktif",
      tone: "warning",
      detail:
        "API tetap melayani permintaan. Pekerjaan AI akan mengantre sampai heartbeat worker pulih.",
    };
  }
  return {
    label: "Semua sistem beroperasi",
    tone: "success",
    detail: "API, PostgreSQL, Redis, dan heartbeat worker AI dalam kondisi sehat.",
  };
}

export function componentLabel(state: ComponentState | undefined): {
  label: string;
  tone: Tone;
} {
  if (state === "ok") {
    return { label: "Sehat", tone: "success" };
  }
  if (state === "error") {
    return { label: "Tidak tersedia", tone: "critical" };
  }
  return { label: "Tidak diketahui", tone: "neutral" };
}

export function formatCheckedAt(date: Date | null): string {
  if (!date) {
    return "Belum diperiksa";
  }
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
    timeZoneName: "short",
  }).format(date);
}
