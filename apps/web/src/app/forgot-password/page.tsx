"use client";

import { ArrowLeft, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/form-styles";
import { AuthBrandLockup, AuthPhotoBackdrop, AuthPhotoBanner } from "@/components/auth-photo";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { apiRequest, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("/api/v1/auth/password-reset/request", {
        method: "POST",
        body: { email: email.trim() },
      });
      setSubmitted(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Tidak dapat mengirim permintaan reset. Silakan coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#0b0b0f] px-10 py-10 text-white lg:flex">
        <AuthPhotoBackdrop />
        <AuthBrandLockup />

        <div className="relative max-w-md space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--rv-sidebar-muted)]">
            Pemulihan akun
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Akses dipulihkan lewat verifikasi administrator, bukan tautan otomatis.
          </h1>
          <p className="text-sm leading-6 text-[color:var(--rv-sidebar-muted)]">
            Permintaan reset tercatat dalam riwayat aktivitas. Administrator memverifikasi
            identitas Anda sebelum menerbitkan tautan sekali pakai.
          </p>
          <ul className="space-y-3 text-sm text-[color:var(--rv-sidebar-muted)]">
            {[
              "Verifikasi identitas dilakukan administrator sebelum tautan diterbitkan.",
              "Tautan reset berlaku 30 menit dan hanya dapat digunakan satu kali.",
              "Tidak ada email atau SMS otomatis pada versi prototipe ini.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-white/80" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] leading-5 text-[color:var(--rv-sidebar-muted)]">
          Lingkungan prototipe. Seluruh akun dan catatan bersifat sintetis dan tidak boleh dianggap
          sebagai data operasional KCIC.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-md space-y-6">
          <AuthPhotoBanner className="lg:hidden" />

          <PageHeader
            eyebrow="Pemulihan akun"
            title="Lupa kata sandi"
            description="Ajukan reset kata sandi. Permintaan tercatat untuk ditinjau administrator."
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
            <CardHeader
              title="Permintaan reset"
              description="Tidak ada email yang dikirim pada versi ini. Administrator menerbitkan tautan reset sekali pakai setelah memverifikasi identitas Anda."
            />
            {submitted ? (
              <div className="space-y-4 p-5">
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-success/20 bg-success-soft px-3 py-2.5 text-sm text-ink"
                >
                  <ShieldCheck
                    className="mt-0.5 size-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <span>
                    Jika alamat tersebut milik akun aktif, permintaan reset telah
                    dicatat. Hubungi administrator Anda untuk menerima tautan reset.
                  </span>
                </div>
                <p className="text-xs leading-5 text-secondary">
                  Tautan sekali pakai berakhir setelah 30 menit dan hanya dapat digunakan satu kali.
                </p>
              </div>
            ) : (
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
                  <label className={labelClass} htmlFor="reset-email">
                    Email kerja
                  </label>
                  <div className="relative mt-1">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary"
                      aria-hidden="true"
                    />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@sintetis.railwayvision.example"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>
                <button type="submit" className={primaryButtonClass} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <KeyRound className="size-3.5" aria-hidden="true" />
                  )}
                  Minta reset kata sandi
                </button>
              </form>
            )}
          </Card>
        </div>
      </section>
    </main>
  );
}
