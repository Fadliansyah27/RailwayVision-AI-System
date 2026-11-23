"use client";

import { Loader2, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";

import { ChecklistTemplates } from "@/components/admin/checklist-templates";
import { PasswordResetManagement } from "@/components/admin/password-reset-management";
import { RoleManagement } from "@/components/admin/role-management";
import { ScopeManagement } from "@/components/admin/scope-management";
import { UserManagement } from "@/components/admin/user-management";
import { Card, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type PermissionInfo,
  type RoleDetail,
  type ScopeInfo,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Tab = "users" | "roles" | "scopes" | "resets" | "checklists";

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: "users", label: "Pengguna", description: "Akun, peran, dan penugasan cakupan" },
  { id: "roles", label: "Peran & izin", description: "Matriks izin per peran" },
  { id: "scopes", label: "Cakupan", description: "Batas visibilitas organisasi" },
  { id: "resets", label: "Reset kata sandi", description: "Tautan pemulihan sekali pakai" },
  {
    id: "checklists",
    label: "Checklist",
    description: "Template daftar periksa per jenis inspeksi",
  },
];

export default function AdministrationPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [roles, setRoles] = useState<RoleDetail[]>([]);
  const [scopes, setScopes] = useState<ScopeInfo[]>([]);
  const [permissions, setPermissions] = useState<PermissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    Promise.all([
      apiRequest<RoleDetail[]>("/api/v1/roles", { token }),
      apiRequest<ScopeInfo[]>("/api/v1/scopes", { token }),
      apiRequest<PermissionInfo[]>("/api/v1/permissions", { token }),
    ])
      .then(([roleData, scopeData, permissionData]) => {
        if (cancelled) {
          return;
        }
        setRoles(roleData);
        setScopes(scopeData);
        setPermissions(permissionData);
        setError(null);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Tidak dapat memuat data administrasi.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tata kelola · akses & master data"
        title="Administrasi"
        description="Kelola akun DEMO, matriks izin yang ditegakkan server, dan cakupan organisasi. Setiap perubahan ditulis API ke riwayat aktivitas."
      />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Bagian administrasi">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              tab === item.id
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-ink hover:bg-canvas"
            }`}
          >
            <span className="block font-semibold">{item.label}</span>
            <span
              className={`block text-[10px] ${
                tab === item.id ? "text-white/75" : "text-secondary"
              }`}
            >
              {item.description}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="flex items-center gap-2 p-8 text-sm text-secondary">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Memuat data administrasi…
        </Card>
      ) : null}

      {!loading && error ? (
        <Card className="flex items-start gap-3 border-critical/20 bg-critical-soft p-5">
          <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink">Administrasi tidak tersedia</p>
            <p className="mt-1 text-sm leading-6 text-secondary">{error}</p>
            <p className="mt-1 text-xs text-secondary">
              Layar ini memerlukan izin <code className="font-mono">users:manage</code>. API
              menolak permintaan tanpa otorisasi meskipun halaman dibuka langsung.
            </p>
          </div>
        </Card>
      ) : null}

      {!loading && !error && user ? (
        <>
          {tab === "users" ? (
            <UserManagement
              token={token ?? ""}
              currentUserId={user.id}
              roles={roles}
              scopes={scopes}
            />
          ) : null}
          {tab === "roles" ? (
            <RoleManagement
              token={token ?? ""}
              roles={roles}
              permissions={permissions}
              onRolesChange={setRoles}
            />
          ) : null}
          {tab === "scopes" ? (
            <ScopeManagement token={token ?? ""} scopes={scopes} onScopesChange={setScopes} />
          ) : null}
          {tab === "resets" ? <PasswordResetManagement token={token ?? ""} /> : null}
          {tab === "checklists" ? <ChecklistTemplates token={token ?? ""} /> : null}
        </>
      ) : null}
    </div>
  );
}
