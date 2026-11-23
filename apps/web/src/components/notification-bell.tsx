"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest, type NotificationStats } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
  const { token, has } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!token || !has("notifications:read")) {
      return;
    }
    let cancelled = false;
    const load = () => {
      apiRequest<NotificationStats>("/api/v1/notifications/summary", { token })
        .then((summary) => {
          if (!cancelled) {
            setUnread(summary.unread);
          }
        })
        .catch(() => {
          // The bell is non-critical; a failed poll keeps the previous count.
        });
    };
    load();
    const timer = window.setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [has, token]);

  return (
    <Link
      href="/notifications"
      className="relative inline-flex items-center justify-center rounded-lg border border-border bg-surface p-2 text-ink hover:bg-canvas"
      aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
    >
      <Bell className="size-4" aria-hidden="true" />
      {unread > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-critical px-1 font-mono text-[10px] font-semibold leading-4 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
