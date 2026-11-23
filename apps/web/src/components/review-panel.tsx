"use client";

import { ClipboardCheck, FileWarning, Loader2, RotateCcw } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/admin/form-styles";
import { Card, CardHeader, Chip, EmptyState } from "@/components/ui";
import { apiRequest, ApiError, type InspectionDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  REVIEW_DECISION_LABELS,
  formatDateTime,
  reviewDecisionTone,
} from "@/lib/domain";

type Decision = "accepted" | "returned" | "inconclusive";

const REVIEWABLE = ["submitted", "ai_processed", "under_review"];

const DECISION_MESSAGES: Record<Decision, string> = {
  accepted: "Terima inspeksi ini sebagai telah ditinjau? Catatan menjadi hanya-baca.",
  returned:
    "Kembalikan inspeksi ini untuk klarifikasi? Catatan dibuka kembali sebagai draf bagi inspektur yang ditugaskan.",
  inconclusive:
    "Catat inspeksi ini sebagai tidak dapat disimpulkan? Catatan ditutup dan supervisor dapat membukanya kembali.",
};

const DECISION_HINTS: Record<Decision, string> = {
  accepted: "Menerima memindahkan inspeksi ke Telah Ditinjau dan membuatnya hanya-baca.",
  returned:
    "Mengembalikan membuka kembali catatan sebagai draf agar inspektur yang ditugaskan merevisi dan mengirim ulang.",
  inconclusive:
    "Tidak dapat disimpulkan menutup catatan bila kelengkapan tidak dapat diverifikasi; supervisor dapat membukanya kembali.",
};

export function ReviewPanel({
  inspection,
  canReview,
  onReviewed,
}: {
  inspection: InspectionDetail;
  canReview: boolean;
  onReviewed: (data: InspectionDetail) => void;
}) {
  const { token, user } = useAuth();
  const [decision, setDecision] = useState<Decision>("accepted");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnRecord = inspection.inspector.id === user?.id;
  const canDecide =
    canReview && REVIEWABLE.includes(inspection.status) && !isOwnRecord;

  async function recordDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(DECISION_MESSAGES[decision])) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await apiRequest<InspectionDetail>(
        `/api/v1/inspections/${inspection.id}/review`,
        {
          method: "POST",
          token,
          body: { decision, notes: notes.trim(), version: inspection.version },
        },
      );
      setNotes("");
      setDecision("accepted");
      onReviewed(updated);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Tidak dapat mencatat keputusan peninjauan.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Peninjauan manusia"
        description="Keputusan kelengkapan catatan oleh peninjau berwenang. Ini bukan izin keselamatan."
      />

      {canDecide ? (
        <form className="space-y-4 border-b border-border p-5" onSubmit={recordDecision}>
          <div>
            <label className={labelClass} htmlFor="review-decision">
              Keputusan
            </label>
            <select
              id="review-decision"
              className={`${inputClass} mt-1`}
              value={decision}
              onChange={(event) => setDecision(event.target.value as Decision)}
            >
              <option value="accepted">Terima — catatan terverifikasi lengkap</option>
              <option value="returned">Kembalikan — buka kembali sebagai draf untuk revisi</option>
              <option value="inconclusive">
                Tidak dapat disimpulkan — kelengkapan catatan tidak dapat diverifikasi
              </option>
            </select>
            <p className="mt-1 text-xs leading-5 text-secondary">{DECISION_HINTS[decision]}</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="review-notes">
              Catatan peninjau
            </label>
            <textarea
              id="review-notes"
              className={`${inputClass} mt-1 min-h-28`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              minLength={5}
              maxLength={2000}
              required
              placeholder="Apa yang diperiksa, dan apa yang harus ditindaklanjuti inspektur bila dikembalikan."
            />
            <p className="mt-1 text-right font-mono text-[10px] text-secondary">
              {notes.length} / 2000 · versi {inspection.version}
            </p>
          </div>
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-sm text-ink"
            >
              <FileWarning className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden="true" />
              {error}
            </div>
          ) : null}
          <button type="submit" className={primaryButtonClass} disabled={saving}>
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : decision === "accepted" ? (
              <ClipboardCheck className="size-3.5" aria-hidden="true" />
            ) : (
              <RotateCcw className="size-3.5" aria-hidden="true" />
            )}
            Catat keputusan
          </button>
        </form>
      ) : null}

      {REVIEWABLE.includes(inspection.status) && isOwnRecord ? (
        <p className="border-b border-border px-5 py-3 text-xs leading-5 text-secondary">
          Inspektur yang ditugaskan tidak dapat meninjau catatannya sendiri. Peninjau lain atau
          supervisor harus memutuskan.
        </p>
      ) : null}

      {inspection.reviews.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-5" aria-hidden="true" />}
          title="Belum ada keputusan peninjauan"
          description={
            REVIEWABLE.includes(inspection.status)
              ? "Peninjau berwenang dapat menerima catatan, mengembalikannya untuk revisi, atau menandainya tidak dapat disimpulkan."
              : "Catatan ini belum memiliki keputusan peninjauan manusia."
          }
        />
      ) : (
        <ol className="divide-y divide-border">
          {inspection.reviews.map((review) => (
            <li key={review.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={reviewDecisionTone(review.decision)}>
                  {REVIEW_DECISION_LABELS[review.decision] ?? review.decision}
                </Chip>
                <span className="text-xs text-secondary">
                  {review.reviewer.full_name} · {formatDateTime(review.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{review.notes}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
