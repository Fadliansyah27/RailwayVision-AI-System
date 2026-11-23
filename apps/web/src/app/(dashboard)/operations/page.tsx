"use client";

import { Loader2, ShieldX } from "lucide-react";
import { useState } from "react";

import { AIJobHistory } from "@/components/operations/ai-job-history";
import { BackupStatusPanel } from "@/components/operations/backup-status-panel";
import { DeploymentHistory } from "@/components/operations/deployment-history";
import { OpsLogViewer } from "@/components/operations/ops-log-viewer";
import { SyntheticResetPanel } from "@/components/operations/synthetic-reset-panel";
import { Card, PageHeader, TabBar, TabButton } from "@/components/ui";
import { useAuth } from "@/lib/auth";

type Tab = "jobs" | "logs" | "deployments" | "backup" | "reset";

const BASE_TABS: { id: Tab; label: string; description: string }[] = [
  { id: "jobs", label: "Riwayat job AI", description: "Antrean, status, dan kegagalan pipeline" },
  { id: "logs", label: "Log API", description: "Buffer memori terbatas dan redaksi rahasia" },
  {
    id: "deployments",
    label: "Deployment",
    description: "Catatan versi dan commit untuk jejak audit",
  },
  { id: "backup", label: "Backup", description: "Status dari berkas yang dilaporkan apa adanya" },
];

const RESET_TAB: { id: Tab; label: string; description: string } = {
  id: "reset",
  label: "Reset data sintetis",
  description: "Hapus transaksi sintetis secara terkendali",
};

export default function OperationsPage() {
  const { token, has } = useAuth();
  const [tab, setTab] = useState<Tab>("jobs");

  const canManage = has("ops:manage");
  const canRead = canManage || has("audit:read");
  const tabs = canManage ? [...BASE_TABS, RESET_TAB] : BASE_TABS;

  if (!token) {
    return (
      <Card className="flex items-center gap-2 p-8 text-sm text-secondary">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Memulihkan sesi aman…
      </Card>
    );
  }

  if (!canRead) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Operasi platform"
          title="Konsol operasi"
          description="Jejak pekerjaan AI, log terbatas, deployment, dan status backup."
        />
        <Card className="flex items-start gap-3 border-critical/20 bg-critical-soft p-5">
          <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink">Akses ditolak</p>
            <p className="mt-1 text-sm leading-6 text-secondary">
              Layar ini memerlukan izin <code className="font-mono">audit:read</code> atau{" "}
              <code className="font-mono">ops:manage</code>. API menolak permintaan tanpa otorisasi
              meskipun halaman dibuka langsung.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operasi platform · Fase D"
        title="Konsol operasi"
        description="Jejak pekerjaan AI, log terbatas per peran, riwayat deployment, status backup, dan reset data sintetis. Tidak ada status yang diklaim sehat tanpa bukti dari sumbernya."
      />

      <TabBar label="Bagian konsol operasi">
        {tabs.map((item) => (
          <TabButton
            key={item.id}
            active={tab === item.id}
            onClick={() => setTab(item.id)}
            title={item.label}
            description={item.description}
          />
        ))}
      </TabBar>

      {tab === "jobs" ? <AIJobHistory token={token} /> : null}
      {tab === "logs" ? <OpsLogViewer token={token} /> : null}
      {tab === "deployments" ? (
        <DeploymentHistory token={token} canRecord={canManage} />
      ) : null}
      {tab === "backup" ? <BackupStatusPanel token={token} /> : null}
      {tab === "reset" && canManage ? <SyntheticResetPanel token={token} /> : null}
    </div>
  );
}
