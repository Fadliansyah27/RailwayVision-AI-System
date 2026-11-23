import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-canvas text-secondary">
        <SearchX className="size-6" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Halaman tidak ditemukan</h1>
      <p className="text-sm leading-6 text-secondary">
        Halaman yang Anda minta tidak ada atau tidak tersedia pada versi ini. Modul yang belum
        mencapai fase pengiriman disembunyikan dari navigasi.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-strong"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Kembali ke ringkasan
      </Link>
    </div>
  );
}
