"use client";

import {
  BadgeCheck,
  Database,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  ShieldX,
  Undo2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  dangerButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  subtleButtonClass,
} from "@/components/admin/form-styles";
import { Card, CardHeader, Chip, EmptyState, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type AIModelCreatePayload,
  type AIModelHistoryEvent,
  type AIModelRegistryEntry,
  type DatasetCreatePayload,
  type DatasetInfo,
  type Page,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Tone } from "@/lib/status";
import { formatDateTime, formatNumber } from "@/lib/domain";

type Tab = "models" | "datasets";

const TABS: { id: Tab; label: string }[] = [
  { id: "models", label: "Model" },
  { id: "datasets", label: "Dataset" },
];

const MODEL_STATUS_LABELS: Record<string, string> = {
  candidate: "Kandidat",
  active: "Aktif",
  retired: "Dipensiunkan",
};

const APPROVAL_LABELS: Record<string, string> = {
  draft: "Draf",
  pending_approval: "Menunggu persetujuan",
  approved: "Disetujui",
  rejected: "Ditolak",
  synthetic_only: "Sintetis saja",
};

const DATASET_STATUS_LABELS: Record<string, string> = {
  draft: "Draf",
  pending_approval: "Menunggu persetujuan",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const MODEL_EVENT_LABELS: Record<string, string> = {
  "model.registered": "Model didaftarkan",
  "model.submitted": "Diajukan untuk persetujuan",
  "model.approved": "Disetujui",
  "model.rejected": "Ditolak",
  "model.deployed": "Diterapkan sebagai model aktif",
  "model.retired": "Dipensiunkan",
};

const METRIC_LABELS: Record<string, string> = {
  precision: "Precision",
  recall: "Recall",
  f1: "F1",
  f1_score: "F1",
  map: "mAP",
  map50: "mAP@50",
  map_50_95: "mAP@50-95",
  iou: "IoU",
  accuracy: "Akurasi",
  false_positive_rate: "Laju FP",
  false_negative_rate: "Laju FN",
  inference_ms: "Latensi (ms)",
  throughput_fps: "Throughput (fps)",
};

function modelStatusTone(status: string): Tone {
  if (status === "active") {
    return "success";
  }
  if (status === "retired") {
    return "neutral";
  }
  return "ai";
}

function approvalTone(status: string): Tone {
  if (status === "approved") {
    return "success";
  }
  if (status === "pending_approval") {
    return "warning";
  }
  if (status === "rejected") {
    return "critical";
  }
  return "neutral";
}

function datasetStatusTone(status: string): Tone {
  if (status === "approved") {
    return "success";
  }
  if (status === "pending_approval") {
    return "warning";
  }
  if (status === "rejected") {
    return "critical";
  }
  return "neutral";
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatMetric(value: unknown): string {
  if (typeof value === "number") {
    return value.toLocaleString("id-ID", { maximumFractionDigits: 4 });
  }
  return String(value);
}

function metricPairs(metrics: Record<string, unknown> | null): [string, string][] {
  if (!metrics) {
    return [];
  }
  return Object.entries(metrics)
    .filter(([, value]) => typeof value === "number" || typeof value === "string")
    .slice(0, 8)
    .map(([key, value]) => [METRIC_LABELS[key] ?? key, formatMetric(value)]);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-1.5">
      <dt className="shrink-0 text-secondary">{label}:</dt>
      <dd className="truncate text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}

interface Decision {
  kind: "model" | "dataset";
  action: "approve" | "reject";
  id: string;
  name: string;
}

export default function ModelsPage() {
  const { token, has } = useAuth();
  const canManage = has("models:manage");
  const canRead = canManage || has("audit:read");

  const [tab, setTab] = useState<Tab>("models");
  const [models, setModels] = useState<AIModelRegistryEntry[] | null>(null);
  const [datasets, setDatasets] = useState<DatasetInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, AIModelHistoryEvent[]>>({});

  const [decision, setDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !canRead) {
      return;
    }
    setLoading(true);
    try {
      const [modelPage, datasetList] = await Promise.all([
        apiRequest<Page<AIModelRegistryEntry>>("/api/v1/models", { token }),
        apiRequest<DatasetInfo[]>("/api/v1/datasets", { token }),
      ]);
      setModels(modelPage.items);
      setDatasets(datasetList);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Tidak dapat memuat registri model AI.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, canRead]);

  useEffect(() => {
    // Fetch-on-mount: state updates occur only after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function run(
    key: string,
    successMessage: string,
    path: string,
    body?: unknown,
  ): Promise<boolean> {
    if (!token) {
      return false;
    }
    setBusy(key);
    setActionError(null);
    setNotice(null);
    try {
      await apiRequest(path, { method: "POST", token, body: body ?? {} });
      setNotice(successMessage);
      await load();
      return true;
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Tindakan tidak dapat diselesaikan.",
      );
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function toggleHistory(modelId: string) {
    if (historyOpen === modelId) {
      setHistoryOpen(null);
      return;
    }
    setHistoryOpen(modelId);
    if (history[modelId] || !token) {
      return;
    }
    setHistoryLoading(modelId);
    try {
      const events = await apiRequest<AIModelHistoryEvent[]>(
        `/api/v1/models/${modelId}/history`,
        { token },
      );
      setHistory((current) => ({ ...current, [modelId]: events }));
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Riwayat model tidak dapat dimuat.",
      );
    } finally {
      setHistoryLoading(null);
    }
  }

  async function confirmDecision() {
    if (!decision) {
      return;
    }
    const trimmed = notes.trim();
    if (trimmed.length < 5) {
      setDecisionError("Catatan keputusan minimal 5 karakter.");
      return;
    }
    const base =
      decision.kind === "model"
        ? `/api/v1/models/${decision.id}`
        : `/api/v1/datasets/${decision.id}`;
    const ok = await run(
      `${decision.action}:${decision.id}`,
      decision.action === "approve"
        ? "Keputusan persetujuan tersimpan di audit trail."
        : "Penolakan tersimpan di audit trail.",
      `${base}/${decision.action}`,
      { notes: trimmed },
    );
    if (ok) {
      setDecision(null);
      setNotes("");
      setDecisionError(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kecerdasan buatan · Fase 5"
        title="Registri model & dataset"
        description="Tata kelola siklus hidup model AI dan dataset. Model hanya dapat dipakai oleh pipeline setelah melalui pengajuan, persetujuan, dan penerapan oleh Engineer AI/ML. Tidak ada angka evaluasi yang diisi otomatis; metrik hanya ditampilkan bila tim AI mencatat hasil pengukuran nyata."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || !canRead}
            className={secondaryButtonClass}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Muat ulang
          </button>
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bagian registri">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={
              tab === item.id
                ? "rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white"
                : "rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-success/20 bg-success-soft px-3 py-2 text-xs text-ink"
        >
          {notice}
        </p>
      ) : null}
      {actionError ? (
        <p
          role="alert"
          className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
        >
          {actionError}
        </p>
      ) : null}

      {!canRead ? (
        <Card>
          <EmptyState
            icon={<ShieldX className="size-5" aria-hidden="true" />}
            title="Akses terbatas"
            description="Registri model hanya dapat dilihat oleh Engineer AI/ML, Auditor, dan Administrator."
          />
        </Card>
      ) : loading && !models ? (
        <Card>
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Memuat registri…
          </div>
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            icon={<ShieldX className="size-5" aria-hidden="true" />}
            title="Registri tidak dapat dimuat"
            description={error}
          />
        </Card>
      ) : tab === "models" ? (
        <ModelsTab
          models={models ?? []}
          canManage={canManage}
          busy={busy}
          history={history}
          historyOpen={historyOpen}
          historyLoading={historyLoading}
          onToggleHistory={(id) => void toggleHistory(id)}
          onAction={(key, message, path, body) => void run(key, message, path, body)}
          onDecision={setDecision}
          onRefresh={load}
          token={token}
        />
      ) : (
        <DatasetsTab
          datasets={datasets ?? []}
          canManage={canManage}
          busy={busy}
          onAction={(key, message, path, body) => void run(key, message, path, body)}
          onDecision={setDecision}
          onRefresh={load}
          token={token}
        />
      )}

      {decision ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-title"
            className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
          >
            <h2 id="decision-title" className="text-sm font-semibold text-ink">
              {decision.action === "approve" ? "Setujui" : "Tolak"}{" "}
              {decision.kind === "model" ? "model" : "dataset"}: {decision.name}
            </h2>
            <p className="mt-1 text-xs leading-5 text-secondary">
              Keputusan tercatat permanen pada audit trail. Catatan minimal 5 karakter dan
              akan terlihat pada riwayat.
            </p>
            <label htmlFor="decision-notes" className={`${labelClass} mt-4 block`}>
              Catatan keputusan
            </label>
            <textarea
              id="decision-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className={`${inputClass} mt-1.5`}
              placeholder="Alasan keputusan, dasar evaluasi, atau syarat perbaikan."
            />
            {decisionError ? (
              <p role="alert" className="mt-2 text-xs text-critical">
                {decisionError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setDecision(null);
                  setNotes("");
                  setDecisionError(null);
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                disabled={busy !== null}
                onClick={() => void confirmDecision()}
              >
                Simpan keputusan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface TabActionProps {
  busy: string | null;
  onAction: (
    key: string,
    message: string,
    path: string,
    body?: unknown,
  ) => void;
  onDecision: (decision: Decision) => void;
  onRefresh: () => Promise<void>;
  token: string | null;
}

function ModelsTab({
  models,
  canManage,
  busy,
  history,
  historyOpen,
  historyLoading,
  onToggleHistory,
  onAction,
  onDecision,
  onRefresh,
  token,
}: TabActionProps & {
  models: AIModelRegistryEntry[];
  canManage: boolean;
  history: Record<string, AIModelHistoryEvent[]>;
  historyOpen: string | null;
  historyLoading: string | null;
  onToggleHistory: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      {canManage ? (
        <RegisterModelForm token={token} onRegistered={onRefresh} />
      ) : (
        <p className="rounded-lg border border-border bg-canvas/60 px-3 py-2 text-xs text-secondary">
          Anda memiliki akses baca. Pendaftaran dan keputusan siklus hidup model dilakukan
          oleh Engineer AI/ML atau Administrator.
        </p>
      )}

      <Card>
        <CardHeader
          title="Model terdaftar"
          description={`${models.length} entri. Model sintetis ditandai label SINTETIS dan tidak mengikuti alur persetujuan operasional.`}
        />
        {models.length === 0 ? (
          <EmptyState
            icon={<BadgeCheck className="size-5" aria-hidden="true" />}
            title="Belum ada model terdaftar"
            description="Daftarkan artefak model beserta versi dataset, checksum, pemetaan kelas, dan metrik evaluasi nyata."
          />
        ) : (
          <ul className="divide-y divide-border">
            {models.map((model) => {
              const metrics = metricPairs(model.evaluation_metrics);
              const events = history[model.id];
              const submitKey = `submit:${model.id}`;
              const deployKey = `deploy:${model.id}`;
              const retireKey = `retire:${model.id}`;
              return (
                <li key={model.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{model.name}</p>
                        {model.is_demo ? <Chip tone="neutral">SINTETIS</Chip> : null}
                        <Chip tone={modelStatusTone(model.status)}>
                          {MODEL_STATUS_LABELS[model.status] ?? model.status}
                        </Chip>
                        <Chip tone={approvalTone(model.approval_status)}>
                          {APPROVAL_LABELS[model.approval_status] ?? model.approval_status}
                        </Chip>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-secondary">
                        {model.code}:{model.version} · keluarga {model.family} ·{" "}
                        {model.modality}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canManage && !model.is_demo ? (
                        <>
                          {model.approval_status === "draft" ||
                          model.approval_status === "rejected" ? (
                            <button
                              type="button"
                              className={subtleButtonClass}
                              disabled={busy !== null}
                              onClick={() =>
                                onAction(
                                  submitKey,
                                  "Model diajukan untuk persetujuan.",
                                  `/api/v1/models/${model.id}/submit`,
                                )
                              }
                            >
                              <ShieldCheck className="size-3.5" aria-hidden="true" />
                              Ajukan persetujuan
                            </button>
                          ) : null}
                          {model.approval_status === "pending_approval" ? (
                            <>
                              <button
                                type="button"
                                className={subtleButtonClass}
                                disabled={busy !== null}
                                onClick={() =>
                                  onDecision({
                                    kind: "model",
                                    action: "approve",
                                    id: model.id,
                                    name: `${model.name} ${model.version}`,
                                  })
                                }
                              >
                                <BadgeCheck className="size-3.5" aria-hidden="true" />
                                Setujui
                              </button>
                              <button
                                type="button"
                                className={dangerButtonClass}
                                disabled={busy !== null}
                                onClick={() =>
                                  onDecision({
                                    kind: "model",
                                    action: "reject",
                                    id: model.id,
                                    name: `${model.name} ${model.version}`,
                                  })
                                }
                              >
                                <XCircle className="size-3.5" aria-hidden="true" />
                                Tolak
                              </button>
                            </>
                          ) : null}
                          {model.approval_status === "approved" &&
                          model.status !== "active" ? (
                            <button
                              type="button"
                              className={subtleButtonClass}
                              disabled={busy !== null}
                              onClick={() =>
                                onAction(
                                  deployKey,
                                  "Model diterapkan; versi aktif lain pada keluarga yang sama dipensiunkan.",
                                  `/api/v1/models/${model.id}/deploy`,
                                )
                              }
                            >
                              <Rocket className="size-3.5" aria-hidden="true" />
                              Terapkan
                            </button>
                          ) : null}
                          {model.status === "active" ? (
                            <button
                              type="button"
                              className={dangerButtonClass}
                              disabled={busy !== null}
                              onClick={() =>
                                onAction(
                                  retireKey,
                                  "Model aktif dipensiunkan.",
                                  `/api/v1/models/${model.id}/retire`,
                                )
                              }
                            >
                              <Undo2 className="size-3.5" aria-hidden="true" />
                              Pensiunkan
                            </button>
                          ) : null}
                        </>
                      ) : null}
                      <button
                        type="button"
                        className={subtleButtonClass}
                        disabled={busy !== null}
                        onClick={() => onToggleHistory(model.id)}
                        aria-expanded={historyOpen === model.id}
                      >
                        <History className="size-3.5" aria-hidden="true" />
                        Riwayat
                      </button>
                    </div>
                  </div>

                  <dl className="grid gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Versi dataset" value={model.dataset_version ?? "—"} />
                    <Detail
                      label="Checksum artefak"
                      value={
                        model.checksum_sha256
                          ? `${model.checksum_sha256.slice(0, 12)}…`
                          : "—"
                      }
                    />
                    <Detail
                      label="Kelas"
                      value={
                        model.class_names.length ? model.class_names.join(", ") : "—"
                      }
                    />
                    <Detail
                      label="Dipakai pada job AI"
                      value={`${formatNumber(model.usage_count)} pekerjaan`}
                    />
                    <Detail
                      label="Terakhir dipakai"
                      value={formatDateTime(model.last_used_at)}
                    />
                    <Detail
                      label="Diterapkan"
                      value={formatDateTime(model.deployed_at)}
                    />
                    <Detail label="Disetujui" value={formatDateTime(model.approved_at)} />
                    <Detail
                      label="Dipensiunkan"
                      value={model.retired_at ? formatDateTime(model.retired_at) : "—"}
                    />
                    <Detail label="Didaftarkan" value={formatDateTime(model.created_at)} />
                  </dl>

                  {metrics.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {metrics.map(([label, value]) => (
                        <span
                          key={label}
                          className="rounded-md border border-border bg-canvas/60 px-2 py-1 font-mono text-[11px] text-ink"
                        >
                          {label}: {value}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-secondary">
                      Belum ada metrik evaluasi terekam. Model tanpa metrik tidak dapat
                      disetujui.
                    </p>
                  )}

                  {model.evaluation_notes ? (
                    <p className="text-[11px] leading-5 text-secondary">
                      <span className="font-semibold text-ink">Catatan evaluasi:</span>{" "}
                      {model.evaluation_notes}
                    </p>
                  ) : null}
                  {model.known_limitations ? (
                    <p className="text-[11px] leading-5 text-secondary">
                      <span className="font-semibold text-ink">Batasan diketahui:</span>{" "}
                      {model.known_limitations}
                    </p>
                  ) : null}
                  {model.approval_notes ? (
                    <p className="text-[11px] leading-5 text-secondary">
                      <span className="font-semibold text-ink">Catatan keputusan:</span>{" "}
                      {model.approval_notes}
                    </p>
                  ) : null}

                  {historyOpen === model.id ? (
                    <div className="rounded-lg border border-border bg-canvas/60 px-3 py-2">
                      {historyLoading === model.id ? (
                        <p className="flex items-center gap-2 text-[11px] text-secondary">
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          Memuat riwayat…
                        </p>
                      ) : !events || events.length === 0 ? (
                        <p className="text-[11px] text-secondary">
                          Belum ada peristiwa siklus hidup tercatat.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {events.map((event) => (
                            <li
                              key={event.id}
                              className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
                            >
                              <span className="text-ink">
                                {MODEL_EVENT_LABELS[event.action] ?? event.action}
                                {event.actor_label ? (
                                  <span className="text-secondary"> · {event.actor_label}</span>
                                ) : null}
                              </span>
                              <span className="text-secondary">
                                {formatDateTime(event.created_at)} WIB
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function RegisterModelForm({
  token,
  onRegistered,
}: {
  token: string | null;
  onRegistered: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    version: "",
    family: "",
    datasetVersion: "",
    checksum: "",
    classNames: "",
    description: "",
    limitations: "",
    metrics: "",
    isSynthetic: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    setFormError(null);
    setSuccess(null);

    const checksum = form.checksum.trim().toLowerCase();
    if (checksum && !/^[a-f0-9]{64}$/.test(checksum)) {
      setFormError("Checksum SHA-256 harus 64 karakter heksadesimal.");
      return;
    }

    let metrics: Record<string, unknown> | null = null;
    if (form.metrics.trim()) {
      try {
        const parsed: unknown = JSON.parse(form.metrics);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("not an object");
        }
        metrics = parsed as Record<string, unknown>;
      } catch {
        setFormError("Metrik evaluasi harus berupa objek JSON, misalnya {\"precision\": 0.0}.");
        return;
      }
    }

    const payload: AIModelCreatePayload = {
      code: form.code.trim(),
      name: form.name.trim(),
      version: form.version.trim(),
      family: form.family.trim(),
      description: form.description.trim(),
      is_demo: form.isSynthetic,
      dataset_version: form.datasetVersion.trim() || null,
      checksum_sha256: checksum || null,
      class_names: splitCsv(form.classNames),
      evaluation_metrics: metrics,
      known_limitations: form.limitations.trim(),
    };

    setSubmitting(true);
    try {
      await apiRequest<AIModelRegistryEntry>("/api/v1/models", {
        method: "POST",
        token,
        body: payload,
      });
      setSuccess(
        form.isSynthetic
          ? "Model sintetis terdaftar."
          : "Model terdaftar sebagai kandidat. Ajukan persetujuan setelah kelengkapan terpenuhi.",
      );
      setForm({
        code: "",
        name: "",
        version: "",
        family: "",
        datasetVersion: "",
        checksum: "",
        classNames: "",
        description: "",
        limitations: "",
        metrics: "",
        isSynthetic: false,
      });
      await onRegistered();
    } catch (caught) {
      setFormError(
        caught instanceof ApiError ? caught.message : "Model tidak dapat didaftarkan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Daftarkan model"
        description="Isi hanya data artefak dan hasil pengukuran yang benar-benar tersedia. Metrik tidak boleh diisi angka perkiraan."
      />
      <form className="space-y-4 p-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="model-code" className={labelClass}>
              Kode model
            </label>
            <input
              id="model-code"
              required
              minLength={3}
              maxLength={64}
              pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
              value={form.code}
              onChange={(event) => update("code", event.target.value)}
              className={inputClass}
              placeholder="cth. track-defect-yolo"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="model-name" className={labelClass}>
              Nama model
            </label>
            <input
              id="model-name"
              required
              minLength={3}
              maxLength={160}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="model-version" className={labelClass}>
              Versi
            </label>
            <input
              id="model-version"
              required
              maxLength={32}
              value={form.version}
              onChange={(event) => update("version", event.target.value)}
              className={inputClass}
              placeholder="cth. 0.1.0"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="model-family" className={labelClass}>
              Keluarga model
            </label>
            <input
              id="model-family"
              maxLength={64}
              value={form.family}
              onChange={(event) => update("family", event.target.value)}
              className={inputClass}
              placeholder="Kosongkan untuk memakai kode model"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="model-dataset" className={labelClass}>
              Versi dataset
            </label>
            <input
              id="model-dataset"
              maxLength={64}
              value={form.datasetVersion}
              onChange={(event) => update("datasetVersion", event.target.value)}
              className={inputClass}
              placeholder="cth. ds-v1.0.0"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="model-checksum" className={labelClass}>
              Checksum artefak (SHA-256)
            </label>
            <input
              id="model-checksum"
              maxLength={64}
              value={form.checksum}
              onChange={(event) => update("checksum", event.target.value)}
              className={`${inputClass} font-mono`}
              placeholder="64 karakter heksadesimal"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="model-classes" className={labelClass}>
              Pemetaan kelas
            </label>
            <input
              id="model-classes"
              value={form.classNames}
              onChange={(event) => update("classNames", event.target.value)}
              className={inputClass}
              placeholder="Pisahkan dengan koma"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="model-limitations" className={labelClass}>
              Batasan diketahui
            </label>
            <input
              id="model-limitations"
              maxLength={4000}
              value={form.limitations}
              onChange={(event) => update("limitations", event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <label htmlFor="model-description" className={labelClass}>
              Deskripsi
            </label>
            <textarea
              id="model-description"
              rows={2}
              maxLength={2000}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <label htmlFor="model-metrics" className={labelClass}>
              Metrik evaluasi (JSON, opsional)
            </label>
            <textarea
              id="model-metrics"
              rows={3}
              value={form.metrics}
              onChange={(event) => update("metrics", event.target.value)}
              className={`${inputClass} font-mono text-xs`}
              placeholder={'{"precision": 0.0, "recall": 0.0, "f1": 0.0}'}
            />
            <p className="text-[11px] text-secondary">
              Kosongkan bila evaluasi belum dilakukan. Persetujuan ditolak selama metrik
              belum terekam.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={form.isSynthetic}
            onChange={(event) => update("isSynthetic", event.target.checked)}
            className="size-3.5 accent-primary"
          />
          Tandai sebagai model sintetis (tidak untuk keputusan keselamatan)
        </label>

        {formError ? (
          <p
            role="alert"
            className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
          >
            {formError}
          </p>
        ) : null}
        {success ? (
          <p
            role="status"
            className="rounded-lg border border-success/20 bg-success-soft px-3 py-2 text-xs text-ink"
          >
            {success}
          </p>
        ) : null}

        <button type="submit" className={primaryButtonClass} disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-3.5" aria-hidden="true" />
          )}
          Daftarkan model
        </button>
      </form>
    </Card>
  );
}

function DatasetsTab({
  datasets,
  canManage,
  busy,
  onAction,
  onDecision,
  onRefresh,
  token,
}: TabActionProps & { datasets: DatasetInfo[]; canManage: boolean }) {
  return (
    <div className="space-y-5">
      {canManage ? (
        <RegisterDatasetForm token={token} onRegistered={onRefresh} />
      ) : (
        <p className="rounded-lg border border-border bg-canvas/60 px-3 py-2 text-xs text-secondary">
          Anda memiliki akses baca. Pendaftaran dan keputusan dataset dilakukan oleh
          Engineer AI/ML atau Administrator.
        </p>
      )}

      <Card>
        <CardHeader
          title="Dataset terdaftar"
          description={`${datasets.length} entri. Dataset wajib mencantumkan sumber dan izin penggunaan sebelum diajukan; dataset KCIC tidak boleh didaftarkan tanpa persetujuan pemilik data.`}
        />
        {datasets.length === 0 ? (
          <EmptyState
            icon={<Database className="size-5" aria-hidden="true" />}
            title="Belum ada dataset terdaftar"
            description="Daftarkan dataset beserta sumber, izin penggunaan, versi, dan pembagian train/validasi/uji."
          />
        ) : (
          <ul className="divide-y divide-border">
            {datasets.map((dataset) => {
              const submitKey = `submit:${dataset.id}`;
              return (
                <li key={dataset.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{dataset.name}</p>
                        <Chip tone={datasetStatusTone(dataset.status)}>
                          {DATASET_STATUS_LABELS[dataset.status] ?? dataset.status}
                        </Chip>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-secondary">
                        {dataset.code}:{dataset.version}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canManage &&
                      (dataset.status === "draft" || dataset.status === "rejected") ? (
                        <button
                          type="button"
                          className={subtleButtonClass}
                          disabled={busy !== null}
                          onClick={() =>
                            onAction(
                              submitKey,
                              "Dataset diajukan untuk persetujuan.",
                              `/api/v1/datasets/${dataset.id}/submit`,
                            )
                          }
                        >
                          <ShieldCheck className="size-3.5" aria-hidden="true" />
                          Ajukan persetujuan
                        </button>
                      ) : null}
                      {canManage && dataset.status === "pending_approval" ? (
                        <>
                          <button
                            type="button"
                            className={subtleButtonClass}
                            disabled={busy !== null}
                            onClick={() =>
                              onDecision({
                                kind: "dataset",
                                action: "approve",
                                id: dataset.id,
                                name: `${dataset.name} ${dataset.version}`,
                              })
                            }
                          >
                            <BadgeCheck className="size-3.5" aria-hidden="true" />
                            Setujui
                          </button>
                          <button
                            type="button"
                            className={dangerButtonClass}
                            disabled={busy !== null}
                            onClick={() =>
                              onDecision({
                                kind: "dataset",
                                action: "reject",
                                id: dataset.id,
                                name: `${dataset.name} ${dataset.version}`,
                              })
                            }
                          >
                            <XCircle className="size-3.5" aria-hidden="true" />
                            Tolak
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <dl className="grid gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Sumber" value={dataset.source} />
                    <Detail label="Izin penggunaan" value={dataset.license_note} />
                    <Detail
                      label="Kelas"
                      value={
                        dataset.class_names.length ? dataset.class_names.join(", ") : "—"
                      }
                    />
                    <Detail
                      label="Jumlah gambar"
                      value={formatNumber(dataset.image_count)}
                    />
                    <Detail
                      label="Pembagian"
                      value={`train ${formatNumber(dataset.split_train)} · validasi ${formatNumber(
                        dataset.split_validation,
                      )} · uji ${formatNumber(dataset.split_test)}`}
                    />
                    <Detail
                      label="Disetujui"
                      value={
                        dataset.approved_at
                          ? `${formatDateTime(dataset.approved_at)}${
                              dataset.approved_by
                                ? ` · ${dataset.approved_by.full_name}`
                                : ""
                            }`
                          : "—"
                      }
                    />
                  </dl>

                  {dataset.description ? (
                    <p className="text-[11px] leading-5 text-secondary">
                      {dataset.description}
                    </p>
                  ) : null}
                  {dataset.approval_notes ? (
                    <p className="text-[11px] leading-5 text-secondary">
                      <span className="font-semibold text-ink">Catatan keputusan:</span>{" "}
                      {dataset.approval_notes}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function RegisterDatasetForm({
  token,
  onRegistered,
}: {
  token: string | null;
  onRegistered: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    version: "",
    source: "",
    licenseNote: "",
    classNames: "",
    imageCount: "0",
    splitTrain: "0",
    splitValidation: "0",
    splitTest: "0",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toCount(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    setFormError(null);
    setSuccess(null);
    const payload: DatasetCreatePayload = {
      code: form.code.trim(),
      name: form.name.trim(),
      version: form.version.trim(),
      source: form.source.trim(),
      license_note: form.licenseNote.trim(),
      description: form.description.trim(),
      class_names: splitCsv(form.classNames),
      image_count: toCount(form.imageCount),
      split_train: toCount(form.splitTrain),
      split_validation: toCount(form.splitValidation),
      split_test: toCount(form.splitTest),
    };
    setSubmitting(true);
    try {
      await apiRequest<DatasetInfo>("/api/v1/datasets", {
        method: "POST",
        token,
        body: payload,
      });
      setSuccess("Dataset terdaftar sebagai draf. Ajukan persetujuan setelah kelengkapan terpenuhi.");
      setForm({
        code: "",
        name: "",
        version: "",
        source: "",
        licenseNote: "",
        classNames: "",
        imageCount: "0",
        splitTrain: "0",
        splitValidation: "0",
        splitTest: "0",
        description: "",
      });
      await onRegistered();
    } catch (caught) {
      setFormError(
        caught instanceof ApiError ? caught.message : "Dataset tidak dapat didaftarkan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Daftarkan dataset"
        description="Pendaftaran tidak mengunggah gambar. Catat sumber, izin penggunaan, dan versi secara jujur; data tanpa izin tidak boleh digunakan."
      />
      <form className="space-y-4 p-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="dataset-code" className={labelClass}>
              Kode dataset
            </label>
            <input
              id="dataset-code"
              required
              minLength={3}
              maxLength={64}
              pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
              value={form.code}
              onChange={(event) => update("code", event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dataset-name" className={labelClass}>
              Nama dataset
            </label>
            <input
              id="dataset-name"
              required
              minLength={3}
              maxLength={160}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dataset-version" className={labelClass}>
              Versi
            </label>
            <input
              id="dataset-version"
              required
              maxLength={32}
              value={form.version}
              onChange={(event) => update("version", event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dataset-source" className={labelClass}>
              Sumber data
            </label>
            <input
              id="dataset-source"
              required
              minLength={3}
              maxLength={240}
              value={form.source}
              onChange={(event) => update("source", event.target.value)}
              className={inputClass}
              placeholder="cth. koleksi lapangan dengan izin tertulis"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dataset-license" className={labelClass}>
              Izin penggunaan
            </label>
            <input
              id="dataset-license"
              required
              minLength={3}
              maxLength={240}
              value={form.licenseNote}
              onChange={(event) => update("licenseNote", event.target.value)}
              className={inputClass}
              placeholder="Rujukan izin dari pemilik data"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dataset-classes" className={labelClass}>
              Kelas
            </label>
            <input
              id="dataset-classes"
              value={form.classNames}
              onChange={(event) => update("classNames", event.target.value)}
              className={inputClass}
              placeholder="Pisahkan dengan koma"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dataset-images" className={labelClass}>
              Jumlah gambar
            </label>
            <input
              id="dataset-images"
              inputMode="numeric"
              value={form.imageCount}
              onChange={(event) => update("imageCount", event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dataset-train" className={labelClass}>
              Train
            </label>
            <input
              id="dataset-train"
              inputMode="numeric"
              value={form.splitTrain}
              onChange={(event) => update("splitTrain", event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dataset-validation" className={labelClass}>
              Validasi
            </label>
            <input
              id="dataset-validation"
              inputMode="numeric"
              value={form.splitValidation}
              onChange={(event) => update("splitValidation", event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dataset-test" className={labelClass}>
              Uji
            </label>
            <input
              id="dataset-test"
              inputMode="numeric"
              value={form.splitTest}
              onChange={(event) => update("splitTest", event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="dataset-description" className={labelClass}>
              Deskripsi
            </label>
            <input
              id="dataset-description"
              maxLength={4000}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {formError ? (
          <p
            role="alert"
            className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
          >
            {formError}
          </p>
        ) : null}
        {success ? (
          <p
            role="status"
            className="rounded-lg border border-success/20 bg-success-soft px-3 py-2 text-xs text-ink"
          >
            {success}
          </p>
        ) : null}

        <button type="submit" className={primaryButtonClass} disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-3.5" aria-hidden="true" />
          )}
          Daftarkan dataset
        </button>
      </form>
    </Card>
  );
}
