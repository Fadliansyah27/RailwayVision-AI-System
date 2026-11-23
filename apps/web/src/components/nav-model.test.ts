import { describe, expect, it } from "vitest";

import {
  canSeeItem,
  getVisibleNavSections,
  isActivePath,
  NAV_SECTIONS,
  type NavItem,
} from "@/components/nav-model";

function findItem(label: string): NavItem {
  const item = NAV_SECTIONS.flatMap((section) => section.items).find(
    (candidate) => candidate.label === label,
  );
  if (!item) {
    throw new Error(`Missing nav item: ${label}`);
  }
  return item;
}

describe("navigation visibility", () => {
  it("shows only role-appropriate sections for an inspector", () => {
    const sections = getVisibleNavSections(["inspector"]);
    const labels = sections.flatMap((section) => section.items.map((item) => item.label));

    expect(labels).toContain("Inspeksi");
    expect(labels).toContain("Perintah Kerja");
    expect(labels).toContain("Notifikasi");
    expect(labels).not.toContain("Administrasi");
    expect(labels).not.toContain("Pengelolaan Model AI");
    expect(labels).not.toContain("Temuan");
  });

  it("delivers the asset and inspection routes for every read role", () => {
    const assets = findItem("Aset & Lokasi");
    const inspections = findItem("Inspeksi");

    expect(assets.available).toBe(true);
    expect(assets.href).toBe("/assets");
    expect(inspections.available).toBe(true);
    expect(inspections.href).toBe("/inspections");
    expect(canSeeItem(assets, ["ai_ml_engineer"])).toBe(true);
    expect(canSeeItem(inspections, ["auditor"])).toBe(true);
  });

  it("shows findings and work orders to the maintenance roles", () => {
    const findings = findItem("Temuan");
    const workOrders = findItem("Perintah Kerja");

    expect(findings.available).toBe(true);
    expect(findings.href).toBe("/findings");
    expect(canSeeItem(findings, ["reviewer"])).toBe(true);
    expect(canSeeItem(findings, ["supervisor"])).toBe(true);
    expect(canSeeItem(findings, ["auditor"])).toBe(true);
    expect(canSeeItem(findings, ["inspector"])).toBe(false);

    expect(workOrders.available).toBe(true);
    expect(workOrders.href).toBe("/work-orders");
    expect(canSeeItem(workOrders, ["inspector"])).toBe(true);
    expect(canSeeItem(workOrders, ["auditor"])).toBe(true);
    expect(canSeeItem(workOrders, ["ai_ml_engineer"])).toBe(false);
  });

  it("offers notifications to everyone, including anonymous visitors", () => {
    const notifications = findItem("Notifikasi");
    expect(notifications.available).toBe(true);
    expect(notifications.href).toBe("/notifications");
    expect(canSeeItem(notifications, ["inspector"])).toBe(true);
    expect(canSeeItem(notifications, null)).toBe(true);
  });

  it("restricts model registry to AI engineers, administrators, and auditors", () => {
    const modelRegistry = findItem("Pengelolaan Model AI");
    expect(modelRegistry.available).toBe(true);
    expect(modelRegistry.href).toBe("/models");
    expect(canSeeItem(modelRegistry, ["ai_ml_engineer"])).toBe(true);
    expect(canSeeItem(modelRegistry, ["auditor"])).toBe(true);
    expect(canSeeItem(modelRegistry, ["administrator"])).toBe(true);
    expect(canSeeItem(modelRegistry, ["inspector"])).toBe(false);
    expect(canSeeItem(modelRegistry, ["supervisor"])).toBe(false);
  });

  it("restricts the operations console to audit and administrator roles", () => {
    const operations = findItem("Konsol Operasi");
    expect(operations.available).toBe(true);
    expect(operations.href).toBe("/operations");
    expect(canSeeItem(operations, ["administrator"])).toBe(true);
    expect(canSeeItem(operations, ["auditor"])).toBe(true);
    expect(canSeeItem(operations, ["supervisor"])).toBe(true);
    expect(canSeeItem(operations, ["inspector"])).toBe(false);
    expect(canSeeItem(operations, ["reviewer"])).toBe(false);
    expect(canSeeItem(operations, ["ai_ml_engineer"])).toBe(false);
  });

  it("restricts administration to administrators", () => {
    const administration = findItem("Administrasi");
    expect(canSeeItem(administration, ["administrator"])).toBe(true);
    expect(canSeeItem(administration, ["supervisor"])).toBe(false);
  });

  it("keeps unrestricted items visible without a session", () => {
    expect(canSeeItem(findItem("Ringkasan"), null)).toBe(true);
    expect(canSeeItem(findItem("Status Sistem"), null)).toBe(true);
  });
});

describe("isActivePath", () => {
  it("matches the overview only at the root", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/system-status", "/")).toBe(false);
  });

  it("matches nested paths", () => {
    expect(isActivePath("/inspections/123", "/inspections")).toBe(true);
    expect(isActivePath("/inspections", "/inspections")).toBe(true);
    expect(isActivePath("/inspection", "/inspections")).toBe(false);
  });
});
