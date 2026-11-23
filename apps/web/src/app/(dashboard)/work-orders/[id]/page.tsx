"use client";

import {
  ArrowLeft,
  CheckCircle2,
  FileWarning,
  Loader2,
  Pencil,
  Play,
  ShieldX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import {
  SyntheticBadge,
  FindingPriorityChip,
  WorkOrderStatusChip,
} from "@/components/records";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { apiRequest, ApiError, type Assignee, type WorkOrder } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime, WORK_ORDER_STATUS_LABELS } from "@/lib/domain";

const ACTIVE_STATUSES = ["open", "in_progress"];
const NOTES_REQUIRED = ["complete", "verify", "cancel"];

const ACTION_LABELS: Record<string, string> = {
  start: "Mulai perintah kerja",
  complete: "Laporkan penyelesaian",
  verify: "Verifikasi penyelesaian",
  cancel: "Batalkan perintah kerja",
};

export default function WorkOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const workOrderId = params?.id;
  const { token, user, has } = useAuth();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const canWrite = has("work_orders:write");
  const canVerify = has("work_orders:verify");
  const isAssignee = workOrder?.assignee.id === user?.id;
  const canAct = Boolean(isAssignee || canWrite);

  useEffect(() => {
    if (!token || !workOrderId) {
      return;
    }
    let cancelled = false;
    apiRequest<WorkOrder>(`/api/v1/work-orders/${workOrderId}`, { token })
      .then((data) => {
        if (!cancelled) {
          setWorkOrder(data);
          setTitle(data.title);
          setInstructions(data.instructions);
          setAssigneeId(data.assignee.id);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof ApiError ? caught.message : "Tidak dapat memuat perintah kerja ini.",
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
  }, [reloadKey, token, workOrderId]);

  useEffect(() => {
    if (!token || !canWrite) {
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
  }, [canWrite, token]);

  async function runAction(action: "start" | "complete" | "verify" | "cancel") {
    if (!workOrder) {
      return;
    }
    if (NOTES_REQUIRED.includes(action) && notes.trim().length < 5) {
      setActionError("Masukkan catatan minimal 5 karakter untuk tindakan ini.");
      return;
    }
    if (!window.confirm(`${ACTION_LABELS[action]}? Tindakan ini dicatat pada riwayat aktivitas.`)) {
      return;
    }
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await apiRequest<WorkOrder>(
        `/api/v1/work-orders/${workOrder.id}/${action}`,
        {
          method: "POST",
          token,
          body: NOTES_REQUIRED.includes(action) ? { notes: notes.trim() } : {},
        },
      );
      setWorkOrder(updated);
      setTitle(updated.title);
      setInstructions(updated.instructions);
      setAssigneeId(updated.assignee.id);
      setNotes("");
      setNotice(`${ACTION_LABELS[action]} tercatat.`);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Tidak dapat mencatat tindakan.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveWorkOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workOrder) {
      return;
    }
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await apiRequest<WorkOrder>(`/api/v1/work-orders/${workOrder.id}`, {
        method: "PATCH",
        token,
        body: {
          title: title.trim(),
          instructions: instructions.trim(),
          assignee_id: assigneeId,
          version: workOrder.version,
        },
      });
      setEditing(false);
      setNotice("Perintah kerja diperbarui. Penerima tugas diberi notifikasi bila berubah.");
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Tidak dapat memperbarui perintah kerja.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center gap-2 p-8 text-sm text-secondary">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Memuat perintah kerja…
      </Card>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="space-y-4">
        <Link
          href="/work-orders"
          className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Kembali ke perintah kerja
        </Link>
        <Card className="flex items-start gap-3 border-critical/20 bg-critical-soft p-5">
          <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink">Perintah kerja tidak tersedia</p>
            <p className="mt-1 text-sm text-secondary">
              {error ?? "Perintah kerja ini tidak ada atau di luar cakupan Anda."}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const startable = workOrder.status === "open" && canAct;
  const completable = ACTIVE_STATUSES.includes(workOrder.status) && canAct;
  const verifiable = workOrder.status === "awaiting_verification" && canVerify;
  const cancellable = ACTIVE_STATUSES.includes(workOrder.status) && canWrite;
  const editable = ACTIVE_STATUSES.includes(workOrder.status) && canWrite;
  const hasActions = startable || completable || verifiable || cancellable;

  return (
    <div className="space-y-6">
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Kembali ke perintah kerja
      </Link>

      <PageHeader
        eyebrow={`Perintah kerja · ${workOrder.asset.code}`}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl">{workOrder.reference}</span>
            <SyntheticBadge reference={workOrder.reference} />
            <WorkOrderStatusChip status={workOrder.status} />
          </span>
        }
        description={`${workOrder.title} · temuan ${workOrder.finding.reference}`}
        actions={
          editable ? (
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                setEditing((value) => !value);
                setActionError(null);
                setNotice(null);
              }}
            >
              {editing ? (
                <X className="size-3.5" aria-hidden="true" />
              ) : (
                <Pencil className="size-3.5" aria-hidden="true" />
              )}
              {editing ? "Berhenti mengubah" : "Ubah perintah kerja"}
            </button>
          ) : null
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
              title="Catatan perintah kerja"
              description="Pelacakan tindakan perbaikan. Bukan instruksi pengaturan perjalanan atau keselamatan."
            />
            <dl className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-secondary">Temuan</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <Link
                    href={`/findings/${workOrder.finding.id}`}
                    className="font-mono text-xs font-semibold text-primary hover:underline"
                  >
                    {workOrder.finding.reference}
                  </Link>
                  <FindingPriorityChip priority={workOrder.finding.priority} />
                </dd>
                <p className="mt-1 text-xs text-secondary">{workOrder.finding.title}</p>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Aset</dt>
                <dd className="mt-1 text-sm">
                  <Link
                    href={`/assets/${workOrder.asset.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {workOrder.asset.name}
                  </Link>
                  <span className="ml-2 font-mono text-[10px] text-secondary">
                    {workOrder.asset.code}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Penerima tugas</dt>
                <dd className="mt-1 text-sm text-ink">{workOrder.assignee.full_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Dibuat oleh</dt>
                <dd className="mt-1 text-sm text-ink">
                  {workOrder.created_by.full_name} · {formatDateTime(workOrder.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Selesai</dt>
                <dd className="mt-1 text-sm text-ink">{formatDateTime(workOrder.completed_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Diverifikasi</dt>
                <dd className="mt-1 text-sm text-ink">{formatDateTime(workOrder.verified_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary">Versi catatan</dt>
                <dd className="mt-1 font-mono text-sm text-ink">v{workOrder.version}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Instruksi"
              description={
                editing
                  ? "Penyuntingan diperiksa versinya. Penerima tugas diberi notifikasi bila penugasan berubah."
                  : "Instruksi yang dicatat pengelola perintah kerja."
              }
            />
            {editing ? (
              <form className="space-y-4 p-5" onSubmit={saveWorkOrder}>
                <div>
                  <label className={labelClass} htmlFor="work-order-edit-title">
                    Judul
                  </label>
                  <input
                    id="work-order-edit-title"
                    className={`${inputClass} mt-1`}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    minLength={3}
                    maxLength={200}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="work-order-edit-instructions">
                    Instruksi
                  </label>
                  <textarea
                    id="work-order-edit-instructions"
                    className={`${inputClass} mt-1 min-h-36`}
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    maxLength={4000}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="work-order-edit-assignee">
                    Penerima tugas
                  </label>
                  <select
                    id="work-order-edit-assignee"
                    className={`${inputClass} mt-1`}
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value)}
                    required
                  >
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.full_name} · {assignee.scope.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={primaryButtonClass} disabled={saving}>
                    {saving ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    Simpan perintah kerja
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => {
                      setEditing(false);
                      setTitle(workOrder.title);
                      setInstructions(workOrder.instructions);
                      setAssigneeId(workOrder.assignee.id);
                      setActionError(null);
                    }}
                  >
                    Batalkan perubahan
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 p-5">
                <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                  {workOrder.instructions || "Tidak ada instruksi tambahan yang dicatat."}
                </p>
                {workOrder.completion_notes ? (
                  <div className="rounded-lg border border-border bg-canvas px-3 py-2">
                    <p className="text-xs font-medium text-secondary">Catatan penyelesaian</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">
                      {workOrder.completion_notes}
                    </p>
                  </div>
                ) : null}
                {workOrder.verification_notes ? (
                  <div className="rounded-lg border border-success/20 bg-success-soft px-3 py-2">
                    <p className="text-xs font-medium text-secondary">Catatan verifikasi</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">
                      {workOrder.verification_notes}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Tindakan"
              description="Setiap transisi divalidasi API dan diaudit."
            />
            {hasActions ? (
              <div className="space-y-4 p-5">
                <div>
                  <label className={labelClass} htmlFor="work-order-notes">
                    Catatan (wajib untuk penyelesaian, verifikasi, dan pembatalan)
                  </label>
                  <textarea
                    id="work-order-notes"
                    className={`${inputClass} mt-1 min-h-24`}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    minLength={5}
                    maxLength={2000}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {startable ? (
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => void runAction("start")}
                      disabled={saving}
                    >
                      <Play className="size-3.5" aria-hidden="true" />
                      Mulai
                    </button>
                  ) : null}
                  {completable ? (
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => void runAction("complete")}
                      disabled={saving}
                    >
                      Laporkan penyelesaian
                    </button>
                  ) : null}
                  {verifiable ? (
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => void runAction("verify")}
                      disabled={saving}
                    >
                      Verifikasi penyelesaian
                    </button>
                  ) : null}
                  {cancellable ? (
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => void runAction("cancel")}
                      disabled={saving}
                    >
                      Batalkan perintah kerja
                    </button>
                  ) : null}
                </div>
                <p className="text-[11px] leading-5 text-secondary">
                  Verifikasi harus independen: pengguna dengan izin work_orders:write tidak dapat
                  memverifikasi penyelesaiannya sendiri.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-5 text-xs leading-5 text-secondary">
                <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>
                  Tidak ada tindakan yang tersedia untuk izin Anda pada status ini. Penerima tugas
                  dapat memulai dan melaporkan penyelesaian; pengelola perintah kerja dapat
                  membatalkan; verifikator mengonfirmasi penyelesaian.
                </p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Makna status" description="Posisi alur kerja saat ini." />
            <div className="space-y-3 p-5 text-xs leading-5 text-secondary">
              <p>
                <span className="font-semibold text-ink">
                  {WORK_ORDER_STATUS_LABELS[workOrder.status] ?? workOrder.status}
                </span>{" "}
                —{" "}
                {workOrder.status === "open"
                  ? "ditugaskan dan menunggu penerima tugas memulai."
                  : workOrder.status === "in_progress"
                    ? "penerima tugas sedang mengerjakan tindakan."
                    : workOrder.status === "awaiting_verification"
                      ? "penerima tugas melaporkan penyelesaian; verifikator independen harus mengonfirmasinya."
                      : workOrder.status === "completed"
                        ? "penyelesaian telah diverifikasi. Bila tidak ada perintah kerja lain yang aktif, temuan ditutup."
                        : "perintah kerja dibatalkan dan dipertahankan untuk riwayat aktivitas."}
              </p>
              <p className="rounded-lg border border-warning/20 bg-warning-soft px-3 py-2 text-[11px] text-ink">
                Perintah kerja melacak tindak lanjut internal. Tidak menyatakan kondisi jalur aman
                atau tidak aman.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
