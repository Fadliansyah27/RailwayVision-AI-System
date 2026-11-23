"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
        <div
          className="flex size-11 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-lg shadow-primary/25"
          style={{ backgroundImage: "var(--rv-gradient-primary)" }}
        >
          RV
        </div>
        <div className="flex items-center gap-2 text-sm text-secondary">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {status === "loading" ? "Memulihkan sesi aman…" : "Mengalihkan ke halaman masuk…"}
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
