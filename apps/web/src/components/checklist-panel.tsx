"use client";

import { ClipboardCheck, Loader2, Save } from "lucide-react";
import { useState } from "react";

import { inputClass, primaryButtonClass } from "@/components/admin/form-styles";
import { Card, CardHeader, Chip } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type InspectionChecklist,
  type InspectionDetail,
} from "@/lib/api";
import { formatDateTime } from "@/lib/domain";

const RESULT_OPTIONS = [
  { value: "", label: "Belum diisi" },
  { value: "pass", label: "Sesuai / lulus" },
  { value: "fail", label: "Tidak sesuai" },
  { value: "not_applicable", label: "Tidak berlaku" },
];

const RESULT_LABELS: Record<string, string> = {
  pass: "Sesuai / lulus",
  fail: "Tidak sesuai",
  not_applicable: "Tidak berlaku",
};

const RESULT_TONE: Record<string, "success" | "critical" | "neutral"> = {
  pass: "success",
  fail: "critical",
  not_applicable: "neutral",
};

interface DraftEntry {
  result: string;
  notes: string;
}

function initialDrafts(checklist: InspectionChecklist | null): Record<string, DraftEntry> {
  if (!checklist) {
    return {};
  }
  return Object.fromEntries(
    checklist.items.map((item) => [
      item.item_code,
      { result: item.result ?? "", notes: item.notes },
    ]),
  );
}

export function ChecklistPanel({
  inspection,
  token,
  editable,
  onUpdated,
}: {
  inspection: InspectionDetail;
  token: string | null;
  editable: boolean;
  onUpdated: (data: InspectionDetail) => void;
}) {
  const checklist = inspection.checklist;
  const [drafts, setDrafts] = useState<Record<string, DraftEntry>>(() =>
    initialDrafts(checklist),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!checklist) {
    return (
      <Card>
        <CardHeader
          title="Checklist inspeksi"
          description="Daftar periksa sesuai jenis inspeksi dan SOP yang berlaku."
        />
        <div className="flex items-start gap-3 p-5 text-sm text-secondary">
          <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
          <p>
            Belum ada template checklist aktif untuk jenis inspeksi ini. Template dikelola
            administrator pada halaman Administrasi; catatan lama tidak diubah.
          </p>
        </div>
      </Card>
    );
  }

  const dirty = checklist.items.some((item) => {
    const draft = drafts[item.item_code];
    return (
      !draft ||
      draft.result !== (item.result ?? "") ||
      draft.notes !== item.notes
    );
  });
  const unansweredRequired = checklist.items.filter(
    (item) => item.is_required && !(drafts[item.item_code]?.result ?? ""),
  ).length;

  async function saveChecklist() {
    if (!checklist || !dirty) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await apiRequest<InspectionDetail>(
        `/api/v1/inspections/${inspection.id}/checklist`,
        {
          method: "PATCH",
          token,
          body: {
            version: inspection.version,
            entries: checklist.items.map((item) => ({
              item_code: item.item_code,
              result: drafts[item.item_code]?.result || null,
              notes: drafts[item.item_code]?.notes.trim() ?? "",
            })),
          },
        },
      );
      onUpdated(updated);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Tidak dapat menyimpan checklist.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Checklist inspeksi"
        description={`${checklist.template_name ?? "Template"} · ${
          checklist.template_code ?? "tanpa kode"
        }${
          checklist.template_version ? ` · versi template ${checklist.template_version}` : ""
        }`}
        actions={
          <div className="flex items-center gap-2">
            <Chip tone={unansweredRequired ? "warning" : "success"}>
              {checklist.answered}/{checklist.total} terisi
            </Chip>
            {unansweredRequired ? (
              <span className="text-[11px] text-warning">
                {unansweredRequired} wajib belum diisi
              </span>
            ) : null}
          </div>
        }
      />
      <ul className="divide-y divide-border">
        {checklist.items.map((item) => {
          const draft = drafts[item.item_code] ?? { result: "", notes: "" };
          return (
            <li key={item.item_code} className="p-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{item.item_label}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-secondary">
                    {item.item_code} · {item.is_required ? "wajib" : "opsional"}
                  </p>
                </div>
                {!editable && item.result ? (
                  <Chip tone={RESULT_TONE[item.result] ?? "neutral"}>
                    {RESULT_LABELS[item.result] ?? item.result}
                  </Chip>
                ) : null}
              </div>

              {editable ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)]">
                  <select
                    aria-label={`Hasil ${item.item_label}`}
                    value={draft.result}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.item_code]: { ...draft, result: event.target.value },
                      }))
                    }
                    className={inputClass}
                    disabled={saving}
                  >
                    {RESULT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Catatan ${item.item_label}`}
                    value={draft.notes}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.item_code]: { ...draft, notes: event.target.value },
                      }))
                    }
                    placeholder="Catatan item (opsional)"
                    maxLength={2000}
                    className={inputClass}
                    disabled={saving}
                  />
                </div>
              ) : item.notes ? (
                <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-xs leading-5 text-secondary">
                  {item.notes}
                </p>
              ) : null}

              {!editable && item.recorded_by ? (
                <p className="mt-2 text-[11px] text-secondary">
                  Dicatat oleh {item.recorded_by.full_name} · {formatDateTime(item.updated_at)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editable ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
          <p className="text-xs text-secondary">
            Perubahan checklist menaikkan versi catatan dan tercatat pada riwayat aktivitas.
          </p>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={saveChecklist}
            disabled={saving || !dirty}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-3.5" aria-hidden="true" />
            )}
            {saving ? "Menyimpan…" : "Simpan checklist"}
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="border-t border-critical/20 bg-critical-soft px-5 py-3 text-xs text-ink">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
