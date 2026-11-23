import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border/80 bg-gradient-to-br from-canvas to-surface text-secondary shadow-[var(--rv-shadow-xs)]">
        <SearchX className="size-6" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Halaman tidak ditemukan</h1>
      <p className="text-sm leading-6 text-secondary">
        Halaman yang Anda minta tidak ada atau tidak tersedia pada versi ini. Modul yang belum
        mencapai fase pengiriman disembunyikan dari navigasi.
      </p>
      <Link
        href="/"
        className="rv-btn-primary text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Kembali ke ringkasan
      </Link>
    </div>
  );
}
