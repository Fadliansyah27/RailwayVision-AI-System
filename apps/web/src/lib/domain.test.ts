import { describe, expect, it } from "vitest";

import {
  ASSET_STATUS_LABELS,
  FINDING_PRIORITY_LABELS,
  FINDING_STATUS_LABELS,
  INSPECTION_STATUS_LABELS,
  INSPECTION_TYPE_LABELS,
  REVIEW_DECISION_LABELS,
  WORK_ORDER_STATUS_LABELS,
  assetStatusTone,
  buildQuery,
  findingPriorityTone,
  findingStatusTone,
  inspectionStatusTone,
  isDemoRecord,
  notificationTargetHref,
  reviewDecisionTone,
  toDatetimeLocalValue,
  workOrderStatusTone,
} from "@/lib/domain";

describe("status presentation", () => {
  it("labels every supported asset status", () => {
    expect(ASSET_STATUS_LABELS.active).toBe("Aktif");
    expect(ASSET_STATUS_LABELS.out_of_service).toBe("Tidak Beroperasi");
    expect(assetStatusTone("out_of_service")).toBe("warning");
    expect(assetStatusTone("retired")).toBe("neutral");
  });

  it("labels draft and submitted inspections distinctly", () => {
    expect(INSPECTION_STATUS_LABELS.draft).toBe("Draf");
    expect(INSPECTION_STATUS_LABELS.submitted).toBe("Dikirim");
    expect(inspectionStatusTone("draft")).toBe("neutral");
    expect(inspectionStatusTone("submitted")).toBe("warning");
    expect(inspectionStatusTone("under_review")).toBe("warning");
    expect(inspectionStatusTone("reviewed")).toBe("success");
    expect(inspectionStatusTone("ai_failed")).toBe("critical");
    expect(INSPECTION_STATUS_LABELS.inconclusive).toBe("Tidak Dapat Disimpulkan");
  });

  it("labels every inspection type", () => {
    expect(INSPECTION_TYPE_LABELS.routine).toBe("Rutin");
    expect(INSPECTION_TYPE_LABELS.detailed).toBe("Terperinci");
    expect(INSPECTION_TYPE_LABELS.follow_up).toBe("Tindak Lanjut");
    expect(INSPECTION_TYPE_LABELS.emergency).toBe("Darurat");
  });
});

describe("review decisions", () => {
  it("labels and tones human review decisions", () => {
    expect(REVIEW_DECISION_LABELS.accepted).toBe("Diterima");
    expect(REVIEW_DECISION_LABELS.returned).toBe("Dikembalikan untuk Perbaikan");
    expect(REVIEW_DECISION_LABELS.inconclusive).toBe("Tidak Dapat Disimpulkan");
    expect(reviewDecisionTone("accepted")).toBe("success");
    expect(reviewDecisionTone("returned")).toBe("warning");
    expect(reviewDecisionTone("inconclusive")).toBe("critical");
  });
});

describe("buildQuery", () => {
  it("omits empty, false, and undefined values", () => {
    expect(
      buildQuery({ page: 2, search: "", status: null, mine: false, category_id: undefined }),
    ).toBe("?page=2");
  });

  it("encodes user input safely", () => {
    expect(buildQuery({ search: "track & bridge" })).toBe("?search=track+%26+bridge");
  });

  it("returns an empty string when nothing is set", () => {
    expect(buildQuery({})).toBe("");
  });
});

describe("demo labelling", () => {
  it("detects demo codes and references case-insensitively", () => {
    expect(isDemoRecord({ code: "DEMO-AST-0001" })).toBe(true);
    expect(isDemoRecord({ reference: "demo-ins-0001" })).toBe(true);
    expect(isDemoRecord({ code: "KCIC-AST-0001" })).toBe(false);
  });
});

describe("maintenance presentation", () => {
  it("labels every finding status and priority", () => {
    expect(FINDING_STATUS_LABELS.confirmed).toBe("Terkonfirmasi");
    expect(FINDING_STATUS_LABELS.awaiting_verification).toBe("Menunggu Verifikasi");
    expect(FINDING_STATUS_LABELS.rejected).toBe("Ditolak");
    expect(FINDING_PRIORITY_LABELS.high).toBe("Tinggi");
  });

  it("tones finding status and priority", () => {
    expect(findingStatusTone("closed")).toBe("success");
    expect(findingStatusTone("rejected")).toBe("critical");
    expect(findingStatusTone("in_progress")).toBe("warning");
    expect(findingStatusTone("confirmed")).toBe("neutral");
    expect(findingPriorityTone("high")).toBe("critical");
    expect(findingPriorityTone("medium")).toBe("warning");
    expect(findingPriorityTone("low")).toBe("neutral");
  });

  it("labels and tones work order statuses", () => {
    expect(WORK_ORDER_STATUS_LABELS.open).toBe("Terbuka");
    expect(WORK_ORDER_STATUS_LABELS.awaiting_verification).toBe("Menunggu Verifikasi");
    expect(WORK_ORDER_STATUS_LABELS.cancelled).toBe("Dibatalkan");
    expect(workOrderStatusTone("completed")).toBe("success");
    expect(workOrderStatusTone("awaiting_verification")).toBe("warning");
    expect(workOrderStatusTone("open")).toBe("neutral");
  });

  it("links notifications to their record", () => {
    expect(notificationTargetHref("finding", "fnd-1")).toBe("/findings/fnd-1");
    expect(notificationTargetHref("work_order", "wo-1")).toBe("/work-orders/wo-1");
    expect(notificationTargetHref("finding", null)).toBeNull();
    expect(notificationTargetHref(null, "fnd-1")).toBeNull();
    expect(notificationTargetHref("unknown", "id")).toBeNull();
  });
});

describe("datetime local conversion", () => {
  it("returns an empty string without a value", () => {
    expect(toDatetimeLocalValue(null)).toBe("");
  });

  it("formats a timestamp for a datetime-local input", () => {
    const iso = new Date(2026, 10, 23, 14, 5).toISOString();
    expect(toDatetimeLocalValue(iso)).toBe("2026-11-23T14:05");
  });
});
