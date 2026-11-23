"use client";

import { KeyRound, Loader2, LogOut, Save, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import { Card, CardHeader, Chip, PageHeader } from "@/components/ui";
import { apiRequest, ApiError, type CurrentUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Ini sesi pertama Anda.";
  }
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

export default function ProfilePage() {
  const { user, token, updateUser, signOut } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [profileState, setProfileState] = useState<{
    saving: boolean;
    message: string | null;
    error: string | null;
  }>({ saving: false, message: null, error: null });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordState, setPasswordState] = useState<{
    saving: boolean;
    message: string | null;
    error: string | null;
  }>({ saving: false, message: null, error: null });

  if (!user || !token) {
    return null;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileState({ saving: true, message: null, error: null });
    try {
      const updated = await apiRequest<CurrentUser>("/api/v1/auth/me", {
        method: "PATCH",
        token,
        body: { full_name: fullName.trim() },
      });
      updateUser(updated);
      setProfileState({ saving: false, message: "Profil diperbarui.", error: null });
    } catch (caught) {
      setProfileState({
        saving: false,
        message: null,
        error: caught instanceof ApiError ? caught.message : "Tidak dapat memperbarui profil.",
      });
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordState({
        saving: false,
        message: null,
        error: "Kata sandi baru dan konfirmasi tidak cocok.",
      });
      return;
    }
    setPasswordState({ saving: true, message: null, error: null });
    try {
      await apiRequest<void>("/api/v1/auth/change-password", {
        method: "POST",
        token,
        body: { current_password: currentPassword, new_password: newPassword },
      });
      setPasswordState({
        saving: false,
        message: "Kata sandi diubah. Semua sesi dicabut; mengalihkan ke halaman masuk…",
        error: null,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await signOut();
    } catch (caught) {
      setPasswordState({
        saving: false,
        message: null,
        error: caught instanceof ApiError ? caught.message : "Tidak dapat mengubah kata sandi.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Akun · Fase 2"
        title="Profil Anda"
        description="Identitas, peran, dan cakupan organisasi Anda dibaca dari server pada setiap permintaan. Token akses berumur pendek; sesi diperbarui melalui cookie HttpOnly."
        actions={
          <button type="button" onClick={() => void signOut()} className={secondaryButtonClass}>
            <LogOut className="size-3.5" aria-hidden="true" />
            Keluar
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Detail akun" description="Bidang identitas hanya-baca dari API." />
          <dl className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <dt className={labelClass}>Email</dt>
              <dd className="mt-1 font-mono text-sm text-ink">{user.email}</dd>
            </div>
            <div>
              <dt className={labelClass}>Status</dt>
              <dd className="mt-1">
                <Chip tone={user.is_active ? "success" : "critical"}>
                  {user.is_active ? "Aktif" : "Nonaktif"}
                </Chip>
              </dd>
            </div>
            <div>
              <dt className={labelClass}>Cakupan organisasi</dt>
              <dd className="mt-1 text-sm text-ink">
                {user.scope.name}{" "}
                <span className="font-mono text-xs text-secondary">({user.scope.code})</span>
              </dd>
            </div>
            <div>
              <dt className={labelClass}>Peran</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {user.roles.map((role) => (
                  <Chip key={role.code}>{role.name}</Chip>
                ))}
              </dd>
            </div>
            <div>
              <dt className={labelClass}>Terakhir masuk</dt>
              <dd className="mt-1 text-sm text-secondary">
                {formatTimestamp(user.last_login_at)}
              </dd>
            </div>
            <div>
              <dt className={labelClass}>Izin</dt>
              <dd className="mt-1 text-sm text-ink">{user.permissions.length} diberikan</dd>
            </div>
          </dl>

          <div className="border-t border-border p-5">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={saveProfile}>
              <div className="flex-1">
                <label htmlFor="profile-name" className={labelClass}>
                  Nama tampilan
                </label>
                <input
                  id="profile-name"
                  required
                  minLength={2}
                  maxLength={160}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>
              <button
                type="submit"
                disabled={profileState.saving || fullName.trim() === user.full_name}
                className={primaryButtonClass}
              >
                {profileState.saving ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-3.5" aria-hidden="true" />
                )}
                Simpan nama
              </button>
            </form>
            {profileState.message ? (
              <p role="status" className="mt-2 text-xs text-success">
                {profileState.message}
              </p>
            ) : null}
            {profileState.error ? (
              <p role="alert" className="mt-2 text-xs text-critical">
                {profileState.error}
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Ubah kata sandi"
            description="Mengubah kata sandi mencabut semua sesi aktif, termasuk sesi ini."
          />
          <form className="space-y-3 p-5" onSubmit={changePassword}>
            <div>
              <label htmlFor="current-password" className={labelClass}>
                Kata sandi saat ini
              </label>
              <input
                id="current-password"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={`mt-1.5 ${inputClass}`}
              />
            </div>
            <div>
              <label htmlFor="new-password" className={labelClass}>
                Kata sandi baru
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={`mt-1.5 ${inputClass}`}
              />
              <p className="mt-1 text-[11px] text-secondary">Minimal 10 karakter.</p>
            </div>
            <div>
              <label htmlFor="confirm-password" className={labelClass}>
                Konfirmasi kata sandi baru
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={`mt-1.5 ${inputClass}`}
              />
            </div>
            {passwordState.error ? (
              <p
                role="alert"
                className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
              >
                {passwordState.error}
              </p>
            ) : null}
            {passwordState.message ? (
              <p
                role="status"
                className="rounded-lg border border-success/20 bg-success-soft px-3 py-2 text-xs text-ink"
              >
                {passwordState.message}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={passwordState.saving || !currentPassword || !newPassword}
              className={`w-full ${primaryButtonClass}`}
            >
              {passwordState.saving ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="size-3.5" aria-hidden="true" />
              )}
              Ubah kata sandi
            </button>
            <p className="flex items-start gap-1.5 text-[11px] leading-5 text-secondary">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
              Kata sandi disimpan sebagai hash Argon2id; token refresh hanya disimpan sebagai
              digest SHA-256.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
