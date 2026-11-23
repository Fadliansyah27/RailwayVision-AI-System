"use client";

import { Copy, KeyRound, Loader2, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  primaryButtonClass,
  secondaryButtonClass,
  subtleButtonClass,
} from "@/components/admin/form-styles";
import { Card, CardHeader, Chip, EmptyState } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type PasswordResetRequestInfo,
  type PasswordResetTokenInfo,
} from "@/lib/api";

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

export function PasswordResetManagement({ token }: { token: string }) {
  const [requests, setRequests] = useState<PasswordResetRequestInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issued, setIssued] = useState<{
    userId: string;
    email: string;
    token: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    apiRequest<PasswordResetRequestInfo[]>(
      "/api/v1/password-reset-requests?status=pending",
      { token },
    )
      .then((data) => {
        if (!cancelled) {
          setRequests(data);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Tidak dapat memuat permintaan reset kata sandi.",
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
  }, [reloadKey, token]);

  async function issueLink(request: PasswordResetRequestInfo) {
    if (
      !window.confirm(
        `Terbitkan tautan reset sekali pakai untuk ${request.full_name}? Tautan kedaluwarsa dalam 30 menit dan hanya dapat digunakan sekali.`,
      )
    ) {
      return;
    }
    setBusyId(request.id);
    setError(null);
    try {
      const info = await apiRequest<PasswordResetTokenInfo>(
        `/api/v1/users/${request.user_id}/password-reset-token`,
        { method: "POST", token },
      );
      setCopied(false);
      setIssued({
        userId: request.user_id,
        email: request.email,
        token: info.token,
        expiresAt: info.expires_at,
      });
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat menerbitkan tautan reset.");
    } finally {
      setBusyId(null);
    }
  }

  const resetUrl = issued
    ? `${typeof window === "undefined" ? "" : window.location.origin}/reset-password?token=${encodeURIComponent(issued.token)}`
    : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(resetUrl);
      setCopied(true);
    } catch {
      setError("Gagal menyalin. Pilih dan salin tautan secara manual.");
    }
  }

  const term = search.trim().toLowerCase();
  const visible = term
    ? requests.filter(
        (request) =>
          request.email.toLowerCase().includes(term) ||
          request.full_name.toLowerCase().includes(term),
      )
    : requests;

  const refresh = useCallback(() => {
    setLoading(true);
    setReloadKey((value) => value + 1);
  }, []);

  return (
    <Card>
      <CardHeader
        title="Permintaan reset kata sandi"
        description="Pengguna mengajukan reset dari halaman masuk. Administrator memverifikasi identitas lalu menerbitkan tautan sekali pakai. Tidak ada email yang dikirim pada versi ini."
        actions={
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Muat ulang
          </button>
        }
      />
      <div className="space-y-4 p-5">
        {issued ? (
          <div className="space-y-2 rounded-xl border border-warning/20 bg-warning-soft px-4 py-3 text-sm text-ink">
            <p className="font-semibold">
              Tautan sekali pakai untuk {issued.email}. Ditampilkan hingga panel ini dimuat ulang;
              kedaluwarsa {formatTimestamp(issued.expiresAt)}.
            </p>
            <p className="break-all font-mono text-[11px]">{resetUrl}</p>
            <button type="button" className={secondaryButtonClass} onClick={() => void copyLink()}>
              <Copy className="size-3.5" aria-hidden="true" />
              {copied ? "Tersalin" : "Salin tautan"}
            </button>
            <p className="text-[11px] leading-4">
              Sampaikan tautan ini melalui kanal yang disetujui. Perlakukan sebagai kredensial:
              siapa pun yang memegang tautan dapat menetapkan kata sandi baru satu kali.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari berdasarkan nama atau email"
              aria-label="Cari permintaan reset"
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-secondary/70"
            />
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Memuat permintaan reset…
          </p>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="size-5" aria-hidden="true" />}
            title="Tidak ada permintaan reset tertunda"
            description="Pengguna dapat mengajukan reset dari halaman masuk. Permintaan yang perlu ditindaklanjuti muncul di sini."
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {visible.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{request.full_name}</p>
                  <p className="font-mono text-[11px] text-secondary">{request.email}</p>
                  <p className="mt-0.5 text-[11px] text-secondary">
                    Diminta {formatTimestamp(request.requested_at)}
                    {request.token_expires_at
                      ? ` · tautan kedaluwarsa ${formatTimestamp(request.token_expires_at)}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone="warning">
                    {request.status === "issued" ? "Tautan diterbitkan" : "Menunggu"}
                  </Chip>
                  <button
                    type="button"
                    className={issued?.userId === request.user_id ? subtleButtonClass : primaryButtonClass}
                    onClick={() => void issueLink(request)}
                    disabled={busyId === request.id}
                  >
                    {busyId === request.id ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <KeyRound className="size-3.5" aria-hidden="true" />
                    )}
                    {issued?.userId === request.user_id ? "Terbitkan ulang" : "Terbitkan tautan"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] leading-5 text-secondary">
          Menerbitkan tautan tidak mengungkap apakah alamat tersebut ada di tempat lain: daftar
          permintaan hanya berisi catatan di dalam cakupan organisasi Anda. Setiap tindakan
          penerbitan dicatat pada riwayat aktivitas.
        </p>
      </div>
    </Card>
  );
}
