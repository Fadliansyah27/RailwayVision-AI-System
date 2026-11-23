"use client";

import { Loader2, Save, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { primaryButtonClass } from "@/components/admin/form-styles";
import { Card, CardHeader, Chip } from "@/components/ui";
import { apiRequest, ApiError, type PermissionInfo, type RoleDetail } from "@/lib/api";

export function RoleManagement({
  token,
  roles,
  permissions,
  onRolesChange,
}: {
  token: string;
  roles: RoleDetail[];
  permissions: PermissionInfo[];
  onRolesChange: (roles: RoleDetail[]) => void;
}) {
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? "");
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0];
  const [draft, setDraft] = useState<{ roleId: string; codes: string[] }>({
    roleId: "",
    codes: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const savedCodes = selected?.permissions.map((permission) => permission.code) ?? [];
  const selectedCodes = draft.roleId === selected?.id ? draft.codes : savedCodes;

  const grouped = useMemo(() => {
    const groups = new Map<string, PermissionInfo[]>();
    for (const permission of permissions) {
      const group = permission.code.split(":")[0] ?? "other";
      const existing = groups.get(group) ?? [];
      existing.push(permission);
      groups.set(group, existing);
    }
    return [...groups.entries()];
  }, [permissions]);

  const readOnly = selected?.code === "administrator";
  const dirty =
    !readOnly &&
    selected !== undefined &&
    (selectedCodes.length !== selected.permissions.length ||
      selectedCodes.some(
        (code) => !selected.permissions.some((permission) => permission.code === code),
      ));

  function toggle(code: string) {
    if (!selected) {
      return;
    }
    setSaved(false);
    setDraft({
      roleId: selected.id,
      codes: selectedCodes.includes(code)
        ? selectedCodes.filter((item) => item !== code)
        : [...selectedCodes, code],
    });
  }

  async function save() {
    if (!selected) {
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await apiRequest<RoleDetail>(`/api/v1/roles/${selected.id}/permissions`, {
        method: "PATCH",
        token,
        body: { permission_codes: selectedCodes },
      });
      onRolesChange(roles.map((role) => (role.id === updated.id ? updated : role)));
      setDraft({
        roleId: updated.id,
        codes: updated.permissions.map((permission) => permission.code),
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat memperbarui izin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Izin peran"
        description="Perubahan berlaku seketika bagi setiap akun dengan peran ini. Peran administrator sengaja dibuat tetap."
      />
      <div className="grid gap-5 p-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-1.5">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => {
                setSelectedId(role.id);
                setSaved(false);
                setError(null);
                setDraft({
                  roleId: role.id,
                  codes: role.permissions.map((permission) => permission.code),
                });
              }}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                role.id === selected?.id
                  ? "border-primary/30 bg-primary-soft text-ink"
                  : "border-border bg-surface text-ink hover:bg-canvas"
              }`}
            >
              <span className="block font-semibold">{role.name}</span>
              <span className="block text-[11px] text-secondary">
                {role.permissions.length} izin
              </span>
            </button>
          ))}
        </div>

        <div className="min-w-0">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{selected.name}</h3>
                  <p className="mt-0.5 text-xs text-secondary">{selected.description}</p>
                </div>
                <Chip tone="neutral">{selected.code}</Chip>
              </div>

              {readOnly ? (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-soft px-3 py-2.5 text-xs text-ink">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  Izin administrator bersifat tetap dan tidak dapat diubah melalui API.
                </div>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {grouped.map(([group, groupPermissions]) => (
                  <div key={group} className="rounded-lg border border-border p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary">
                      {group}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {groupPermissions.map((permission) => (
                        <li key={permission.code}>
                          <label className="flex items-start gap-2 text-xs text-ink">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              disabled={readOnly || saving}
                              checked={selectedCodes.includes(permission.code)}
                              onChange={() => toggle(permission.code)}
                            />
                            <span>
                              <span className="block">{permission.name}</span>
                              <span className="block font-mono text-[10px] text-secondary">
                                {permission.code}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[11px] text-secondary" aria-live="polite">
                  {saved
                    ? "Izin tersimpan dan tercatat pada riwayat aktivitas."
                    : `${selectedCodes.length} dari ${permissions.length} izin dipilih.`}
                </p>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={readOnly || !dirty || saving || selectedCodes.length === 0}
                  className={primaryButtonClass}
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-3.5" aria-hidden="true" />
                  )}
                  Simpan izin
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
