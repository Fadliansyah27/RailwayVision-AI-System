"use client";

import {
  CheckCircle2,
  Cpu,
  Database,
  Loader2,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Card, CardHeader, Chip } from "@/components/ui";
import {
  API_BASE_URL,
  fetchMeta,
  fetchReadiness,
  type MetaResponse,
  type ReadinessResponse,
} from "@/lib/api";
import {
  componentLabel,
  formatCheckedAt,
  summarizeReadiness,
  type Tone,
} from "@/lib/status";

const FALLBACK_DISCLAIMER =
  "Saran yang dihasilkan AI bersifat awal dan wajib diverifikasi pemeriksa yang berwenang. Sistem ini tidak menyatakan infrastruktur aman atau tidak aman.";

interface Snapshot {
  readiness: ReadinessResponse;
  meta: MetaResponse | null;
  checkedAt: Date;
}

function StateIcon({ tone, className }: { tone: Tone; className?: string }) {
  if (tone === "success") {
    return <CheckCircle2 className={className} aria-hidden="true" />;
  }
  if (tone === "critical") {
    return <XCircle className={className} aria-hidden="true" />;
  }
  return <Radio className={className} aria-hidden="true" />;
}

function ServiceTile({
  icon,
  name,
  description,
  state,
  tone,
  label,
}: {
  icon: ReactNode;
  name: string;
  description: string;
  state?: "ok" | "error";
  tone: Tone;
  label: string;
}) {
  const showIcon = state !== undefined;
  return (
    <div className="rounded-xl border border-border/70 bg-canvas/50 p-4 transition-colors hover:border-border hover:bg-canvas/80">
      <div className="flex items-center justify-between gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-surface text-secondary ring-1 ring-border/70">
          {icon}
        </div>
        <Chip tone={tone}>
          {showIcon ? <StateIcon tone={tone} className="size-3.5" /> : null}
          {label}
        </Chip>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{name}</p>
      <p className="mt-1 text-xs leading-5 text-secondary">{description}</p>
    </div>
  );
}

export function SystemStatusPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      try {
        const [readinessResult, metaResult] = await Promise.allSettled([
          fetchReadiness(controller.signal),
          fetchMeta(controller.signal),
        ]);
        if (cancelled) {
          return;
        }
        if (readinessResult.status === "rejected") {
          setError(
            `Tidak dapat menjangkau API RailwayVision di ${API_BASE_URL}. Pastikan container API berjalan dan CORS mengizinkan origin ini.`,
          );
          return;
        }
        setSnapshot({
          readiness: readinessResult.value,
          meta: metaResult.status === "fulfilled" ? metaResult.value : null,
          checkedAt: new Date(),
        });
        setError(null);
      } catch {
        if (!cancelled) {
          setError(
            `Tidak dapat menjangkau API RailwayVision di ${API_BASE_URL}. Pastikan container API berjalan.`,
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [tick]);

  const summary = snapshot ? summarizeReadiness(snapshot.readiness) : null;
  const databaseState = componentLabel(snapshot?.readiness.components.database);
  const redisState = componentLabel(snapshot?.readiness.components.redis);
  const workerState = componentLabel(snapshot?.readiness.components.worker);

  return (
    <Card>
      <CardHeader
        title="Status platform langsung"
        description="Dikutip langsung dari API RailwayVision. Diperbarui otomatis setiap 30 detik."
        actions={
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rv-btn-subtle"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            )}
            {loading ? "Memuat ulang" : "Muat ulang"}
          </button>
        }
      />

      <div className="space-y-4 p-5" aria-live="polite">
        {error && !snapshot ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-critical/20 bg-critical-soft p-4 sm:flex-row sm:items-start"
          >
            <WifiOff className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">API tidak terjangkau</p>
              <p className="mt-1 text-sm leading-6 text-secondary">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="rv-btn-primary mt-3"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Coba sambung ulang
              </button>
            </div>
          </div>
        ) : null}

        {!snapshot && loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-[118px] animate-pulse rounded-xl border border-border bg-canvas"
              >
                <span className="sr-only">Memeriksa layanan…</span>
              </div>
            ))}
          </div>
        ) : null}

        {snapshot && summary ? (
          <>
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
                summary.tone === "success"
                  ? "border-success/20 bg-success-soft"
                  : summary.tone === "warning"
                    ? "border-warning/20 bg-warning-soft"
                    : "border-critical/20 bg-critical-soft"
              }`}
            >
              <div className="flex items-center gap-3">
                <StateIcon tone={summary.tone} className="size-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-ink">{summary.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-secondary">{summary.detail}</p>
                </div>
              </div>
              <p className="text-[11px] text-secondary">
                Terakhir diperiksa {formatCheckedAt(snapshot.checkedAt)}
              </p>
            </div>

            {error ? (
              <p
                role="status"
                className="rounded-xl border border-warning/20 bg-warning-soft px-3 py-2 text-xs leading-5 text-ink"
              >
                Menampilkan status terakhir yang diketahui. Pembaruan terbaru gagal; coba lagi saat
                API dapat dijangkau.
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ServiceTile
                icon={<Server className="size-4" aria-hidden="true" />}
                name="API"
                description="Layanan FastAPI merespons pemeriksaan kesiapan."
                state="ok"
                tone="success"
                label="Terjangkau"
              />
              <ServiceTile
                icon={<Database className="size-4" aria-hidden="true" />}
                name="PostgreSQL"
                description="Sistem pencatatan untuk data alur kerja dan audit."
                state={snapshot.readiness.components.database}
                tone={databaseState.tone}
                label={databaseState.label}
              />
              <ServiceTile
                icon={<Cpu className="size-4" aria-hidden="true" />}
                name="Antrean Redis"
                description="Broker dan cache untuk analisis AI asinkron."
                state={snapshot.readiness.components.redis}
                tone={redisState.tone}
                label={redisState.label}
              />
              <ServiceTile
                icon={<Radio className="size-4" aria-hidden="true" />}
                name="Worker AI"
                description="Heartbeat informatif. Inferensi berjalan asinkron dan tidak menghambat API."
                state={snapshot.readiness.components.worker}
                tone={workerState.tone}
                label={workerState.label}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-secondary">
              <span>
                Versi API{" "}
                <span className="font-mono text-ink">
                  {snapshot.meta ? `${snapshot.meta.version} (${snapshot.meta.api_version})` : "tidak tersedia"}
                </span>
              </span>
              <span>
                Lingkungan{" "}
                <span className="font-mono text-ink">
                  {snapshot.meta?.environment ?? "tidak tersedia"}
                </span>
              </span>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-ai/20 bg-ai-soft px-3 py-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ai" aria-hidden="true" />
              <p className="text-xs leading-5 text-ink">
                {snapshot.meta?.ai_disclaimer ?? FALLBACK_DISCLAIMER}
              </p>
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
