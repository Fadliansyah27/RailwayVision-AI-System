"use client";

import { Loader2, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import {
  apiRequest,
  ApiError,
  type AssetCategory,
  type AssetSummary,
  type LocationInfo,
} from "@/lib/api";

export function AssetEditor({
  token,
  categories,
  locations,
  asset,
  onSaved,
  onCancel,
}: {
  token: string;
  categories: AssetCategory[];
  locations: LocationInfo[];
  asset?: AssetSummary;
  onSaved: (asset: AssetSummary) => void;
  onCancel: () => void;
}) {
  const editing = Boolean(asset);
  const [code, setCode] = useState(asset?.code ?? "");
  const [name, setName] = useState(asset?.name ?? "");
  const [description, setDescription] = useState(asset?.description ?? "");
  const [categoryId, setCategoryId] = useState(asset?.category.id ?? "");
  const [locationId, setLocationId] = useState(asset?.location?.id ?? "");
  const [status, setStatus] = useState(asset?.status ?? "active");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const common = {
        name: name.trim(),
        description: description.trim(),
        category_id: categoryId,
        location_id: locationId || null,
        status,
      };
      const saved = asset
        ? await apiRequest<AssetSummary>(`/api/v1/assets/${asset.id}`, {
            method: "PATCH",
            token,
            body: common,
          })
        : await apiRequest<AssetSummary>("/api/v1/assets", {
            method: "POST",
            token,
            body: { ...common, code: code.trim().toUpperCase() },
          });
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat menyimpan aset.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-canvas/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {editing ? `Ubah ${asset?.code}` : "Daftarkan aset"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-secondary">
            {editing
              ? "Perubahan diperiksa cakupannya dan dicatat pada riwayat aktivitas."
              : "Gunakan identitas sintetis sampai KCIC menyetujui master aset."}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1.5 text-secondary hover:bg-canvas hover:text-ink"
          aria-label="Tutup editor aset"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="asset-code">
              Kode aset
            </label>
            <input
              id="asset-code"
              className={`${inputClass} mt-1 font-mono`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={editing}
              required
              minLength={3}
              maxLength={48}
              pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
              placeholder="SINTETIS-AST-0004"
            />
            <p className="mt-1 text-[11px] text-secondary">
              Huruf besar oleh API. Huruf, angka, tanda hubung, garis bawah.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="asset-status">
              Status
            </label>
            <select
              id="asset-status"
              className={`${inputClass} mt-1`}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="active">Aktif</option>
              <option value="out_of_service">Tidak Beroperasi</option>
              <option value="retired">Dinonaktifkan</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="asset-name">
              Nama
            </label>
            <input
              id="asset-name"
              className={`${inputClass} mt-1`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              maxLength={200}
              placeholder="Segmen jalur sintetis B"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="asset-category">
              Kategori
            </label>
            <select
              id="asset-category"
              className={`${inputClass} mt-1`}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
            >
              <option value="">Pilih kategori…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="asset-location">
              Lokasi (opsional)
            </label>
            <select
              id="asset-location"
              className={`${inputClass} mt-1`}
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">Tanpa lokasi</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} — {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="asset-description">
              Deskripsi
            </label>
            <textarea
              id="asset-description"
              className={`${inputClass} mt-1 min-h-20`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              placeholder="Catatan sintetis untuk pengujian prototipe."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className={primaryButtonClass} disabled={saving || !categoryId}>
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            {editing ? "Simpan perubahan" : "Buat aset"}
          </button>
          <button type="button" className={secondaryButtonClass} onClick={onCancel}>
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}
