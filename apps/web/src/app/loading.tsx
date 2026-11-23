import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center gap-3 py-24 text-sm text-secondary" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Memuat ruang kerja…
    </div>
  );
}
