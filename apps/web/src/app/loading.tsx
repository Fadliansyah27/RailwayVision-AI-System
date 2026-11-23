import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-24 text-sm text-secondary"
      role="status"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl border border-border/80 bg-surface text-primary shadow-[var(--rv-shadow-xs)]">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      </div>
      Memuat ruang kerja…
    </div>
  );
}
