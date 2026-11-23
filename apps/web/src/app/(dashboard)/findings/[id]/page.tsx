"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileWarning,
  Loader2,
  Pencil,
  ShieldX,
  Wrench,
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
import {
  SyntheticBadge,
  FindingPriorityChip,
  FindingStatusChip,
  WorkOrderStatusChip,
} from "@/components/records";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type Assignee,
  type FindingDetail,
  type WorkOrder,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  FINDING_PRIORITY_LABELS,
  FINDING_STATUS_LABELS,
  formatDateTime,
} from "@/lib/domain";

type DecisionMode = "reject" | "reopen" | null;

export default function FindingDetailPage() {
  const params = useParams<{ id: string }>();
  const findingId = params?.id;
  const { token, has } = useAuth();
  const [finding, setFinding] = useState<FindingDetail | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const [decisionMode, setDecisionMode] = useState<DecisionMode>(null);
  const [decisionNotes, setDecisionNotes] = useState("");

  const [workOrderTitle, setWorkOrderTitle] = useState("");
  const [workOrderInstructions, setWorkOrderInstructions] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const canWrite = has("findings:write");
  const canManageWorkOrders = has("work_orders:write");

  const applyFinding = useCallback((data: FindingDetail) => {
    setFinding(data);
    setTitle(data.title);
    setDescription(data.description);
    setPriority(data.priority);
  }, []);

  useEffect(() => {
    if (!token || !findingId) {
      return;
    }
    let cancelled = false;
    apiRequest<FindingDetail>(`/api/v1/findings/${findingId}`, { token })
      .then((data) => {
        if (!cancelled) {
          applyFinding(data);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : "Tidak dapat memuat temuan ini.");
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
  }, [applyFinding, findingId, reloadKey, token]);

  useEffect(() => {
    if (!token || !canManageWorkOrders) {
      return;
    }
    let cancelled = false;
    apiRequest<Assignee[]>("/api/v1/work-orders/assignees", { token })
      .then((items) => {
        if (!cancelled) {
          setAssignees(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssignees([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canManageWorkOrders, token]);

  async function saveFinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!finding) {
      return;
    }
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await apiRequest<FindingDetail>(`/api/v1/findings/${finding.id}`, {
        method: "PATCH",
        token,
        body: {
          title: title.trim(),
          description: description.trim(),
          priority,
          version: finding.version,
        },
      });
      setEditing(false);
      setNotice("Temuan diperbarui. Versi catatan telah dinaikkan.");
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Tidak dapat memperbarui temuan.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!finding || !decisionMode) {
      return;
    }
    const prompt =
      decisionMode === "reject"
        ? "Tolak temuan ini? Keputusan beserta alasannya akan dicatat."
        : "Buka kembali temuan ini sebagai terkonfirmasi? Keputusan beserta alasannya akan dicatat.";
    if (!window.confirm(prompt)) {
      return;
    }
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await apiRequest<FindingDetail>(
        `/api/v1/findings/${finding.id}/${decisionMode}`,
        { method: "POST", token, body: { notes: decisionNotes.trim() } },
      );
      setDecisionMode(null);
      setDecisionNotes("");
      setNotice(
        decisionMode === "reject"
          ? "Temuan ditolak. Alasan keputusan dicatat."
          : "Temuan dibuka kembali sebagai terkonfirmasi.",
      );
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Tidak dapat mencatat keputusan.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createWorkOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!finding) {
      return;
    }
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await apiRequest<WorkOrder>("/api/v1/work-orders", {
        method: "POST",
        token,
        body: {
          finding_id: finding.id,
          title: workOrderTitle.trim(),
          instructions: workOrderInstructions.trim(),
          assignee_id: assigneeId,
        },
      });
      setWorkOrderTitle("");
      setWorkOrderInstructions("");
      setNotice("Perintah kerja dibuat dan penerima tugas telah diberi notifikasi.");
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Tidak dapat membuat perintah kerja.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center gap-2 p-8 text-sm text-secondary">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Memuat temuan…
      </Card>
    );
  }

  if (error || !finding) {
    return (
      <div className="space-y-4">
        <Link
          href="/findings"
          className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Kembali ke temuan
        </Link>
        <Card className="flex items-start gap-3 border-critical/20 bg-critical-soft p-5">
          <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink">Temuan tidak tersedia</p>
            <p className="mt-1 text-sm text-secondary">
              {error ?? "Temuan ini tidak ada atau di luar cakupan Anda."}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const editable = canWrite && finding.status === "confirmed";
  const rejectable = canWrite && finding.status === "confirmed";
  const reopenable = canWrite && (finding.status === "closed" || finding.status === "rejected");
  const workOrderCreatable =
    canManageWorkOrders &&
    finding.status !== "closed" &&
    finding.status !== "rejected" &&
    assignees.length > 0;

  return (
    <div className="space-y-6">
      <Link
        href="/findings"
        className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Kembali ke temuan
      </Link>

      <PageHeader
        eyebrow={`Temuan · ${finding.asset.code}`}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl">{finding.reference}</span>
            <SyntheticBadge reference={finding.reference} />
            <FindingStatusChip status={finding.status} />
            <FindingPriorityChip priority={finding.priority} />
          </span>
        }
        description={`${finding.asset.name} · dari inspeksi ${finding.inspection.reference}`}
        actions={
          <>
            {editable ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setEditing((value) => !value);
                  setDecisionMode(null);
                  setActionError(null);
                  setNotice(null);
                }}
              >
                {editing ? (
                  <X className="size-3.5" aria-hidden="true" />
                ) : (
                  <Pencil className="size-3.5" aria-hidden="true" />
                )}
                {editing ? "Berhenti mengubah" : "Ubah temuan"}
              </button>
            ) : null}
            {rejectable && !editing ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setDecisionMode((mode) => (mode === "reject" ? null : "reject"));
                  setDecisionNotes("");
                  setActionError(null);
                  setNotice(null);
                }}
              >
                Tolak temuan
              </button>
            ) : null}
            {reopenable && !editing ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setDecisionMode((mode) => (mode === "reopen" ? null : "reopen"));
                  setDecisionNotes("");
                  setActionError(null);
                  setNotice(null);
                }}
              >
                Buka kembali temuan
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
          <p className="text-sm text-ink">{actionError}</p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title="Catatan temuan"
              description="Observasi pemeliharaan yang dicatat manusia. Bukan vonis keselamatan."
            />
            <dl className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-secondary">Aset</dt>
                <dd className="mt-1 text-sm text-ink">
                  <Link
                    href={`/assets/${finding.asset.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {finding.asset.name}
                  </Link>
                  <span className="ml-2 font-mono text-[10px] text-secondary">
                    {finding.asset.code}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Inspeksi</dt>
                <dd className="mt-1 text-sm text-ink">
                  <Link
                    href={`/inspections/${finding.inspection.id}`}
                    className="font-mono text-xs font-semibold text-primary hover:underline"
                  >
                    {finding.inspection.reference}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Dicatat oleh</dt>
                <dd className="mt-1 text-sm text-ink">{finding.created_by.full_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Waktu dicatat</dt>
                <dd className="mt-1 text-sm text-ink">{formatDateTime(finding.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Cakupan organisasi</dt>
                <dd className="mt-1 text-sm text-ink">{finding.scope.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Versi catatan</dt>
                <dd className="mt-1 font-mono text-sm text-ink">v{finding.version}</dd>
              </div>
              {finding.closed_at ? (
                <div>
                  <dt className="text-xs font-medium text-secondary">Ditutup pada</dt>
                  <dd className="mt-1 text-sm text-ink">{formatDateTime(finding.closed_at)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Observasi"
              description={
                editing
                  ? "Penyuntingan diperiksa versinya. Penyimpanan yang bentrok mengembalikan 409."
                  : "Detail temuan teks bebas yang dicatat peninjau."
              }
            />
            {editing ? (
              <form className="space-y-4 p-5" onSubmit={saveFinding}>
                <div>
                  <label className={labelClass} htmlFor="finding-title">
                    Judul
                  </label>
                  <input
                    id="finding-title"
                    className={`${inputClass} mt-1`}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    minLength={3}
                    maxLength={200}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="finding-description">
                    Deskripsi
                  </label>
                  <textarea
                    id="finding-description"
                    className={`${inputClass} mt-1 min-h-36`}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    minLength={10}
                    maxLength={4000}
                    required
                  />
                  <p className="mt-1 text-right font-mono text-[10px] text-secondary">
                    {description.length} / 4000 · versi {finding.version}
                  </p>
                </div>
                <div>
                  <label className={labelClass} htmlFor="finding-priority">
                    Prioritas (nilai sintetis sementara)
                  </label>
                  <select
                    id="finding-priority"
                    className={`${inputClass} mt-1`}
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                  >
                    {Object.entries(FINDING_PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={primaryButtonClass} disabled={saving}>
                    {saving ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    Simpan temuan
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => {
                      setEditing(false);
                      setTitle(finding.title);
                      setDescription(finding.description);
                      setPriority(finding.priority);
                      setActionError(null);
                    }}
                  >
                    Batalkan perubahan
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 p-5">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{finding.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
                    {finding.description}
                  </p>
                </div>
                {finding.resolution_notes ? (
                  <div className="rounded-lg border border-border bg-canvas px-3 py-2">
                    <p className="text-xs font-medium text-secondary">Alasan keputusan</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">
                      {finding.resolution_notes}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          {decisionMode ? (
            <Card>
              <CardHeader
                title={decisionMode === "reject" ? "Tolak temuan" : "Buka kembali temuan"}
                description="Alasan wajib diisi dan dicatat bersama keputusan."
              />
              <form className="space-y-4 p-5" onSubmit={submitDecision}>
                <div>
                  <label className={labelClass} htmlFor="decision-notes">
                    Alasan
                  </label>
                  <textarea
                    id="decision-notes"
                    className={`${inputClass} mt-1 min-h-28`}
                    value={decisionNotes}
                    onChange={(event) => setDecisionNotes(event.target.value)}
                    minLength={5}
                    maxLength={2000}
                    required
                  />
                  <p className="mt-1 text-right font-mono text-[10px] text-secondary">
                    {decisionNotes.length} / 2000
                  </p>
                </div>
                <button type="submit" className={primaryButtonClass} disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : null}
                  {decisionMode === "reject" ? "Catat penolakan" : "Catat pembukaan kembali"}
                </button>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Perintah kerja"
              description="Pelacakan tindakan perbaikan yang terhubung ke temuan ini."
            />
            {finding.work_orders.length === 0 ? (
              <EmptyState
                icon={<Wrench className="size-5" aria-hidden="true" />}
                title="Belum ada perintah kerja"
                description={
                  canManageWorkOrders
                    ? "Buat perintah kerja dan tugaskan kepada inspektur atau teknisi dalam cakupan."
                    : "Supervisor menugaskan perintah kerja tindakan perbaikan bila diperlukan."
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {finding.work_orders.map((workOrder) => (
                  <li key={workOrder.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/work-orders/${workOrder.id}`}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          {workOrder.reference}
                        </Link>
                        <WorkOrderStatusChip status={workOrder.status} />
                      </div>
                      <p className="mt-1 text-sm text-ink">{workOrder.title}</p>
                      <p className="mt-0.5 text-xs text-secondary">
                        {workOrder.assignee.full_name} · dibuat{" "}
                        {formatDateTime(workOrder.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Tugaskan perintah kerja"
              description="Tersedia selama temuan terkonfirmasi atau dalam tindakan perbaikan."
            />
            {workOrderCreatable ? (
              <form className="space-y-4 p-5" onSubmit={createWorkOrder}>
                <div>
                  <label className={labelClass} htmlFor="work-order-title">
                    Judul
                  </label>
                  <input
                    id="work-order-title"
                    className={`${inputClass} mt-1`}
                    value={workOrderTitle}
                    onChange={(event) => setWorkOrderTitle(event.target.value)}
                    minLength={3}
                    maxLength={200}
                    required
                    placeholder="Tindakan perbaikan singkat"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="work-order-instructions">
                    Instruksi
                  </label>
                  <textarea
                    id="work-order-instructions"
                    className={`${inputClass} mt-1 min-h-28`}
                    value={workOrderInstructions}
                    onChange={(event) => setWorkOrderInstructions(event.target.value)}
                    maxLength={4000}
                    placeholder="Apa yang harus diperiksa atau dilakukan penerima tugas. Bukan prosedur KCIC."
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="work-order-assignee">
                    Penerima tugas
                  </label>
                  <select
                    id="work-order-assignee"
                    className={`${inputClass} mt-1`}
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value)}
                    required
                  >
                    <option value="">Pilih orang dalam cakupan</option>
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.full_name} · {assignee.scope.code}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className={primaryButtonClass}
                  disabled={saving || !assigneeId}
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Wrench className="size-3.5" aria-hidden="true" />
                  )}
                  Buat perintah kerja
                </button>
              </form>
            ) : (
              <div className="flex items-start gap-3 p-5 text-xs leading-5 text-secondary">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>
                  {canManageWorkOrders
                    ? "Tidak ada penerima tugas yang memenuhi syarat dalam cakupan, atau temuan sudah selesai/ditolak."
                    : "Perintah kerja ditugaskan oleh pengguna dengan izin work_orders:write. Anda tetap dapat memantau perkembangannya di sini."}
                </p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Makna alur kerja" description="Posisi catatan ini." />
            <div className="space-y-3 p-5 text-xs leading-5 text-secondary">
              <p>
                <span className="font-semibold text-ink">
                  {FINDING_STATUS_LABELS[finding.status] ?? finding.status}.
                </span>{" "}
                {finding.status === "confirmed"
                  ? "Temuan tercatat dan menunggu penugasan perintah kerja atau keputusan penolakan."
                  : finding.status === "rejected"
                    ? "Peninjau menolak temuan. Alasan keputusan tersimpan dalam catatan."
                    : finding.status === "closed"
                      ? "Semua perintah kerja terkait telah diverifikasi. Temuan ditutup."
                      : "Setidaknya satu perintah kerja aktif; status temuan mengikuti siklus hidup perintah kerja."}
              </p>
              <p className="rounded-lg border border-warning/20 bg-warning-soft px-3 py-2 text-[11px] text-ink">
                Hanya pelacakan pemeliharaan. Tidak ada penetapan otomatis aman/tidak aman.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
