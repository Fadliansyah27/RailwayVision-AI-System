"use client";

import { Bell, BellOff, CheckCheck, Info, Loader2, RefreshCw, ShieldX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import { Pagination } from "@/components/records";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type NotificationItem,
  type NotificationStats,
  type Page,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  NOTIFICATION_KIND_LABELS,
  buildQuery,
  formatDateTime,
  notificationTargetHref,
} from "@/lib/domain";

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { token } = useAuth();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<NotificationItem> | null>(null);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (targetPage: number, onlyUnread: boolean) => {
      if (!token) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await apiRequest<Page<NotificationItem>>(
          `/api/v1/notifications${buildQuery({
            page: targetPage,
            page_size: PAGE_SIZE,
            unread_only: onlyUnread,
          })}`,
          { token },
        );
        setData(result);
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : "Tidak dapat memuat notifikasi.",
        );
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount and on filter change
    void load(page, unreadOnly);
  }, [load, page, reloadKey, unreadOnly]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    apiRequest<NotificationStats>("/api/v1/notifications/summary", { token })
      .then((summary) => {
        if (!cancelled) {
          setStats(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStats(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, token]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setReloadKey((value) => value + 1);
  }

  async function markRead(id: string) {
    setSaving(true);
    try {
      await apiRequest<NotificationItem>(`/api/v1/notifications/${id}/read`, {
        method: "POST",
        token,
        body: {},
      });
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Tidak dapat memperbarui notifikasi.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function markAllRead() {
    setSaving(true);
    try {
      await apiRequest<NotificationStats>("/api/v1/notifications/read-all", {
        method: "POST",
        token,
        body: {},
      });
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Tidak dapat memperbarui notifikasi.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operasional · Fase 7"
        title="Notifikasi"
        description="Pemberitahuan alur kerja dalam aplikasi untuk temuan dan perintah kerja. Pengiriman hanya melalui halaman terautentikasi ini; tidak ada transportasi email atau SMS."
        actions={
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => void markAllRead()}
            disabled={saving || (stats?.unread ?? 0) === 0}
          >
            <CheckCheck className="size-3.5" aria-hidden="true" />
            Tandai semua dibaca
          </button>
        }
      />

      <div className="flex items-start gap-3 rounded-xl border border-border bg-canvas px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
        <p className="text-sm leading-6 text-ink">
          Notifikasi bersifat pemberitahuan kenyamanan. Catatan temuan atau perintah kerja adalah
          sumber kebenaran dan mungkin sudah berubah sejak pemberitahuan dibuat.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Filter"
          description={stats ? `${stats.unread} notifikasi belum dibaca` : undefined}
          actions={
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className={secondaryButtonClass}
              disabled={loading}
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Muat ulang
            </button>
          }
        />
        <form className="flex flex-wrap items-center gap-3 p-5" onSubmit={handleFilter}>
          <label className="flex items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={unreadOnly}
              onChange={(event) => {
                setUnreadOnly(event.target.checked);
                setPage(1);
              }}
            />
            Hanya tampilkan yang belum dibaca
          </label>
          <button type="submit" className={primaryButtonClass}>
            Terapkan
          </button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Log notifikasi"
          description={
            data ? `${data.total} notifikasi untuk akun Anda` : undefined
          }
        />
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Memuat notifikasi…
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 px-5 py-8">
            <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink">Notifikasi tidak tersedia</p>
              <p className="mt-1 text-sm text-secondary">{error}</p>
              <button
                type="button"
                className={`${secondaryButtonClass} mt-3`}
                onClick={() => setReloadKey((value) => value + 1)}
              >
                Coba Lagi
              </button>
            </div>
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<BellOff className="size-5" aria-hidden="true" />}
            title={unreadOnly ? "Tidak ada notifikasi belum dibaca" : "Belum ada notifikasi"}
            description="Aktivitas temuan dan perintah kerja dalam cakupan Anda akan tampil di sini."
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {data.items.map((notification) => {
                const href = notificationTargetHref(
                  notification.target_type,
                  notification.target_id,
                );
                const unread = notification.read_at === null;
                return (
                  <li
                    key={notification.id}
                    className={`flex flex-wrap gap-3 px-5 py-4 ${unread ? "bg-canvas/60" : ""}`}
                  >
                    <Bell
                      className={`mt-0.5 size-4 shrink-0 ${unread ? "text-primary" : "text-secondary"}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{notification.title}</p>
                      <p className="mt-1 text-sm leading-6 text-secondary">
                        {notification.body}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-secondary">
                        {NOTIFICATION_KIND_LABELS[notification.kind] ?? notification.kind} ·{" "}
                        {formatDateTime(notification.created_at)}
                        {unread ? " · belum dibaca" : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {href ? (
                          <Link
                            href={href}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Buka catatan
                          </Link>
                        ) : null}
                        {unread ? (
                          <button
                            type="button"
                            onClick={() => void markRead(notification.id)}
                            disabled={saving}
                            className="text-xs font-semibold text-secondary hover:text-ink disabled:opacity-60"
                          >
                            Tandai dibaca
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
