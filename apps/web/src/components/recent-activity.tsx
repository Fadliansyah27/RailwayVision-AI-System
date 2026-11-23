"use client";

import { Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui";
import { apiRequest, ApiError, type AuditEvent, type Page } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function relativeTime(value: string): string {
  const diffSeconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (diffSeconds < 60) {
    return "baru saja";
  }
  if (diffSeconds < 3600) {
    return `${Math.round(diffSeconds / 60)} menit lalu`;
  }
  if (diffSeconds < 86400) {
    return `${Math.round(diffSeconds / 3600)} jam lalu`;
  }
  return `${Math.round(diffSeconds / 86400)} hari lalu`;
}

export function RecentActivity() {
  const { token, has } = useAuth();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const permitted = has("audit:read");

  useEffect(() => {
    if (!token || !permitted) {
      return;
    }
    let cancelled = false;
    apiRequest<Page<AuditEvent>>("/api/v1/audit-events?page_size=6", { token })
      .then((data) => {
        if (!cancelled) {
          setEvents(data.items);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : "Tidak dapat memuat aktivitas.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, permitted]);

  if (!permitted) {
    return (
      <EmptyState
        icon={<Clock className="size-5" aria-hidden="true" />}
        title="Aktivitas dibatasi"
        description="Aktivitas alur kerja terbaru tersedia bagi supervisor, administrator, dan auditor melalui riwayat aktivitas."
      />
    );
  }

  if (error) {
    return (
      <p role="alert" className="px-5 py-4 text-xs leading-5 text-critical">
        {error}
      </p>
    );
  }

  if (!events) {
    return (
      <div className="flex items-center gap-2 px-5 py-8 text-sm text-secondary">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Memuat aktivitas…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="size-5" aria-hidden="true" />}
        title="Belum ada aktivitas tercatat"
        description="Proses masuk dan tindakan alur kerja penting akan tampil di sini dari riwayat aktivitas."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {events.map((event) => (
        <li key={event.id} className="px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-ink">{event.action}</p>
              <p className="mt-0.5 truncate text-[11px] text-secondary">
                {event.actor_label ?? "sistem"}
                {event.target_type ? ` · ${event.target_type}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-[10px] text-secondary">
              {relativeTime(event.created_at)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
