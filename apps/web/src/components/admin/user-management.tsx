"use client";

import { Copy, Loader2, Plus, Search, UserX, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  dangerButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  subtleButtonClass,
} from "@/components/admin/form-styles";
import { Pagination } from "@/components/records";
import { Card, CardHeader, Chip, EmptyState } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type Page,
  type PasswordResetTokenInfo,
  type RoleDetail,
  type ScopeInfo,
  type UserAdmin,
} from "@/lib/api";

type Editor = { mode: "create" } | { mode: "edit"; user: UserAdmin } | null;

interface UserFilters {
  search: string;
  roleCode: string;
  scopeId: string;
  status: "active" | "inactive" | "";
}

const EMPTY_FILTERS: UserFilters = { search: "", roleCode: "", scopeId: "", status: "" };
const PAGE_SIZE = 20;

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Belum pernah";
  }
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

function UserEditor({
  token,
  editor,
  roles,
  scopes,
  currentUserId,
  onSaved,
  onCancel,
}: {
  token: string;
  editor: Exclude<Editor, null>;
  roles: RoleDetail[];
  scopes: ScopeInfo[];
  currentUserId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const editing = editor.mode === "edit" ? editor.user : null;
  const [email, setEmail] = useState(editing?.email ?? "");
  const [fullName, setFullName] = useState(editing?.full_name ?? "");
  const [password, setPassword] = useState("");
  const [scopeId, setScopeId] = useState(editing?.scope.id ?? scopes[0]?.id ?? "");
  const [roleCodes, setRoleCodes] = useState<string[]>(
    editing?.roles.map((role) => role.code) ?? ["inspector"],
  );
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleRole(code: string) {
    setRoleCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editor.mode === "create") {
        await apiRequest<UserAdmin>("/api/v1/users", {
          method: "POST",
          token,
          body: {
            email: email.trim(),
            full_name: fullName.trim(),
            password,
            scope_id: scopeId,
            role_codes: roleCodes,
            is_active: isActive,
          },
        });
      } else {
        await apiRequest<UserAdmin>(`/api/v1/users/${editor.user.id}`, {
          method: "PATCH",
          token,
          body: {
            full_name: fullName.trim(),
            scope_id: scopeId,
            role_codes: roleCodes,
            is_active: isActive,
          },
        });
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat menyimpan pengguna.");
    } finally {
      setSaving(false);
    }
  }

  const editingSelf = editing?.id === currentUserId;

  return (
    <div className="rounded-xl border border-border bg-canvas/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {editor.mode === "create" ? "Buat pengguna sintetis" : `Ubah ${editing?.full_name}`}
          </h3>
          <p className="mt-1 text-xs leading-5 text-secondary">
            Peran ditegakkan oleh API. Cakupan membatasi catatan yang dapat dijangkau akun ini.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1.5 text-secondary hover:bg-canvas hover:text-ink"
          aria-label="Tutup editor pengguna"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="user-email" className={labelClass}>
              Email
            </label>
            <input
              id="user-email"
              type="email"
              required
              disabled={editor.mode === "edit"}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <label htmlFor="user-name" className={labelClass}>
              Nama lengkap
            </label>
            <input
              id="user-name"
              required
              minLength={2}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          {editor.mode === "create" ? (
            <div>
              <label htmlFor="user-password" className={labelClass}>
                Kata sandi awal
              </label>
              <input
                id="user-password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`mt-1.5 ${inputClass}`}
              />
              <p className="mt-1 text-[11px] text-secondary">Minimal 10 karakter.</p>
            </div>
          ) : null}
          <div>
            <label htmlFor="user-scope" className={labelClass}>
              Cakupan organisasi
            </label>
            <select
              id="user-scope"
              required
              value={scopeId}
              onChange={(event) => setScopeId(event.target.value)}
              className={`mt-1.5 ${inputClass}`}
            >
              {scopes.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.code} — {scope.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>Peran</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <label
                key={role.code}
                className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={roleCodes.includes(role.code)}
                  onChange={() => toggleRole(role.code)}
                />
                <span>
                  <span className="block font-semibold text-ink">{role.name}</span>
                  <span className="block text-[11px] text-secondary">{role.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={isActive}
              disabled={editingSelf}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Akun aktif
            {editingSelf ? (
              <span className="text-[11px] text-secondary">(Anda tidak dapat menonaktifkan akun sendiri)</span>
            ) : null}
          </label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} className={secondaryButtonClass}>
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || roleCodes.length === 0 || !scopeId}
              className={primaryButtonClass}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
              {editor.mode === "create" ? "Buat pengguna" : "Simpan perubahan"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function UserManagement({
  token,
  currentUserId,
  roles,
  scopes,
}: {
  token: string;
  currentUserId: string;
  roles: RoleDetail[];
  scopes: ScopeInfo[];
}) {
  const [editor, setEditor] = useState<Editor>(null);
  const [users, setUsers] = useState<Page<UserAdmin> | null>(null);
  const [filters, setFilters] = useState<UserFilters>(EMPTY_FILTERS);
  const [formFilters, setFormFilters] = useState<UserFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<{
    userId: string;
    token: string;
    expiresAt: string;
  } | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (filters.search) {
        params.set("search", filters.search);
      }
      if (filters.roleCode) {
        params.set("role_code", filters.roleCode);
      }
      if (filters.scopeId) {
        params.set("scope_id", filters.scopeId);
      }
      if (filters.status) {
        params.set("is_active", filters.status === "active" ? "true" : "false");
      }
      const data = await apiRequest<Page<UserAdmin>>(`/api/v1/users?${params}`, { token });
      setUsers(data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat memuat pengguna.");
    } finally {
      setLoading(false);
    }
  }, [filters, page, token]);

  useEffect(() => {
    // Fetch-on-mount: state updates occur only after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function reload() {
    setLoading(true);
    void load();
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setFilters({
      ...formFilters,
      search: formFilters.search.trim(),
    });
  }

  function resetFilters() {
    setFormFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  async function deactivate(user: UserAdmin) {
    if (!window.confirm(`Nonaktifkan ${user.full_name}? Seluruh sesi aktif akan dicabut.`)) {
      return;
    }
    try {
      await apiRequest<UserAdmin>(`/api/v1/users/${user.id}/deactivate`, {
        method: "POST",
        token,
      });
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat menonaktifkan pengguna.");
    }
  }

  async function issueReset(user: UserAdmin) {
    if (
      !window.confirm(
        `Terbitkan tautan reset sekali pakai untuk ${user.full_name}? Pengguna harus memiliki permintaan reset tertunda; tautan kedaluwarsa setelah 30 menit.`,
      )
    ) {
      return;
    }
    setResetBusy(true);
    setError(null);
    try {
      const info = await apiRequest<PasswordResetTokenInfo>(
        `/api/v1/users/${user.id}/password-reset-token`,
        { method: "POST", token },
      );
      setCopied(false);
      setResetLink({ userId: user.id, token: info.token, expiresAt: info.expires_at });
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Tidak dapat menerbitkan tautan reset.",
      );
    } finally {
      setResetBusy(false);
    }
  }

  async function copyResetLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("Gagal menyalin. Pilih dan salin tautan secara manual.");
    }
  }

  const detail = users?.items.find((user) => user.id === detailId) ?? null;
  const detailResetLink = detail && resetLink?.userId === detail.id ? resetLink : null;
  const resetUrl = detailResetLink
    ? `${typeof window === "undefined" ? "" : window.location.origin}/reset-password?token=${encodeURIComponent(detailResetLink.token)}`
    : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Daftar pengguna"
          description="Akun sintetis untuk prototipe ini. Buat akun, ubah peran dan cakupan, atau nonaktifkan akses."
          actions={
            <button
              type="button"
              onClick={() => setEditor({ mode: "create" })}
              className={primaryButtonClass}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Tambah pengguna
            </button>
          }
        />
        <div className="space-y-4 p-5">
          {editor ? (
            <UserEditor
              key={editor.mode === "edit" ? editor.user.id : "create"}
              token={token}
              editor={editor}
              roles={roles}
              scopes={scopes}
              currentUserId={currentUserId}
              onSaved={() => {
                setEditor(null);
                reload();
              }}
              onCancel={() => setEditor(null)}
            />
          ) : null}

          {detail ? (
            <div className="rounded-xl border border-border bg-canvas/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    {detail.full_name}{" "}
                    <span className="font-mono text-[11px] text-secondary">{detail.email}</span>
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-secondary">
                    Detail akun. Tautan reset kata sandi hanya diterbitkan setelah pengguna
                    mengajukan reset.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetailId(null);
                    setResetLink(null);
                  }}
                  className="rounded-md p-1.5 text-secondary hover:bg-canvas hover:text-ink"
                  aria-label="Tutup detail pengguna"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="font-medium text-secondary">Cakupan</dt>
                  <dd className="mt-0.5 text-ink">
                    {detail.scope.code} — {detail.scope.name}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-secondary">Peran</dt>
                  <dd className="mt-0.5 text-ink">
                    {detail.roles.map((role) => role.name).join(", ") || "Tidak ada"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-secondary">Status</dt>
                  <dd className="mt-0.5 text-ink">
                    {detail.is_active ? "Aktif" : "Nonaktif"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-secondary">Dibuat</dt>
                  <dd className="mt-0.5 text-ink">{formatTimestamp(detail.created_at)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-secondary">Terakhir diperbarui</dt>
                  <dd className="mt-0.5 text-ink">{formatTimestamp(detail.updated_at)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-secondary">Terakhir masuk</dt>
                  <dd className="mt-0.5 text-ink">{formatTimestamp(detail.last_login_at)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditor({ mode: "edit", user: detail })}
                  className={subtleButtonClass}
                >
                  Ubah pengguna
                </button>
                <button
                  type="button"
                  onClick={() => void issueReset(detail)}
                  className={secondaryButtonClass}
                  disabled={resetBusy || !detail.is_active}
                >
                  {resetBusy ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : null}
                  Terbitkan tautan reset
                </button>
                {!detail.is_active ? (
                  <span className="text-[11px] text-secondary">
                    Akun nonaktif tidak dapat mereset kata sandi.
                  </span>
                ) : null}
              </div>
              {detailResetLink ? (
                <div className="mt-3 space-y-2 rounded-lg border border-warning/20 bg-warning-soft px-3 py-2 text-xs text-ink">
                  <p className="font-semibold">
                    Tautan sekali pakai, ditampilkan hingga Anda meninggalkan panel ini.
                    Kedaluwarsa {formatTimestamp(detailResetLink.expiresAt)}.
                  </p>
                  <p className="break-all font-mono text-[11px]">{resetUrl}</p>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => void copyResetLink(resetUrl)}
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                    {copied ? "Tersalin" : "Salin tautan"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={applyFilters}>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="user-search">
                Cari
              </label>
              <div className="relative mt-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary"
                  aria-hidden="true"
                />
                <input
                  id="user-search"
                  value={formFilters.search}
                  onChange={(event) =>
                    setFormFilters((current) => ({ ...current, search: event.target.value }))
                  }
                  placeholder="Nama atau email"
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="user-role-filter">
                Peran
              </label>
              <select
                id="user-role-filter"
                value={formFilters.roleCode}
                onChange={(event) =>
                  setFormFilters((current) => ({ ...current, roleCode: event.target.value }))
                }
                className={`${inputClass} mt-1`}
              >
                <option value="">Semua peran</option>
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="user-scope-filter">
                Cakupan
              </label>
              <select
                id="user-scope-filter"
                value={formFilters.scopeId}
                onChange={(event) =>
                  setFormFilters((current) => ({ ...current, scopeId: event.target.value }))
                }
                className={`${inputClass} mt-1`}
              >
                <option value="">Semua cakupan</option>
                {scopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {scope.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="user-status-filter">
                Status
              </label>
              <select
                id="user-status-filter"
                value={formFilters.status}
                onChange={(event) =>
                  setFormFilters((current) => ({
                    ...current,
                    status: event.target.value as UserFilters["status"],
                  }))
                }
                className={`${inputClass} mt-1`}
              >
                <option value="">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
              <button type="submit" className={primaryButtonClass}>
                Terapkan filter
              </button>
              <button type="button" onClick={resetFilters} className={secondaryButtonClass}>
                Atur ulang
              </button>
            </div>
          </form>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
            >
              {error}
            </p>
          ) : null}

          {loading && !users ? (
            <div className="flex items-center gap-2 px-1 py-8 text-sm text-secondary">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Memuat pengguna…
            </div>
          ) : null}

          {!loading && users && users.items.length === 0 ? (
            <EmptyState
              title="Tidak ada pengguna yang cocok"
              description="Sesuaikan filter atau buat akun sintetis baru."
            />
          ) : null}

          {users && users.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="rv-table min-w-[760px]">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Pengguna
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Cakupan
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Peran
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Terakhir masuk
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Tindakan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.items.map((user) => (
                    <tr key={user.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-3">
                        <p className="font-medium text-ink">{user.full_name}</p>
                        <p className="font-mono text-[11px] text-secondary">{user.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-ink">{user.scope.code}</p>
                        <p className="text-[11px] text-secondary">{user.scope.name}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Chip key={role.code}>{role.name}</Chip>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Chip tone={user.is_active ? "success" : "neutral"}>
                          {user.is_active ? "Aktif" : "Nonaktif"}
                        </Chip>
                      </td>
                      <td className="px-3 py-3 text-xs text-secondary">
                        {formatTimestamp(user.last_login_at)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailId(user.id);
                              setResetLink(null);
                              setCopied(false);
                            }}
                            className={subtleButtonClass}
                          >
                            Detail
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditor({ mode: "edit", user })}
                            className={subtleButtonClass}
                          >
                            Ubah
                          </button>
                          {user.is_active && user.id !== currentUserId ? (
                            <button
                              type="button"
                              onClick={() => void deactivate(user)}
                              className={dangerButtonClass}
                            >
                              <UserX className="size-3" aria-hidden="true" />
                              Nonaktifkan
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={users.page}
                pageSize={users.page_size}
                total={users.total}
                onPage={setPage}
              />
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
