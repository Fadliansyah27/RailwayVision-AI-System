"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled dashboard error", error.digest ?? "");
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-critical-soft text-critical">
        <CircleAlert className="size-6" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Terjadi kesalahan</h1>
      <p className="text-sm leading-6 text-secondary">
        Dasbor tidak dapat menyelesaikan permintaan ini. Tidak ada detail sensitif yang ditampilkan.
        Coba lagi tindakan tersebut, atau kembali ke ringkasan.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-strong"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Coba Lagi
        </button>
        <Link
          href="/"
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Kembali ke ringkasan
        </Link>
      </div>
    </div>
  );
}
