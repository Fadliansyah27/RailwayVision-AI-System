"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileWarning,
  History,
  ImageOff,
  Info,
  Loader2,
  Pencil,
  ShieldX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import { ChecklistPanel } from "@/components/checklist-panel";
import { DemoBadge, InspectionStatusChip } from "@/components/records";
import { FindingsPanel } from "@/components/findings-panel";
import { MediaPanel } from "@/components/media-panel";
import { ReviewPanel } from "@/components/review-panel";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type AuditEvent,
  type InspectionDetail,
  type Page,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  INSPECTION_STATUS_LABELS,
  INSPECTION_TYPE_LABELS,
  formatDateTime,
  toDatetimeLocalValue,
} from "@/lib/domain";

const REVIEW_STARTABLE = ["submitted", "ai_processed"];
const REOPENABLE = ["reviewed", "inconclusive"];
const CLOSED = ["reviewed", "cancelled", "inconclusive"];

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>();
  const inspectionId = params?.id;
  const { token, has, user } = useAuth();
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [inspectionType, setInspectionType] = useState("routine");
  const [locationReference, setLocationReference] = useState("");
  const [inspectedAt, setInspectedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [historyKey, setHistoryKey] = useState(0);

  const canAudit = has("audit:read");
  const canManage = has("inspections:manage");
  const canSubmit = has("inspections:submit");
  const canReview = has("review:decide");

  const applyInspection = useCallback((data: InspectionDetail) => {
    setInspection(data);
    setNotes(data.notes);
    setInspectionType(data.inspection_type);
    setLocationReference(data.location_reference);
    setInspectedAt(toDatetimeLocalValue(data.inspected_at));
  }, []);

  useEffect(() => {
    if (!token || !inspectionId) {
      return;
    }
    let cancelled = false;
    apiRequest<InspectionDetail>(`/api/v1/inspections/${inspectionId}`, { token })
      .then((data) => {
        if (!cancelled) {
          applyInspection(data);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof ApiError ? caught.message : "Tidak dapat memuat inspeksi ini.",
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
  }, [applyInspection, inspectionId, reloadKey, token]);

  useEffect(() => {
    if (!token || !inspectionId || !canAudit) {
      return;
    }
    let cancelled = false;
    apiRequest<Page<AuditEvent>>(
      `/api/v1/audit-events?target_type=inspection&target_id=${inspectionId}&page_size=50`,
      { token },
    )
      .then((page) => {
        if (!cancelled) {
          setEvents(page.items);
          setAuditError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setAuditError(
            caught instanceof ApiError ? caught.message : "Tidak dapat memuat riwayat inspeksi.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canAudit, historyKey, inspectionId, reloadKey, token]);

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inspection) {
      return;
    }
    setSaving(true);
    setActionError(null);
    setConflict(false);
    try {
      const updated = await apiRequest<InspectionDetail>(
        `/api/v1/inspections/${inspection.id}`,
        {
          method: "PATCH",
          token,
          body: {
            inspection_type: inspectionType,
            location_reference: locationReference.trim(),
            notes: notes.trim(),
            inspected_at: new Date(inspectedAt).toISOString(),
            version: inspection.version,
          },
        },
      );
      applyInspection(updated);
      setEditing(false);
      setNotice("Draf tersimpan. Versi catatan telah dinaikkan.");
      setHistoryKey((value) => value + 1);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setConflict(true);
        setActionError(caught.message);
      } else {
        setActionError(caught instanceof ApiError ? caught.message : "Tidak dapat menyimpan draf.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function submitInspection() {
    if (!inspection) {
      return;
    }
    if (
      !window.confirm(
        "Kirim inspeksi ini? Setelah dikirim, perubahan dikunci dan hanya supervisor yang dapat membatalkannya.",
      )
    ) {
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const updated = await apiRequest<InspectionDetail>(
        `/api/v1/inspections/${inspection.id}/submit`,
        { method: "POST", token, body: {} },
      );
      applyInspection(updated);
      setEditing(false);
      setNotice("Inspeksi dikirim untuk ditinjau. Catatan kini hanya-baca.");
      setHistoryKey((value) => value + 1);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Tidak dapat mengirim inspeksi.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancelInspection() {
    if (!inspection) {
      return;
    }
    if (!window.confirm("Batalkan inspeksi ini? Tindakan ini dicatat pada riwayat aktivitas.")) {
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const updated = await apiRequest<InspectionDetail>(
        `/api/v1/inspections/${inspection.id}/cancel`,
        { method: "POST", token, body: {} },
      );
      applyInspection(updated);
      setEditing(false);
      setNotice("Inspeksi dibatalkan. Catatan kini hanya-baca.");
      setHistoryKey((value) => value + 1);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Tidak dapat membatalkan inspeksi.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function startReview() {
    if (!inspection) {
      return;
    }
    if (!window.confirm("Mulai meninjau inspeksi ini? Catatan berpindah ke status menunggu verifikasi.")) {
      return;
    }
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await apiRequest<InspectionDetail>(
        `/api/v1/inspections/${inspection.id}/review/start`,
        { method: "POST", token, body: {} },
      );
      applyInspection(updated);
      setNotice("Peninjauan dimulai. Catatan kini dalam status menunggu verifikasi.");
      setHistoryKey((value) => value + 1);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Tidak dapat memulai peninjauan.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function reopenInspection() {
    if (!inspection) {
      return;
    }
    if (
      !window.confirm(
        "Buka kembali inspeksi ini sebagai draf? Hasil tinjauan sebelumnya tetap tercatat pada riwayat aktivitas.",
      )
    ) {
      return;
    }
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await apiRequest<InspectionDetail>(
        `/api/v1/inspections/${inspection.id}/reopen`,
        { method: "POST", token, body: {} },
      );
      applyInspection(updated);
      setNotice("Inspeksi dibuka kembali sebagai draf untuk revisi.");
      setHistoryKey((value) => value + 1);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Tidak dapat membuka kembali inspeksi.",
      );
    } finally {
      setSaving(false);
    }
  }

  function reload() {
    setLoading(true);
    setConflict(false);
    setActionError(null);
    setNotice(null);
    setReloadKey((value) => value + 1);
  }

  const refreshCounters = useCallback(() => {
    setReloadKey((value) => value + 1);
    setHistoryKey((value) => value + 1);
  }, []);

  const handleChecklistUpdated = useCallback(
    (data: InspectionDetail) => {
      applyInspection(data);
      setNotice("Checklist tersimpan. Versi catatan dinaikkan dan perubahan diaudit.");
      setHistoryKey((value) => value + 1);
    },
    [applyInspection],
  );

  const handleReviewed = useCallback(
    (data: InspectionDetail) => {
      applyInspection(data);
      setEditing(false);
      setHistoryKey((value) => value + 1);
      setNotice(
        data.status === "reviewed"
          ? "Tinjauan tercatat. Inspeksi telah ditinjau dan hanya-baca."
          : data.status === "inconclusive"
            ? "Tinjauan tercatat tidak dapat disimpulkan. Supervisor dapat membuka kembali catatan."
            : "Tinjauan tercatat. Inspeksi dibuka kembali sebagai draf untuk revisi.",
      );
    },
    [applyInspection],
  );

  if (loading) {
    return (
      <Card className="flex items-center gap-2 p-8 text-sm text-secondary">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Memuat inspeksi…
      </Card>
    );
  }

  if (error || !inspection) {
    return (
      <div className="space-y-4">
        <Link
          href="/inspections"
          className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Kembali ke inspeksi
        </Link>
        <Card className="flex items-start gap-3 border-critical/20 bg-critical-soft p-5">
          <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink">Inspeksi tidak tersedia</p>
            <p className="mt-1 text-sm text-secondary">
              {error ?? "Inspeksi ini tidak ada atau di luar cakupan Anda."}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const editable =
    inspection.status === "draft" &&
    (inspection.inspector.id === user?.id || canManage);
  const submittable = editable && canSubmit;
  const cancellable = canManage && !CLOSED.includes(inspection.status);
  const reviewStartable =
    canReview &&
    REVIEW_STARTABLE.includes(inspection.status) &&
    inspection.inspector.id !== user?.id;
  const reopenable = canManage && REOPENABLE.includes(inspection.status);

  return (
    <div className="space-y-6">
      <Link
        href="/inspections"
        className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Kembali ke inspeksi
      </Link>

      <PageHeader
        eyebrow={`Inspeksi · ${inspection.asset.code}`}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl">{inspection.reference}</span>
            <DemoBadge reference={inspection.reference} />
            <InspectionStatusChip status={inspection.status} />
          </span>
        }
        description={`${inspection.asset.name} · ${inspection.scope.name}`}
        actions={
          <>
            {editable ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setEditing((value) => !value);
                  setActionError(null);
                  setConflict(false);
                  setNotice(null);
                }}
              >
                {editing ? (
                  <X className="size-3.5" aria-hidden="true" />
                ) : (
                  <Pencil className="size-3.5" aria-hidden="true" />
                )}
                {editing ? "Berhenti mengubah" : "Ubah draf"}
              </button>
            ) : null}
            {submittable && !editing ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={submitInspection}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                )}
                Kirim inspeksi
              </button>
            ) : null}
            {reviewStartable && !editing ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={startReview}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ClipboardCheck className="size-3.5" aria-hidden="true" />
                )}
                Mulai tinjauan
              </button>
            ) : null}
            {reopenable && !editing ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={reopenInspection}
                disabled={saving}
              >
                Buka kembali sebagai draf
              </button>
            ) : null}
            {cancellable && !editing ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={cancelInspection}
                disabled={saving}
              >
                Batalkan inspeksi
              </button>
            ) : null}
          </>
        }
      />

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm text-ink"
        >
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
          {notice}
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-critical/20 bg-critical-soft px-4 py-3"
        >
          <FileWarning className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden="true" />
          <div>
            <p className="text-sm text-ink">{actionError}</p>
            {conflict ? (
              <button type="button" className={`${secondaryButtonClass} mt-2`} onClick={reload}>
                Muat ulang versi terbaru
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title="Catatan inspeksi"
              description="Inspektur yang ditugaskan, waktu, dan cakupan."
            />
            <dl className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-secondary">Aset</dt>
                <dd className="mt-1 text-sm text-ink">
                  <Link
                    href={`/assets/${inspection.asset.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {inspection.asset.name}
                  </Link>
                  <span className="ml-2 font-mono text-[10px] text-secondary">
                    {inspection.asset.code}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Inspektur</dt>
                <dd className="mt-1 text-sm text-ink">{inspection.inspector.full_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Jenis inspeksi</dt>
                <dd className="mt-1 text-sm text-ink">
                  {INSPECTION_TYPE_LABELS[inspection.inspection_type] ??
                    inspection.inspection_type}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Referensi lokasi</dt>
                <dd className="mt-1 text-sm text-ink">
                  {inspection.location_reference || (
                    <span className="text-secondary">Tidak dicatat</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Waktu diperiksa</dt>
                <dd className="mt-1 text-sm text-ink">
                  {formatDateTime(inspection.inspected_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Cakupan organisasi</dt>
                <dd className="mt-1 text-sm text-ink">{inspection.scope.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Dibuat</dt>
                <dd className="mt-1 text-sm text-ink">{formatDateTime(inspection.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Terakhir diperbarui</dt>
                <dd className="mt-1 text-sm text-ink">{formatDateTime(inspection.updated_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Versi catatan</dt>
                <dd className="mt-1 font-mono text-sm text-ink">v{inspection.version}</dd>
              </div>
            </dl>
          </Card>

          <ChecklistPanel
            key={`${inspection.id}-${inspection.version}`}
            inspection={inspection}
            token={token}
            editable={editable}
            onUpdated={handleChecklistUpdated}
          />

          <Card>
            <CardHeader
              title="Catatan observasi"
              description={
                editing
                  ? "Penyuntingan diperiksa versinya. Penyimpanan yang bentrok mengembalikan 409 dan harus dimuat ulang."
                  : "Observasi teks bebas yang dicatat oleh inspektur yang ditugaskan."
              }
            />
            {editing ? (
              <form className="space-y-4 p-5" onSubmit={saveDraft}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="draft-type">
                      Jenis inspeksi
                    </label>
                    <select
                      id="draft-type"
                      className={`${inputClass} mt-1`}
                      value={inspectionType}
                      onChange={(event) => setInspectionType(event.target.value)}
                    >
                      {Object.entries(INSPECTION_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="draft-location-ref">
                      Referensi lokasi
                    </label>
                    <input
                      id="draft-location-ref"
                      className={`${inputClass} mt-1`}
                      value={locationReference}
                      onChange={(event) => setLocationReference(event.target.value)}
                      maxLength={200}
                      placeholder="Referensi lokal teks bebas"
                    />
                  </div>
                </div>
                <p className="text-[11px] leading-5 text-secondary">
                  Taksonomi DEMO sementara sampai KCIC menyetujui jenis inspeksi. Jangan memasukkan
                  koordinat KCIC yang belum disetujui.
                </p>
                <div>
                  <label className={labelClass} htmlFor="draft-date">
                    Waktu diperiksa
                  </label>
                  <input
                    id="draft-date"
                    type="datetime-local"
                    className={`${inputClass} mt-1`}
                    value={inspectedAt}
                    onChange={(event) => setInspectedAt(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="draft-notes">
                    Catatan
                  </label>
                  <textarea
                    id="draft-notes"
                    className={`${inputClass} mt-1 min-h-40`}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={4000}
                  />
                  <p className="mt-1 text-right font-mono text-[10px] text-secondary">
                    {notes.length} / 4000 · versi {inspection.version}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={primaryButtonClass} disabled={saving}>
                    {saving ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    Simpan draf
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => {
                      setEditing(false);
                      setNotes(inspection.notes);
                      setInspectionType(inspection.inspection_type);
                      setLocationReference(inspection.location_reference);
                      setInspectedAt(toDatetimeLocalValue(inspection.inspected_at));
                      setActionError(null);
                      setConflict(false);
                    }}
                  >
                    Batalkan perubahan
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-5">
                <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                  {inspection.notes || "Tidak ada catatan untuk inspeksi ini."}
                </p>
                {editable ? null : (
                  <p className="mt-4 rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-secondary">
                    {inspection.status === "draft"
                      ? "Hanya inspektur yang ditugaskan atau supervisor yang dapat mengubah draf ini."
                      : "Catatan ini hanya-baca setelah dikirim."}
                  </p>
                )}
              </div>
            )}
          </Card>

          <MediaPanel
            inspectionId={inspection.id}
            inspectionStatus={inspection.status}
            inspectorId={inspection.inspector.id}
            onActivity={refreshCounters}
          />

          <ReviewPanel
            inspection={inspection}
            canReview={canReview}
            onReviewed={handleReviewed}
          />

          <FindingsPanel inspection={inspection} />

          <Card>
            <CardHeader
              title="Riwayat inspeksi"
              description={
                canAudit
                  ? "Peristiwa audit yang tercatat untuk inspeksi ini (terbaru lebih dulu)."
                  : "Metadata siklus hidup. Riwayat audit lengkap memerlukan izin audit:read."
              }
            />
            {canAudit ? (
              auditError ? (
                <p className="px-5 py-6 text-sm text-critical">{auditError}</p>
              ) : events.length === 0 ? (
                <EmptyState
                  icon={<History className="size-5" aria-hidden="true" />}
                  title="Belum ada peristiwa audit"
                  description="Tidak ada peristiwa yang tercatat untuk inspeksi ini dalam cakupan Anda."
                />
              ) : (
                <ol className="divide-y divide-border">
                  {events.map((event) => (
                    <li key={event.id} className="flex flex-wrap gap-3 px-5 py-3 text-sm">
                      <Clock className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-semibold text-ink">
                          {event.action}
                        </p>
                        <p className="mt-0.5 text-xs text-secondary">
                          {formatDateTime(event.created_at)}
                          {event.actor_label ? ` · ${event.actor_label}` : ""}
                          {event.outcome !== "success" ? ` · ${event.outcome}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )
            ) : (
              <ol className="divide-y divide-border">
                <li className="px-5 py-3 text-sm">
                  <p className="text-xs text-secondary">Dibuat</p>
                  <p className="mt-0.5 text-ink">{formatDateTime(inspection.created_at)}</p>
                </li>
                <li className="px-5 py-3 text-sm">
                  <p className="text-xs text-secondary">Terakhir diperbarui</p>
                  <p className="mt-0.5 text-ink">{formatDateTime(inspection.updated_at)}</p>
                </li>
                <li className="px-5 py-3 text-sm">
                  <p className="text-xs text-secondary">Status saat ini</p>
                  <p className="mt-0.5 text-ink">
                    {INSPECTION_STATUS_LABELS[inspection.status] ?? inspection.status} · versi{" "}
                    {inspection.version}
                  </p>
                </li>
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Bukti" description="Media dan status pipeline AI demo." />
            <div className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <ImageOff className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-ink">
                    {inspection.media_count} item bukti terverifikasi
                  </p>
                  <p className="mt-1 text-xs leading-5 text-secondary">
                    Penyimpanan privat dengan verifikasi SHA-256 di sisi server. Setiap pratinjau
                    dan unduhan tercatat pada riwayat aktivitas.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-ink">
                    {inspection.pending_detections} pekerjaan AI tertunda
                  </p>
                  <p className="mt-1 text-xs leading-5 text-secondary">
                    Heuristik kualitas gambar DEMO yang diberi label jelas menguji antrean. Ini
                    bukan deteksi kerusakan dan tidak mengklaim akurasi apa pun.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Langkah berikutnya" description="Posisi alur kerja catatan ini." />
            <div className="space-y-3 p-5 text-xs leading-5 text-secondary">
              {inspection.status === "draft" ? (
                <p>
                  <span className="font-semibold text-ink">Draf.</span> Lengkapi catatan, lampirkan
                  bukti, lalu kirim untuk mengunci catatan dan meneruskannya ke peninjauan manusia.
                </p>
              ) : null}
              {inspection.status === "submitted" ? (
                <p>
                  <span className="font-semibold text-ink">Dikirim.</span> Catatan dikunci dari
                  perubahan teks dan menunggu keputusan peninjauan manusia. Peninjau berwenang
                  memulai tinjauan, lalu menerimanya sebagai telah ditinjau, mengembalikannya untuk
                  perbaikan, atau mencatatnya tidak dapat disimpulkan; supervisor dapat
                  membatalkannya.
                </p>
              ) : null}
              {inspection.status === "ai_processing" ? (
                <p>
                  <span className="font-semibold text-ink">Pemrosesan AI.</span> Pekerjaan AI demo
                  diantrekan terhadap bukti. Pekerjaan ini hanya menguji pipeline dan tidak
                  mengklaim deteksi kerusakan.
                </p>
              ) : null}
              {inspection.status === "ai_processed" ? (
                <p>
                  <span className="font-semibold text-ink">AI selesai memproses.</span> Pekerjaan
                  demo selesai dengan keluaran bersifat saran. Peninjau manusia harus memutuskan
                  catatan ini.
                </p>
              ) : null}
              {inspection.status === "ai_failed" ? (
                <p>
                  <span className="font-semibold text-ink">Pemrosesan AI gagal.</span> Pekerjaan
                  demo tidak selesai. Supervisor dapat membuka kembali atau membatalkan catatan;
                  bukti dapat dicoba ulang.
                </p>
              ) : null}
              {inspection.status === "under_review" ? (
                <p>
                  <span className="font-semibold text-ink">Menunggu verifikasi.</span> Peninjau
                  telah memulai tinjauan dan mencatat keputusan beserta catatannya.
                </p>
              ) : null}
              {inspection.status === "reviewed" ? (
                <p>
                  <span className="font-semibold text-ink">Telah ditinjau.</span> Peninjau
                  menerima catatan. Catatan ditutup dan hanya-baca. Peninjau kini dapat mencatat
                  temuan dan supervisor dapat menugaskan perintah kerja tindakan perbaikan.
                </p>
              ) : null}
              {inspection.status === "inconclusive" ? (
                <p>
                  <span className="font-semibold text-ink">Tidak dapat disimpulkan.</span> Peninjau
                  tidak dapat memverifikasi catatan. Supervisor dapat membukanya kembali sebagai
                  draf untuk revisi.
                </p>
              ) : null}
              {inspection.status === "cancelled" ? (
                <p>
                  <span className="font-semibold text-ink">Dibatalkan.</span> Catatan ini ditutup
                  dan hanya-baca.
                </p>
              ) : null}
              <p className="rounded-lg border border-warning/20 bg-warning-soft px-3 py-2 text-[11px] text-ink">
                Inspeksi ini adalah dokumentasi, bukan izin keselamatan. Tidak ada vonis otomatis
                aman atau tidak aman.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
