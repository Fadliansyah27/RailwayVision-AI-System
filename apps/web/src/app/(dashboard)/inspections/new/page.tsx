"use client";

import { ArrowLeft, Info, Loader2, ShieldX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type AssetSummary,
  type InspectionSummary,
  type Page,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { INSPECTION_TYPE_LABELS, defaultDatetimeLocalValue } from "@/lib/domain";

function NewInspectionForm() {
  const { token, has, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAsset = searchParams.get("asset") ?? "";
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [assetTotal, setAssetTotal] = useState(0);
  const [assetId, setAssetId] = useState(preselectedAsset);
  const [inspectionType, setInspectionType] = useState("routine");
  const [locationReference, setLocationReference] = useState("");
  const [inspectedAt, setInspectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canWrite = has("inspections:write");

  useEffect(() => {
    // Client-only clock default avoids a server/client hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initializes a client-only default value
    setInspectedAt((current) => current || defaultDatetimeLocalValue());
  }, []);

  useEffect(() => {
    if (!token || !canWrite) {
      return;
    }
    let cancelled = false;
    apiRequest<Page<AssetSummary>>("/api/v1/assets?page=1&page_size=100", { token })
      .then((page) => {
        if (cancelled) {
          return;
        }
        setAssets(page.items);
        setAssetTotal(page.total);
        setAssetError(null);
        if (preselectedAsset && page.items.some((asset) => asset.id === preselectedAsset)) {
          setAssetId(preselectedAsset);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setAssetError(
            caught instanceof ApiError ? caught.message : "Tidak dapat memuat aset.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAssets(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canWrite, preselectedAsset, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await apiRequest<InspectionSummary>("/api/v1/inspections", {
        method: "POST",
        token,
        body: {
          asset_id: assetId,
          inspection_type: inspectionType,
          location_reference: locationReference.trim(),
          inspected_at: inspectedAt ? new Date(inspectedAt).toISOString() : null,
          notes: notes.trim(),
        },
      });
      router.push(`/inspections/${created.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat membuat inspeksi.");
    } finally {
      setSaving(false);
    }
  }

  if (!canWrite) {
    return (
      <Card className="flex items-start gap-3 border-critical/20 bg-critical-soft p-5">
        <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-ink">Pencatatan inspeksi tidak diizinkan</p>
          <p className="mt-1 text-sm text-secondary">
            Peran Anda tidak menyertakan <code className="font-mono">inspections:write</code>. API
            memberlakukan hal ini meskipun halaman dibuka langsung.
          </p>
          <Link href="/inspections" className={`${secondaryButtonClass} mt-3`}>
            Kembali ke inspeksi
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/inspections"
        className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Kembali ke inspeksi
      </Link>

      <PageHeader
        eyebrow="Operasional · Fase 6"
        title="Draf inspeksi baru"
        description={
          user
            ? `Draf dibuat di cakupan ${user.scope.name} untuk aset dalam cakupan Anda. Gambar bukti dapat dilampirkan dari halaman inspeksi.`
            : undefined
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Detail inspeksi"
            description="Draf hanya dapat diubah oleh inspektur yang ditugaskan, lalu dikirim untuk ditinjau."
          />
          <form className="space-y-4 p-5" onSubmit={handleSubmit}>
            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
              >
                {error}
              </p>
            ) : null}

            <div>
              <label className={labelClass} htmlFor="inspection-asset">
                Aset
              </label>
              {loadingAssets ? (
                <div className="mt-1 flex items-center gap-2 text-sm text-secondary">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Memuat aset…
                </div>
              ) : assetError ? (
                <p className="mt-1 text-sm text-critical">{assetError}</p>
              ) : (
                <select
                  id="inspection-asset"
                  className={`${inputClass} mt-1`}
                  value={assetId}
                  onChange={(event) => setAssetId(event.target.value)}
                  required
                >
                  <option value="">Pilih aset…</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.code} — {asset.name}
                    </option>
                  ))}
                </select>
              )}
              {assetTotal > assets.length ? (
                <p className="mt-1 text-[11px] text-secondary">
                  Menampilkan {assets.length} aset pertama dari {assetTotal} aset. Untuk register
                  yang lebih besar, pilih aset dari halaman detailnya.
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="inspection-type">
                  Jenis inspeksi
                </label>
                <select
                  id="inspection-type"
                  className={`${inputClass} mt-1`}
                  value={inspectionType}
                  onChange={(event) => setInspectionType(event.target.value)}
                >
                  {Object.entries(INSPECTION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-secondary">
                  Taksonomi DEMO sementara sampai KCIC menyetujui jenis inspeksi.
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="inspection-location-ref">
                  Referensi lokasi
                </label>
                <input
                  id="inspection-location-ref"
                  className={`${inputClass} mt-1`}
                  value={locationReference}
                  onChange={(event) => setLocationReference(event.target.value)}
                  maxLength={200}
                  placeholder="Referensi lokal bebas, mis. penanda DEMO chainage"
                />
                <p className="mt-1 text-[11px] text-secondary">
                  Jangan memasukkan koordinat KCIC yang belum disetujui.
                </p>
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="inspection-date">
                Waktu diperiksa
              </label>
              <input
                id="inspection-date"
                type="datetime-local"
                className={`${inputClass} mt-1`}
                value={inspectedAt}
                onChange={(event) => setInspectedAt(event.target.value)}
              />
              <p className="mt-1 text-[11px] text-secondary">
                Bila kosong, default ke waktu sekarang. Disimpan API dalam UTC dan ditampilkan dalam
                zona waktu Asia/Jakarta.
              </p>
            </div>

            <div>
              <label className={labelClass} htmlFor="inspection-notes">
                Catatan
              </label>
              <textarea
                id="inspection-notes"
                className={`${inputClass} mt-1 min-h-32`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={4000}
                placeholder="Catatan observasi untuk draf ini. Jangan mencatat izin keselamatan."
              />
              <p className="mt-1 text-right font-mono text-[10px] text-secondary">
                {notes.length} / 4000
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className={primaryButtonClass}
                disabled={saving || !assetId || loadingAssets}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                Buat draf
              </button>
              <Link href="/inspections" className={secondaryButtonClass}>
                Batal
              </Link>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Sebelum mencatat" description="Batas cakupan dan keselamatan." />
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <p className="text-xs leading-5 text-secondary">
                Gunakan catatan DEMO sintetis saja sampai KCIC menyetujui register aset dan prosedur
                inspeksi.
              </p>
            </div>
            <ul className="space-y-2 text-xs leading-5 text-secondary">
              <li>API menetapkan referensi inspeksi unik dan mencatat peristiwa audit.</li>
              <li>Hanya inspektur yang ditugaskan yang dapat mengubah draf.</li>
              <li>
                Pengiriman mengunci perubahan; supervisor dapat membatalkan catatan yang sudah
                dikirim.
              </li>
              <li>Tidak ada analisis AI dan tidak ada kesimpulan keselamatan yang diambil.</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function NewInspectionPage() {
  return (
    <Suspense
      fallback={
        <Card className="flex items-center gap-2 p-8 text-sm text-secondary">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Menyiapkan formulir inspeksi…
        </Card>
      }
    >
      <NewInspectionForm />
    </Suspense>
  );
}
