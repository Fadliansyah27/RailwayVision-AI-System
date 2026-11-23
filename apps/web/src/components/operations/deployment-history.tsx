"use client";

import { Loader2, Rocket } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import { formatTimestamp } from "@/components/operations/format";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type DeploymentPayload,
  type DeploymentRecord,
  type MetaResponse,
} from "@/lib/api";

const ENVIRONMENTS: DeploymentPayload["environment"][] = [
  "local",
  "test",
  "staging",
  "production",
];

function isEnvironment(value: string): value is DeploymentPayload["environment"] {
  return (ENVIRONMENTS as string[]).includes(value);
}

export function DeploymentHistory({
  token,
  canRecord,
}: {
  token: string;
  canRecord: boolean;
}) {
  const [records, setRecords] = useState<DeploymentRecord[]>([]);
  const [environment, setEnvironment] = useState<DeploymentPayload["environment"]>("local");
  const [version, setVersion] = useState("");
  const [commitSha, setCommitSha] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<DeploymentRecord[]>("/api/v1/ops/deployments", { token });
      setRecords(data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat memuat riwayat deployment.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Fetch-on-mount: state updates occur only after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    apiRequest<MetaResponse>("/api/v1/meta")
      .then((meta) => {
        if (!cancelled && isEnvironment(meta.environment)) {
          setEnvironment(meta.environment);
        }
      })
      .catch(() => {
        // The form defaults to local; the server still validates APP_ENV on submit.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest<DeploymentRecord>("/api/v1/ops/deployments", {
        method: "POST",
        token,
        body: {
          version: version.trim(),
          environment,
          commit_sha: commitSha.trim() || null,
          notes: notes.trim(),
        },
      });
      setVersion("");
      setCommitSha("");
      setNotes("");
      setNotice("Deployment tercatat pada riwayat aktivitas audit.");
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat mencatat deployment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {canRecord ? (
        <Card>
          <CardHeader
            title="Catat deployment"
            description="Catatan manual untuk jejak audit. Konsol tidak membaca pipeline CI dan tidak menyimpulkan keberhasilan deployment."
          />
          <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="space-y-1">
              <span className={labelClass}>Versi</span>
              <input
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                required
                maxLength={40}
                placeholder="mis. 0.9.0"
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Lingkungan</span>
              <select
                value={environment}
                onChange={(event) => {
                  if (isEnvironment(event.target.value)) {
                    setEnvironment(event.target.value);
                  }
                }}
                className={inputClass}
              >
                {ENVIRONMENTS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <span className="block text-[11px] text-secondary">
                Harus sama dengan APP_ENV layanan API; server menolak ketidaksesuaian.
              </span>
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Commit SHA (opsional)</span>
              <input
                value={commitSha}
                onChange={(event) => setCommitSha(event.target.value)}
                maxLength={40}
                placeholder="7–40 karakter heksadesimal"
                className={`${inputClass} font-mono`}
              />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Catatan (opsional)</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={1000}
                placeholder="Ringkasan perubahan yang diterapkan"
                className={inputClass}
              />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={saving} className={primaryButtonClass}>
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Rocket className="size-3.5" aria-hidden="true" />
                )}
                Catat deployment
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Riwayat deployment"
          description="Entri berasal dari catatan audit deployment.recorded; tidak ada status kesehatan yang disimpulkan."
          actions={
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className={secondaryButtonClass}
            >
              Muat ulang
            </button>
          }
        />
        <div className="space-y-4 p-5">
          {notice ? (
            <p className="rounded-lg border border-success/20 bg-success-soft px-3 py-2 text-xs text-ink">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
            >
              {error}
            </p>
          ) : null}
          {loading && records.length === 0 ? (
            <div className="flex items-center gap-2 py-10 text-sm text-secondary">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Memuat riwayat deployment…
            </div>
          ) : null}
          {!loading && records.length === 0 ? (
            <EmptyState
              icon={<Rocket className="size-5" aria-hidden="true" />}
              title="Belum ada deployment tercatat"
              description="Administrator dapat mencatat versi yang diterapkan beserta commit SHA agar jejak audit lengkap."
            />
          ) : null}
          {records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="rv-table min-w-[720px]">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                    <th className="py-2 pr-3 font-semibold">Waktu</th>
                    <th className="py-2 pr-3 font-semibold">Versi</th>
                    <th className="py-2 pr-3 font-semibold">Lingkungan</th>
                    <th className="py-2 pr-3 font-semibold">Commit</th>
                    <th className="py-2 pr-3 font-semibold">Catatan</th>
                    <th className="py-2 font-semibold">Dicatat oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((record) => (
                    <tr key={record.id} className="align-top">
                      <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-secondary">
                        {formatTimestamp(record.recorded_at)}
                      </td>
                      <td className="py-2.5 pr-3 text-xs font-semibold text-ink">{record.version}</td>
                      <td className="py-2.5 pr-3 text-xs text-secondary">{record.environment}</td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-secondary">
                        {record.commit_sha ? record.commit_sha.slice(0, 12) : "—"}
                      </td>
                      <td className="max-w-sm py-2.5 pr-3 text-xs leading-5 text-secondary">
                        {record.notes || "—"}
                      </td>
                      <td className="py-2.5 text-xs text-secondary">{record.recorded_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
