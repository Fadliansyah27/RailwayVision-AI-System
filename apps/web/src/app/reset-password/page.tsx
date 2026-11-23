"use client";

import { ArrowLeft, KeyRound, Loader2, LockKeyhole, ShieldX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/form-styles";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { apiRequest, ApiError } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the token lives in the URL, which is unavailable during the server render
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Kata sandi tidak cocok.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        body: { token: token?.trim() ?? "", new_password: password },
      });
      router.replace("/login?reset=1");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Tidak dapat mereset kata sandi. Silakan minta tautan baru.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <PageHeader
          eyebrow="Pemulihan akun"
          title="Atur kata sandi baru"
          description="Gunakan tautan reset sekali pakai yang diterbitkan administrator Anda."
          actions={
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Kembali ke halaman masuk
            </Link>
          }
        />

        <Card>
          {token === null ? (
            <div className="flex items-center gap-2 p-6 text-sm text-secondary">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Membaca tautan reset…
            </div>
          ) : token ? (
            <>
              <CardHeader
                title="Kata sandi baru"
                description="Kata sandi minimal 10 karakter. Semua sesi aktif dicabut setelah reset."
              />
              <form className="space-y-4 p-5" onSubmit={handleSubmit}>
                {error ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2.5 text-sm text-ink"
                  >
                    {error}
                  </div>
                ) : null}
                <div>
                  <label className={labelClass} htmlFor="new-password">
                    Kata sandi baru
                  </label>
                  <div className="relative mt-1">
                    <LockKeyhole
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary"
                      aria-hidden="true"
                    />
                    <input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={10}
                      maxLength={128}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="confirm-password">
                    Konfirmasi kata sandi baru
                  </label>
                  <div className="relative mt-1">
                    <LockKeyhole
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary"
                      aria-hidden="true"
                    />
                    <input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={10}
                      maxLength={128}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className={primaryButtonClass}
                  disabled={submitting || password.length < 10}
                >
                  {submitting ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <KeyRound className="size-3.5" aria-hidden="true" />
                  )}
                  Perbarui kata sandi
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-start gap-3 p-6">
              <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-ink">Tautan reset tidak ditemukan</p>
                <p className="mt-1 text-sm leading-6 text-secondary">
                  Halaman ini memerlukan token sekali pakai. Buka tautan dari
                  administrator Anda, atau minta reset baru dari halaman masuk.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
