import { ChevronLeft, ChevronRight } from "lucide-react";

import { Chip } from "@/components/ui";
import {
  ASSET_STATUS_LABELS,
  FINDING_PRIORITY_LABELS,
  FINDING_STATUS_LABELS,
  INSPECTION_STATUS_LABELS,
  WORK_ORDER_STATUS_LABELS,
  assetStatusTone,
  findingPriorityTone,
  findingStatusTone,
  inspectionStatusTone,
  isDemoRecord,
  workOrderStatusTone,
} from "@/lib/domain";

export function DemoBadge({ code, reference }: { code?: string; reference?: string }) {
  if (!isDemoRecord({ code, reference })) {
    return null;
  }
  return <Chip tone="neutral">DEMO</Chip>;
}

export function AssetStatusChip({ status }: { status: string }) {
  return <Chip tone={assetStatusTone(status)}>{ASSET_STATUS_LABELS[status] ?? status}</Chip>;
}

export function InspectionStatusChip({ status }: { status: string }) {
  return (
    <Chip tone={inspectionStatusTone(status)}>
      {INSPECTION_STATUS_LABELS[status] ?? status}
    </Chip>
  );
}

export function FindingStatusChip({ status }: { status: string }) {
  return (
    <Chip tone={findingStatusTone(status)}>{FINDING_STATUS_LABELS[status] ?? status}</Chip>
  );
}

export function FindingPriorityChip({ priority }: { priority: string }) {
  return (
    <Chip tone={findingPriorityTone(priority)}>
      {FINDING_PRIORITY_LABELS[priority] ?? priority}
    </Chip>
  );
}

export function WorkOrderStatusChip({ status }: { status: string }) {
  return (
    <Chip tone={workOrderStatusTone(status)}>{WORK_ORDER_STATUS_LABELS[status] ?? status}</Chip>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
      <p className="text-xs text-secondary">
        {total === 0 ? "Tidak ada catatan" : `Menampilkan ${first}–${last} dari ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Sebelumnya
        </button>
        <span className="font-mono text-xs text-secondary">
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
        >
          Berikutnya
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
