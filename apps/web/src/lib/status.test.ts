import { describe, expect, it } from "vitest";

import type { ReadinessResponse } from "@/lib/api";
import { componentLabel, formatCheckedAt, summarizeReadiness } from "@/lib/status";

function readiness(
  status: ReadinessResponse["status"],
  components: Partial<ReadinessResponse["components"]> = {},
): ReadinessResponse {
  return {
    status,
    components: {
      database: "ok",
      redis: "ok",
      worker: "ok",
      ...components,
    },
  };
}

describe("summarizeReadiness", () => {
  it("reports success when every component is healthy", () => {
    const summary = summarizeReadiness(readiness("ok"));
    expect(summary.tone).toBe("success");
    expect(summary.label).toBe("Semua sistem beroperasi");
  });

  it("reports critical when required dependencies are degraded", () => {
    const summary = summarizeReadiness(readiness("degraded", { redis: "error" }));
    expect(summary.tone).toBe("critical");
    expect(summary.label).toBe("Layanan terganggu");
  });

  it("reports a warning when only the asynchronous worker is offline", () => {
    const summary = summarizeReadiness(readiness("ok", { worker: "error" }));
    expect(summary.tone).toBe("warning");
    expect(summary.label).toContain("worker AI nonaktif");
  });
});

describe("componentLabel", () => {
  it("maps component states", () => {
    expect(componentLabel("ok")).toEqual({ label: "Sehat", tone: "success" });
    expect(componentLabel("error")).toEqual({ label: "Tidak tersedia", tone: "critical" });
    expect(componentLabel(undefined)).toEqual({ label: "Tidak diketahui", tone: "neutral" });
  });
});

describe("formatCheckedAt", () => {
  it("handles an empty value", () => {
    expect(formatCheckedAt(null)).toBe("Belum diperiksa");
  });

  it("formats a timestamp", () => {
    const formatted = formatCheckedAt(new Date("2026-11-23T10:00:00Z"));
    expect(formatted).toMatch(/\d{2}[.:]\d{2}/);
    expect(formatted).toContain("WIB");
  });
});
