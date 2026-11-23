import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { SystemStatusPanel } from "@/components/status-panel";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { API_BASE_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "Status sistem",
};

const CHECKS = [
  {
    endpoint: "GET /health/live",
    purpose: "Pemeriksaan hidup proses untuk kontainer API.",
  },
  {
    endpoint: "GET /health/ready",
    purpose:
      "Memeriksa PostgreSQL dan Redis. Detak worker AI dilaporkan sebagai informasi dan tidak menentukan kesiapan API.",
  },
  {
    endpoint: "GET /api/v1/meta",
    purpose: "Identitas layanan, versi API, lingkungan, dan pemberitahuan saran AI.",
  },
  {
    endpoint: "Redis key rvai:worker:heartbeat",
    purpose:
      "Worker menulis detak bertanda waktu; detak yang kedaluwarsa tampil sebagai tidak tersedia.",
  },
];

export default function SystemStatusPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operasi platform"
        title="Status sistem"
        description="Konektivitas langsung dari dasbor ini ke API dan dependensinya. Status mencerminkan infrastruktur saja — bukan indikator keselamatan operasional."
      />

      <SystemStatusPanel />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Cara status diverifikasi"
            description="Tidak ada status yang ditulis mati di dasbor; setiap petak di atas berasal dari pemeriksaan langsung."
          />
          <ul className="divide-y divide-border">
            {CHECKS.map((check) => (
              <li key={check.endpoint} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-4">
                <code className="w-full shrink-0 font-mono text-xs text-ink sm:w-72">
                  {check.endpoint}
                </code>
                <span className="text-sm leading-6 text-secondary">{check.purpose}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Konfigurasi" description="Nilai publik yang tidak sensitif." />
          <dl className="space-y-4 p-5 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">
                URL dasar API
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-ink">{API_BASE_URL}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">
                Dokumentasi API interaktif
              </dt>
              <dd className="mt-2">
                <a
                  href={`${API_BASE_URL}/docs`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-strong"
                >
                  Buka dokumentasi OpenAPI
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
                <p className="mt-1 text-xs leading-5 text-secondary">
                  Tersedia di lingkungan lokal dan pengujian; dinonaktifkan di produksi.
                </p>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">
                Pemberitahuan data
              </dt>
              <dd className="mt-1 text-xs leading-5 text-secondary">
                Prototipe ini tidak memuat data operasional KCIC. Catatan bersifat sintetis
                dan berlabel SINTETIS.
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
