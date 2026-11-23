import { describe, expect, it } from "vitest";

import type { AIJob } from "@/lib/api";
import {
  formatBytes,
  isJobActive,
  jobErrorLabel,
  jobStatusTone,
  mediaStatusTone,
  quarantineReasonLabel,
  shortSha,
} from "@/lib/media";

function job(status: string): AIJob {
  return {
    id: "job",
    inspection_id: "insp",
    media_id: "media",
    status,
    error_code: null,
    result: null,
    model: { id: "m", code: "demo-image-quality", name: "DEMO", version: "0.1.0-demo" },
    requested_by: { id: "u", full_name: "Demo User" },
    created_at: "2026-11-23T00:00:00Z",
    started_at: null,
    finished_at: null,
  };
}

describe("formatBytes", () => {
  it("formats sizes at each scale", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KiB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MiB");
  });

  it("renders a dash for invalid input", () => {
    expect(formatBytes(-1)).toBe("—");
  });
});

describe("shortSha", () => {
  it("truncates digests and marks missing hashes", () => {
    expect(shortSha("abcdef0123456789", 8)).toBe("abcdef01");
    expect(shortSha(null)).toBe("—");
  });
});

describe("status presentation", () => {
  it("tone never relies on colour alone and maps states", () => {
    expect(mediaStatusTone("ready")).toBe("success");
    expect(mediaStatusTone("quarantined")).toBe("critical");
    expect(mediaStatusTone("pending_upload")).toBe("warning");
    expect(jobStatusTone("succeeded")).toBe("success");
    expect(jobStatusTone("failed")).toBe("critical");
    expect(jobStatusTone("running")).toBe("ai");
  });

  it("marks queued and running jobs as active", () => {
    expect(isJobActive(job("queued"))).toBe(true);
    expect(isJobActive(job("running"))).toBe(true);
    expect(isJobActive(job("succeeded"))).toBe(false);
    expect(isJobActive(job("failed"))).toBe(false);
  });
});

describe("human-readable reasons", () => {
  it("explains quarantine reasons", () => {
    expect(quarantineReasonLabel("checksum_mismatch")).toContain("SHA-256");
    expect(quarantineReasonLabel(null)).toContain("Ditolak");
  });

  it("explains job failures", () => {
    expect(jobErrorLabel("queue_unavailable")).toContain("Antrean");
    expect(jobErrorLabel(null)).toContain("tidak selesai");
  });
});
