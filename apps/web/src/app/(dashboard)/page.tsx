import { ArrowRight, Info, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { OperationalOverview } from "@/components/operational-overview";
import { RecentActivity } from "@/components/recent-activity";
import { SystemStatusPanel } from "@/components/status-panel";
import { Card, CardHeader, Chip, PageHeader } from "@/components/ui";

const DELIVERY_STATUS = [
  {
    module: "Fondasi, CI, stack lokal",
    phase: "Fase 1",
    status: "Selesai" as const,
  },
  {
    module: "Autentikasi, RBAC, cakupan, riwayat aktivitas",
    phase: "Fase 2",
    status: "Selesai" as const,
  },
  {
    module: "Register aset dan inspeksi",
    phase: "Fase 3",
    status: "Selesai" as const,
  },
  {
    module: "Bukti media dan pipeline AI sintetis",
    phase: "Fase 4",
    status: "Selesai" as const,
  },
  {
    module: "Model AI terotorisasi, evaluasi, konsol registri",
    phase: "Fase 5",
    status: "Terblokir" as const,
  },
  {
    module: "Verifikasi manusia dan tinjauan bukti",
    phase: "Fase 6",
    status: "Selesai" as const,
  },
  {
    module: "Temuan, perintah kerja, notifikasi",
    phase: "Fase 7",
    status: "Selesai" as const,
  },
  {
    module: "Dasbor KPI aktual dan pelaporan",
    phase: "Fase 8",
    status: "Selesai" as const,
  },
  {
    module: "Aplikasi lapangan Flutter",
    phase: "Fase 9",
    status: "Direncanakan" as const,
  },
  {
    module: "Pengujian integrasi dan keamanan",
    phase: "Fase 10",
    status: "Direncanakan" as const,
  },
];

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ringkasan operasional"
        title="Ringkasan program inspeksi"
        description="Satu ruang kerja untuk bukti inspeksi, penyaringan berbantuan AI, verifikasi manusia yang berwenang, dan pemantauan tindakan perbaikan. Antarmuka terhubung ke API langsung; catatan bersifat sintetis dan diberi label SINTETIS."
        actions={
          <>
            <Link
              href="/inspections"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-strong"
            >
              Buka inspeksi
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
            <Link
              href="/system-status"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-ink hover:bg-canvas"
            >
              Lihat status sistem
            </Link>
          </>
        }
      />

      <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-soft px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-sm leading-6 text-ink">
          <span className="font-semibold">Angka dasbor dihitung langsung dari PostgreSQL.</span>{" "}
          Setiap kartu dan grafik mengikuti cakupan organisasi akun, sehingga supervisor hanya
          melihat catatan pada cakupannya. Pemeriksa teknis mencatat temuan pada inspeksi yang telah
          ditinjau, supervisor menugaskan perintah kerja dengan transisi tervalidasi server, dan
          penerima tugas mendapat notifikasi dalam aplikasi. Setiap tindakan diaudit; bukti tetap
          privat dengan verifikasi SHA-256, dan pipeline AI sintetis tetap diberi label jelas, tanpa
          klaim deteksi kerusakan atau akurasi. Akun dan catatan yang ditampilkan di sini adalah
          data sintetis berlabel SINTETIS, bukan data operasional KCIC.
        </p>
      </div>

      <OperationalOverview />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SystemStatusPanel />
        </div>

        <Card>
          <CardHeader title="Batas keselamatan" description="Tidak dapat dinegosiasikan pada platform ini." />
          <ul className="space-y-3 p-5">
            {[
              "Keluaran AI bersifat saran. Pemeriksa teknis berwenang membuat setiap keputusan rekayasa.",
              "Tanpa fungsi kendali kereta, persinyalan, interlocking, pengaturan perjalanan, atau izin keselamatan.",
              "Tidak ada keputusan otomatis “aman” atau “tidak aman” di mana pun dalam sistem.",
              "Hanya data sintetis atau data yang secara eksplisit diotorisasi sampai KCIC menyetujui dataset.",
              "Bukti asli dipertahankan; anotasi merupakan turunan terpisah.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden="true"
                />
                <span className="text-sm leading-6 text-secondary">{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Status pengiriman"
            description="Modul tersedia hanya setelah gerbang penerimaannya terverifikasi."
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Modul
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Fase
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {DELIVERY_STATUS.map((row) => (
                  <tr key={row.module} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 text-ink">{row.module}</td>
                    <td className="px-5 py-3 font-mono text-xs text-secondary">{row.phase}</td>
                    <td className="px-5 py-3">
                      <Chip
                        tone={
                          row.status === "Selesai"
                            ? "success"
                            : row.status === "Terblokir"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {row.status}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Aktivitas terbaru" description="Entri riwayat aktivitas terbaru." />
          <RecentActivity />
        </Card>
      </div>
    </div>
  );
}
