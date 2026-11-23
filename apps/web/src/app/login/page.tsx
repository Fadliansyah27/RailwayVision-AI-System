"use client";

import { KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Chip } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DEMO_ACCOUNTS = [
  "admin@demo.railwayvision.example",
  "inspector@demo.railwayvision.example",
  "reviewer@demo.railwayvision.example",
  "supervisor@demo.railwayvision.example",
  "ai@demo.railwayvision.example",
  "auditor@demo.railwayvision.example",
];

export default function LoginPage() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL-only notice shown once on mount
      setPasswordReset(true);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex items-center gap-2 text-sm text-secondary">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {status === "loading" ? "Memeriksa sesi…" : "Membuka ruang kerja…"}
        </div>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.status === 401
            ? "Email atau kata sandi tidak valid."
            : caught.message
          : "Gagal masuk. Silakan coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar px-10 py-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 10%, rgba(198,31,51,0.35), transparent 45%), radial-gradient(circle at 90% 80%, rgba(168,25,45,0.30), transparent 42%)",
          }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary font-semibold">
            RV
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">RailwayVision AI</p>
            <p className="text-[11px] text-[color:var(--rv-sidebar-muted)]">
              Pendukung keputusan inspeksi · prototipe PT KCIC
            </p>
          </div>
        </div>

        <div className="relative max-w-md space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--rv-sidebar-muted)]">
            Ruang kerja inspeksi aman
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Bukti, verifikasi, dan tindakan perbaikan dalam satu catatan terkelola.
          </h1>
          <p className="text-sm leading-6 text-[color:var(--rv-sidebar-muted)]">
            Setiap saran AI bersifat advisori. Pemeriksa teknis yang berwenang membuat keputusan
            rekayasa, dan setiap tindakan penting tercatat dalam riwayat aktivitas yang tidak dapat diubah.
          </p>
          <ul className="space-y-3 text-sm text-[color:var(--rv-sidebar-muted)]">
            {[
              "Akses berbasis peran ditegakkan oleh API, bukan oleh antarmuka.",
              "Cakupan koridor membatasi aset dan catatan yang dapat Anda akses.",
              "Tanpa fungsi kendali kereta, persinyalan, atau izin keselamatan.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] leading-5 text-[color:var(--rv-sidebar-muted)]">
          Lingkungan DEMO. Seluruh akun dan catatan bersifat sintetis dan tidak boleh dianggap sebagai
          data operasional KCIC.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
              RV
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">RailwayVision AI</p>
              <p className="text-[11px] text-secondary">Pendukung keputusan inspeksi</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Masuk
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                Akses ruang kerja Anda
              </h2>
            </div>
            <Chip tone="warning">DEMO</Chip>
          </div>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Gunakan akun DEMO yang berwenang. Sesi berakhir otomatis dan diperbarui
            secara aman di latar belakang.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            {passwordReset ? (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-success/20 bg-success-soft px-3 py-2.5 text-sm text-ink"
              >
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                Kata sandi diperbarui. Masuk dengan kata sandi baru Anda.
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2.5 text-sm text-ink"
              >
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="email" className="text-xs font-semibold text-ink">
                Email kerja
              </label>
              <div className="relative mt-1.5">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@demo.railwayvision.example"
                  className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-secondary/70"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-semibold text-ink">
                Kata sandi
              </label>
              <div className="relative mt-1.5">
                <LockKeyhole
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary"
                  aria-hidden="true"
                />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-secondary/70"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="size-4" aria-hidden="true" />
              )}
              {submitting ? "Sedang masuk…" : "Masuk"}
            </button>
          </form>

          <p className="mt-3 text-right text-xs">
            <Link
              href="/forgot-password"
              className="font-semibold text-primary hover:underline"
            >
              Lupa kata sandi?
            </Link>
          </p>

          <div className="mt-8 rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Akun DEMO
            </p>
            <p className="mt-1 text-xs leading-5 text-secondary">
              Kata sandi akun demo ditentukan oleh{" "}
              <code className="font-mono text-ink">DEMO_SEED_PASSWORD</code> pada konfigurasi
              server lokal. Nilai contoh tidak disimpan di aplikasi.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account}
                  type="button"
                  onClick={() => {
                    setEmail(account);
                    setError(null);
                  }}
                  className="rounded-md border border-border bg-canvas px-2 py-1 font-mono text-[10px] text-ink hover:border-primary/40 hover:text-primary"
                >
                  {account.split("@")[0]}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] leading-5 text-secondary">
            Hanya alat bantu. Belum tervalidasi untuk inspeksi keselamatan KCIC.
          </p>
        </div>
      </section>
    </main>
  );
}
