"use client";

import { AlertTriangle, CheckCircle2, FileWarning, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import { DemoBadge, FindingPriorityChip, FindingStatusChip } from "@/components/records";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { apiRequest, ApiError, type Finding, type InspectionDetail, type Page } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FINDING_PRIORITY_LABELS, formatDateTime } from "@/lib/domain";

const FINDABLE_STATUSES = ["reviewed", "inconclusive"];

export function FindingsPanel({ inspection }: { inspection: InspectionDetail }) {
  const { token, has } = useAuth();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canRead = has("findings:read");
  const canWrite = has("findings:write");
  const findable = canWrite && FINDABLE_STATUSES.includes(inspection.status);

  const load = useCallback(async () => {
    if (!token || !canRead) {
      return;
    }
    setLoading(true);
    try {
      const page = await apiRequest<Page<Finding>>(
        `/api/v1/findings?inspection_id=${inspection.id}&page_size=50`,
        { token },
      );
      setFindings(page.items);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat memuat temuan.");
    } finally {
      setLoading(false);
    }
  }, [canRead, inspection.id, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load findings for this inspection
    void load();
  }, [load, reloadKey]);

  if (!canRead) {
    return null;
  }

  async function createFinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await apiRequest<Finding>("/api/v1/findings", {
        method: "POST",
        token,
        body: {
          inspection_id: inspection.id,
          title: title.trim(),
          description: description.trim(),
          priority,
        },
      });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCreating(false);
      setNotice("Temuan dicatat. Temuan kini dapat ditindaklanjuti dengan perintah kerja.");
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : "Tidak dapat mencatat temuan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Temuan"
        description="Observasi tindak lanjut yang dicatat manusia dan terhubung ke inspeksi ini. Bukan vonis keselamatan."
        actions={
          findable && !creating ? (
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                setCreating(true);
                setActionError(null);
                setNotice(null);
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Catat temuan
            </button>
          ) : null
        }
      />

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm text-ink"
        >
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
          {notice}
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-border px-5 py-3 text-sm text-ink"
        >
          <FileWarning className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden="true" />
          {actionError}
        </div>
      ) : null}

      {creating ? (
        <form className="space-y-4 border-b border-border p-5" onSubmit={createFinding}>
          <div>
            <label className={labelClass} htmlFor="finding-create-title">
              Judul
            </label>
            <input
              id="finding-create-title"
              className={`${inputClass} mt-1`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={3}
              maxLength={200}
              required
              placeholder="Ringkasan observasi singkat"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="finding-create-description">
              Deskripsi
            </label>
            <textarea
              id="finding-create-description"
              className={`${inputClass} mt-1 min-h-32`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={10}
              maxLength={4000}
              required
              placeholder="Apa yang diamati, di mana, dan dalam kondisi apa. Jangan memasukkan kode atau koordinat KCIC yang belum disetujui."
            />
            <p className="mt-1 text-right font-mono text-[10px] text-secondary">
              {description.length} / 4000
            </p>
          </div>
          <div>
            <label className={labelClass} htmlFor="finding-create-priority">
              Prioritas (nilai DEMO sementara)
            </label>
            <select
              id="finding-create-priority"
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
              Catat temuan
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                setCreating(false);
                setTitle("");
                setDescription("");
                setPriority("medium");
                setActionError(null);
              }}
            >
              Batal
            </button>
          </div>
        </form>
      ) : null}

      {canWrite && !findable ? (
        <p className="border-b border-border px-5 py-3 text-xs leading-5 text-secondary">
          Temuan dapat dicatat setelah peninjau menerima inspeksi atau menandainya tidak dapat
          disimpulkan.
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-secondary">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Memuat temuan…
        </div>
      ) : error ? (
        <p className="px-5 py-6 text-sm text-critical">{error}</p>
      ) : findings.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          title="Belum ada temuan tercatat"
          description="Belum ada temuan tindak lanjut yang dicatat dari inspeksi ini."
        />
      ) : (
        <ul className="divide-y divide-border">
          {findings.map((finding) => (
            <li key={finding.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/findings/${finding.id}`}
                    className="font-mono text-xs font-semibold text-primary hover:underline"
                  >
                    {finding.reference}
                  </Link>
                  <DemoBadge reference={finding.reference} />
                  <FindingStatusChip status={finding.status} />
                  <FindingPriorityChip priority={finding.priority} />
                </div>
                <p className="mt-1 text-sm text-ink">{finding.title}</p>
                <p className="mt-0.5 text-xs text-secondary">
                  {finding.created_by.full_name} · {formatDateTime(finding.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
