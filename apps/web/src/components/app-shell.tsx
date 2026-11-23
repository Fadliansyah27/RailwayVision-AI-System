"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  ClipboardList,
  Cpu,
  LayoutDashboard,
  Loader2,
  LogOut,
  Map,
  Menu,
  ScrollText,
  ShieldCheck,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  getVisibleNavSections,
  isActivePath,
  type NavIconKey,
  type RoleCode,
} from "@/components/nav-model";
import { NotificationBell } from "@/components/notification-bell";
import { Chip } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const ICONS: Record<NavIconKey, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  inspections: ClipboardList,
  findings: AlertTriangle,
  workOrders: Wrench,
  notifications: Bell,
  assets: Map,
  models: Cpu,
  reports: BarChart3,
  administration: Users,
  audit: ScrollText,
  status: Activity,
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Navigation({ roles, onNavigate }: { roles: RoleCode[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const sections = getVisibleNavSections(roles);

  return (
    <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--rv-sidebar-muted)]">
            {section.label}
          </p>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.href ? isActivePath(pathname, item.href) : false;
              if (item.available && item.href) {
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-white/10 font-medium text-white"
                          : "text-[color:var(--rv-sidebar-muted)] hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      {active ? (
                        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                      ) : null}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={item.label}>
                  <div
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[color:var(--rv-sidebar-muted)]/60"
                    title={`${item.description} — tersedia pada Fase ${item.phase}`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                      P{item.phase}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, signOut } = useAuth();

  const roles = (user?.roles.map((role) => role.code) ?? []) as RoleCode[];
  const roleLabel = user?.roles.map((role) => role.name).join(", ") ?? "Tanpa peran";

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="hidden bg-sidebar text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary font-semibold text-white">
            RV
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">RailwayVision AI</p>
            <p className="truncate text-[11px] text-[color:var(--rv-sidebar-muted)]">
              Pendukung keputusan inspeksi
            </p>
          </div>
        </div>
        <Navigation roles={roles} />
        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-2 text-xs text-[color:var(--rv-sidebar-muted)]">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span>Alat bantu. Tanpa fungsi kendali kereta.</span>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup navigasi"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex h-full w-72 max-w-[85%] flex-col bg-sidebar text-white shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold">
                  RV
                </div>
                <span className="text-sm font-semibold">RailwayVision AI</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-[color:var(--rv-sidebar-muted)] hover:bg-white/10 hover:text-white"
                aria-label="Tutup menu navigasi"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <Navigation roles={roles} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 text-ink hover:bg-canvas lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                PT Kereta Cepat Indonesia China — ruang kerja prototipe
              </p>
              <p className="truncate text-xs text-secondary">
                {user
                  ? `${user.scope.name} · ${roleLabel}`
                  : "Ruang kerja terautentikasi"}
              </p>
            </div>
            <Chip tone="warning">PROTOTIPE DEMO</Chip>
            <NotificationBell />
            <Link
              href="/profile"
              className="hidden items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-canvas sm:flex"
              aria-label="Buka profil"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-canvas text-xs font-semibold text-secondary ring-1 ring-border">
                {user ? initials(user.full_name) : <UserRound className="size-4" />}
              </div>
              <div className="hidden max-w-44 md:block">
                <p className="truncate text-xs font-semibold text-ink">
                  {user?.full_name ?? "Sudah masuk"}
                </p>
                <p className="truncate text-[11px] text-secondary">
                  {user?.scope.code ?? ""}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-semibold text-ink hover:bg-canvas disabled:opacity-60"
              aria-label="Keluar"
            >
              {signingOut ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="size-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="border-t border-border bg-surface px-4 py-4 sm:px-6 lg:px-8">
          <p className="mx-auto max-w-[1440px] text-xs leading-5 text-secondary">
            Prototipe pendukung keputusan. Keluaran AI bersifat saran dan memerlukan verifikasi
            manusia yang berwenang. Tidak boleh digunakan sebagai izin keselamatan atau pengganti
            prosedur inspeksi KCIC yang resmi.
          </p>
        </footer>
      </div>
    </div>
  );
}
