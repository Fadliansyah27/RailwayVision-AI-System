export type RoleCode =
  | "inspector"
  | "reviewer"
  | "supervisor"
  | "administrator"
  | "ai_ml_engineer"
  | "auditor";

export type NavIconKey =
  | "overview"
  | "inspections"
  | "findings"
  | "workOrders"
  | "notifications"
  | "assets"
  | "models"
  | "reports"
  | "administration"
  | "audit"
  | "status"
  | "operations";

export interface NavItem {
  label: string;
  icon: NavIconKey;
  href?: string;
  available: boolean;
  phase?: number;
  roles?: RoleCode[];
  description: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Operasional",
    items: [
      {
        label: "Ringkasan",
        icon: "overview",
        href: "/",
        available: true,
        description: "Ringkasan operasional dan status platform",
      },
      {
        label: "Inspeksi",
        icon: "inspections",
        href: "/inspections",
        available: true,
        phase: 3,
        roles: [
          "inspector",
          "reviewer",
          "supervisor",
          "administrator",
          "auditor",
          "ai_ml_engineer",
        ],
        description: "Buat draf, kirim, dan pantau inspeksi",
      },
      {
        label: "Temuan",
        icon: "findings",
        href: "/findings",
        available: true,
        phase: 7,
        roles: ["reviewer", "supervisor", "administrator", "auditor"],
        description: "Temuan terverifikasi manusia dan riwayat tinjauan",
      },
      {
        label: "Perintah Kerja",
        icon: "workOrders",
        href: "/work-orders",
        available: true,
        phase: 7,
        roles: ["inspector", "reviewer", "supervisor", "administrator", "auditor"],
        description: "Penugasan dan pemantauan tindakan perbaikan",
      },
      {
        label: "Notifikasi",
        icon: "notifications",
        href: "/notifications",
        available: true,
        description: "Notifikasi alur kerja dalam aplikasi",
      },
    ],
  },
  {
    label: "Register",
    items: [
      {
        label: "Aset & Lokasi",
        icon: "assets",
        href: "/assets",
        available: true,
        phase: 3,
        roles: [
          "inspector",
          "reviewer",
          "supervisor",
          "administrator",
          "auditor",
          "ai_ml_engineer",
        ],
        description: "Register aset dan lokasi sesuai cakupan",
      },
    ],
  },
  {
    label: "Kecerdasan Buatan",
    items: [
      {
        label: "Pengelolaan Model AI",
        icon: "models",
        href: "/models",
        available: true,
        phase: 5,
        roles: ["ai_ml_engineer", "administrator", "auditor"],
        description: "Siklus hidup model, evaluasi, persetujuan, dan dataset",
      },
    ],
  },
  {
    label: "Tata Kelola",
    items: [
      {
        label: "Laporan",
        icon: "reports",
        href: "/reports",
        available: true,
        phase: 8,
        roles: [
          "reviewer",
          "supervisor",
          "administrator",
          "auditor",
          "ai_ml_engineer",
        ],
        description: "Ringkasan operasional, ekspor PDF/Excel, dan cetak",
      },
      {
        label: "Administrasi",
        icon: "administration",
        href: "/administration",
        available: true,
        phase: 2,
        roles: ["administrator"],
        description: "Pengguna, peran, dan cakupan organisasi",
      },
      {
        label: "Riwayat Aktivitas",
        icon: "audit",
        href: "/audit",
        available: true,
        phase: 2,
        roles: ["supervisor", "administrator", "auditor"],
        description: "Peristiwa audit keamanan dan alur kerja yang tidak dapat diubah",
      },
    ],
  },
  {
    label: "Sistem",
    items: [
      {
        label: "Konsol Operasi",
        icon: "operations",
        href: "/operations",
        available: true,
        phase: 9,
        roles: ["supervisor", "administrator", "auditor"],
        description: "Riwayat job AI, log, deployment, backup, dan reset data sintetis",
      },
      {
        label: "Status Sistem",
        icon: "status",
        href: "/system-status",
        available: true,
        description: "Kesehatan API, basis data, antrean, dan worker secara langsung",
      },
    ],
  },
];

export function canSeeItem(item: NavItem, roles: RoleCode[] | null): boolean {
  if (!item.roles) {
    return true;
  }
  if (roles === null) {
    return true;
  }
  return item.roles.some((role) => roles.includes(role));
}

export function getVisibleNavSections(roles: RoleCode[] | null): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canSeeItem(item, roles)),
  })).filter((section) => section.items.length > 0);
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
