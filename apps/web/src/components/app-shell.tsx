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
  ServerCog,
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
  operations: ServerCog,
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
    <nav
      aria-label="Navigasi utama"
      className="relative flex flex-1 flex-col gap-7 overflow-y-auto px-3 py-5"
    >
      {sections.map((section) => (
        <div key={section.label}>
          <p className="flex items-center gap-2 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--rv-sidebar-muted)]/80">
            {section.label}
            <span className="h-px flex-1 bg-white/15" aria-hidden="true" />
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
                      className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-all duration-200 ${
                        active
                          ? "bg-white text-primary-strong shadow-[0_14px_30px_-18px_rgba(0,0,0,0.7)]"
                          : "text-[color:var(--rv-sidebar-muted)] hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          active
                            ? "bg-primary-soft text-primary-strong"
                            : "bg-white/5 text-[color:var(--rv-sidebar-muted)] group-hover:bg-white/10 group-hover:text-white"
                        }`}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
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
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] text-[color:var(--rv-sidebar-muted)]/55"
                    title={`${item.description} — tersedia pada Fase ${item.phase}`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="rounded-md border border-white/10 bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
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
      <aside
        className="relative hidden overflow-hidden text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col"
        style={{ backgroundImage: "var(--rv-gradient-sidebar)" }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 top-24 size-64 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 bottom-0 size-72 rounded-full bg-black/20 blur-3xl"
        />
        <div className="relative flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-primary shadow-lg shadow-black/25">
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
        <div className="relative border-t border-white/10 p-4">
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] leading-5 text-[color:var(--rv-sidebar-muted)]">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>Alat bantu keputusan. Tanpa fungsi kendali kereta.</span>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup navigasi"
            className="absolute inset-0 bg-[#0b0b0f]/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="relative flex h-full w-72 max-w-[85%] flex-col overflow-hidden text-white shadow-2xl"
            style={{ backgroundImage: "var(--rv-gradient-sidebar)" }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 top-10 size-48 rounded-full bg-white/10 blur-3xl"
            />
            <div className="relative flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-primary shadow-md shadow-black/20">
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
        <header className="sticky top-0 z-30 border-b border-border/80 bg-surface/85 backdrop-blur-xl">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ backgroundImage: "var(--rv-gradient-primary)" }}
          />
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-xl p-2 text-ink transition-colors hover:bg-canvas lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">
                PT Kereta Cepat Indonesia China — ruang kerja prototipe
              </p>
              <p className="truncate text-[11px] text-secondary">
                {user
                  ? `${user.scope.name} · ${roleLabel}`
                  : "Ruang kerja terautentikasi"}
              </p>
            </div>
            <Chip tone="warning">PROTOTIPE</Chip>
            <NotificationBell />
            <Link
              href="/profile"
              className="hidden items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-canvas sm:flex"
              aria-label="Buka profil"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-xs font-semibold text-primary ring-1 ring-primary/20">
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
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-[var(--rv-shadow-xs)] transition-colors hover:bg-canvas disabled:opacity-60"
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

        <main
          id="main"
          className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        >
          {children}
        </main>

        <footer className="border-t border-border/70 px-4 py-5 sm:px-6 lg:px-8">
          <p className="mx-auto max-w-[1480px] text-[11px] leading-5 text-secondary">
            Prototipe pendukung keputusan. Keluaran AI bersifat saran dan memerlukan verifikasi
            manusia yang berwenang. Tidak boleh digunakan sebagai izin keselamatan atau pengganti
            prosedur inspeksi KCIC yang resmi.
          </p>
        </footer>
      </div>
    </div>
  );
}
