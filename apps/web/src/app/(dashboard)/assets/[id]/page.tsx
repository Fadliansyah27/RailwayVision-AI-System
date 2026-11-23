"use client";

import {
  ArrowLeft,
  ClipboardPlus,
  ImageOff,
  Info,
  Loader2,
  Pencil,
  ShieldX,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AssetEditor } from "@/components/asset-editor";
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/form-styles";
import { AssetStatusChip, DemoBadge, InspectionStatusChip } from "@/components/records";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type AssetCategory,
  type AssetDetail,
  type AssetSummary,
  type LocationInfo,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/domain";

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const assetId = params?.id;
  const { token, has } = useAuth();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canWrite = has("assets:write");
  const canInspect = has("inspections:write");

  useEffect(() => {
    if (!token || !assetId) {
      return;
    }
    let cancelled = false;
    apiRequest<AssetDetail>(`/api/v1/assets/${assetId}`, { token })
      .then((data) => {
        if (!cancelled) {
          setAsset(data);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : "Tidak dapat memuat aset ini.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, token]);

  useEffect(() => {
    if (!token || !canWrite) {
      return;
    }
    let cancelled = false;
    Promise.all([
      apiRequest<AssetCategory[]>("/api/v1/asset-categories", { token }),
      apiRequest<LocationInfo[]>("/api/v1/locations", { token }),
    ])
      .then(([categoryData, locationData]) => {
        if (!cancelled) {
          setCategories(categoryData);
          setLocations(locationData);
          setOptionError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setOptionError(
            caught instanceof ApiError ? caught.message : "Tidak dapat memuat opsi editor.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canWrite, token]);

  function handleSaved(saved: AssetSummary) {
    setAsset((current) => (current ? { ...current, ...saved } : current));
    setEditing(false);
    setNotice("Detail aset tersimpan dan tercatat pada audit.");
  }

  if (loading) {
    return (
      <Card className="flex items-center gap-2 p-8 text-sm text-secondary">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Memuat aset…
      </Card>
    );
  }

  if (error || !asset) {
    return (
      <div className="space-y-4">
        <Link
          href="/assets"
          className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Kembali ke register aset
        </Link>
        <Card className="flex items-start gap-3 border-critical/20 bg-critical-soft p-5">
          <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink">Aset tidak tersedia</p>
            <p className="mt-1 text-sm text-secondary">
              {error ?? "Aset ini tidak ada atau di luar cakupan Anda."}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/assets"
        className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to asset register
      </Link>

      <PageHeader
        eyebrow={`Aset · ${asset.category.name}`}
        title={asset.name}
        description={asset.description || "Belum ada deskripsi untuk aset ini."}
        actions={
          <>
            {canInspect ? (
              <Link href={`/inspections/new?asset=${asset.id}`} className={primaryButtonClass}>
                <ClipboardPlus className="size-3.5" aria-hidden="true" />
                Inspeksi baru
              </Link>
            ) : null}
            {canWrite ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setEditing((value) => !value);
                  setNotice(null);
                }}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Ubah aset
              </button>
            ) : null}
          </>
        }
      />

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm text-ink"
        >
          <Info className="size-4 shrink-0 text-success" aria-hidden="true" />
          {notice}
        </div>
      ) : null}

      {editing && canWrite ? (
        <Card className="p-5">
          {optionError ? (
            <p className="text-sm text-critical">{optionError}</p>
          ) : (
            <AssetEditor
              token={token ?? ""}
              categories={categories}
              locations={locations}
              asset={asset}
              onSaved={handleSaved}
              onCancel={() => setEditing(false)}
            />
          )}
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Catatan aset" description="Metadata registrasi sesuai cakupan." />
          <dl className="grid gap-5 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-secondary">Kode aset</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-ink">{asset.code}</span>
                <DemoBadge code={asset.code} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-secondary">Status</dt>
              <dd className="mt-1">
                <AssetStatusChip status={asset.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-secondary">Kategori</dt>
              <dd className="mt-1 text-sm text-ink">{asset.category.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-secondary">Lokasi</dt>
              <dd className="mt-1 text-sm text-ink">
                {asset.location ? `${asset.location.code} — ${asset.location.name}` : "Belum ditetapkan"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-secondary">Cakupan organisasi</dt>
              <dd className="mt-1 text-sm text-ink">{asset.scope.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-secondary">Terdaftar</dt>
              <dd className="mt-1 text-sm text-ink">{formatDateTime(asset.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-secondary">Terakhir diperbarui</dt>
              <dd className="mt-1 text-sm text-ink">{formatDateTime(asset.updated_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-secondary">Inspeksi terakhir</dt>
              <dd className="mt-1 text-sm text-ink">
                {asset.latest_inspection ? (
                  <Link
                    href={`/inspections/${asset.latest_inspection.id}`}
                    className="font-mono text-xs font-semibold text-primary hover:underline"
                  >
                    {asset.latest_inspection.reference}
                  </Link>
                ) : (
                  "Belum ada"
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Pipeline bukti" description="Kemampuan pada versi ini." />
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <ImageOff className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-ink">Media dilampirkan per inspeksi</p>
                <p className="mt-1 text-xs leading-5 text-secondary">
                  Buka inspeksi untuk mengunggah bukti. Gambar disimpan privat, diverifikasi
                  dengan digest SHA-256 di sisi server, dan setiap pembacaan diaudit. Hasil deteksi
                  tidak pernah dihasilkan atau disimulasikan pada versi ini.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-warning/20 bg-warning-soft px-3 py-2 text-[11px] leading-5 text-ink">
              Saran AI, bila diaktifkan, tetap bersifat advisori. Pemeriksa teknis berwenang membuat
              setiap keputusan rekayasa. Sistem ini tidak pernah menyatakan aset aman atau tidak aman.
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Riwayat inspeksi"
          description="20 inspeksi terbaru yang tercatat untuk aset ini dalam cakupan Anda."
        />
        {asset.inspections.length === 0 ? (
          <EmptyState
            title="Belum ada inspeksi"
            description={
              canInspect
                ? "Mulai inspeksi draf untuk membuat catatan DEMO pertama bagi aset ini."
                : "Inspeksi yang dicatat petugas lapangan akan tampil di sini."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Referensi
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Diperiksa
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {asset.inspections.map((inspection) => (
                  <tr key={inspection.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/inspections/${inspection.id}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {inspection.reference}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-secondary">
                      {formatDateTime(inspection.inspected_at)}
                    </td>
                    <td className="px-5 py-3">
                      <InspectionStatusChip status={inspection.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
