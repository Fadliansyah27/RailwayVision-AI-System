"use client";

import { ArrowLeft, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/form-styles";
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
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md space-y-6">
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
                    placeholder="name@demo.railwayvision.example"
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
    </main>
  );
}
