"use client";

import { ArrowLeft, Info, Loader2, MapPin, Tag } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  subtleButtonClass,
} from "@/components/admin/form-styles";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type AssetCategory,
  type LocationInfo,
  type ScopeInfo,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

function readError(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

export default function AssetReferencePage() {
  const { token, user, has } = useAuth();
  const canWrite = has("assets:write");

  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [scopes, setScopes] = useState<ScopeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [categoryCode, setCategoryCode] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  const [locationCode, setLocationCode] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationDescription, setLocationDescription] = useState("");
  const [locationScopeId, setLocationScopeId] = useState("");
  const [editingLocation, setEditingLocation] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    Promise.all([
      apiRequest<AssetCategory[]>("/api/v1/asset-categories", { token }),
      apiRequest<LocationInfo[]>("/api/v1/locations", { token }),
      apiRequest<ScopeInfo[]>("/api/v1/scopes", { token }),
    ])
      .then(([categoryData, locationData, scopeData]) => {
        if (cancelled) {
          return;
        }
        setCategories(categoryData);
        setLocations(locationData);
        setScopes(scopeData);
        setError(null);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(readError(caught, "Tidak dapat memuat data referensi."));
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
  }, [reloadKey, token]);

  const effectiveLocationScopeId = locationScopeId || user?.scope.id || "";

  const reload = useCallback(() => {
    setLoading(true);
    setReloadKey((value) => value + 1);
  }, []);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const created = await apiRequest<AssetCategory>("/api/v1/asset-categories", {
        method: "POST",
        token,
        body: { code: categoryCode.trim(), name: categoryName.trim() },
      });
      setCategoryCode("");
      setCategoryName("");
      setNotice(`Kategori ${created.code} dibuat.`);
      reload();
    } catch (caught) {
      setActionError(readError(caught, "Tidak dapat membuat kategori."));
    } finally {
      setBusy(false);
    }
  }

  async function renameCategory(category: AssetCategory) {
    const name = window.prompt(`Nama baru untuk ${category.code}?`, category.name)?.trim();
    if (!name || name === category.name) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await apiRequest<AssetCategory>(`/api/v1/asset-categories/${category.id}`, {
        method: "PATCH",
        token,
        body: { name },
      });
      setEditingCategory(null);
      setNotice(`Kategori ${category.code} diganti namanya.`);
      reload();
    } catch (caught) {
      setActionError(readError(caught, "Tidak dapat memperbarui kategori."));
    } finally {
      setBusy(false);
    }
  }

  async function createLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const created = await apiRequest<LocationInfo>("/api/v1/locations", {
        method: "POST",
        token,
        body: {
          code: locationCode.trim(),
          name: locationName.trim(),
          description: locationDescription.trim(),
          scope_id: locationScopeId || effectiveLocationScopeId,
        },
      });
      setLocationCode("");
      setLocationName("");
      setLocationDescription("");
      setNotice(`Lokasi ${created.code} dibuat.`);
      reload();
    } catch (caught) {
      setActionError(readError(caught, "Tidak dapat membuat lokasi."));
    } finally {
      setBusy(false);
    }
  }

  async function updateLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingLocation) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await apiRequest<LocationInfo>(`/api/v1/locations/${editingLocation}`, {
        method: "PATCH",
        token,
        body: {
          name: locationName.trim(),
          description: locationDescription.trim(),
        },
      });
      setEditingLocation(null);
      setLocationName("");
      setLocationDescription("");
      setNotice("Lokasi diperbarui.");
      reload();
    } catch (caught) {
      setActionError(readError(caught, "Tidak dapat memperbarui lokasi."));
    } finally {
      setBusy(false);
    }
  }

  function startEditLocation(location: LocationInfo) {
    setEditingLocation(location.id);
    setLocationName(location.name);
    setLocationDescription(location.description);
    setNotice(null);
    setActionError(null);
  }

  const scopeCodes = new Map(scopes.map((scope) => [scope.id, scope.code]));

  return (
    <div className="space-y-6">
      <Link
        href="/assets"
        className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Kembali ke aset
      </Link>

      <PageHeader
        eyebrow="Register · Fase 3"
        title="Kategori & lokasi"
        description="Data referensi di balik register aset. Semua entri adalah data sintetis; jangan memasukkan kode aset atau koordinat KCIC asli tanpa persetujuan."
      />

      <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-soft px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-sm leading-6 text-ink">
          <span className="font-semibold">Hanya data referensi sintetis.</span> Kategori berlaku
          global; lokasi terikat pada cakupan organisasi dan hanya dapat dipakai di dalamnya.
          Setiap perubahan dicatat pada riwayat aktivitas.
        </p>
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-success/20 bg-success-soft px-4 py-3"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-sm text-ink">{notice}</p>
        </div>
      ) : null}

      {actionError ? (
        <p
          role="alert"
          className="rounded-xl border border-critical/20 bg-critical-soft px-4 py-3 text-sm text-ink"
        >
          {actionError}
        </p>
      ) : null}

      {error ? (
        <Card className="flex items-start gap-3 border-critical/20 bg-critical-soft p-5">
          <div>
            <p className="text-sm font-semibold text-ink">Data referensi tidak tersedia</p>
            <p className="mt-1 text-sm text-secondary">{error}</p>
            <button type="button" className={`${secondaryButtonClass} mt-3`} onClick={reload}>
              Coba Lagi
            </button>
          </div>
        </Card>
      ) : loading ? (
        <Card className="flex items-center gap-2 p-8 text-sm text-secondary">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Memuat data referensi…
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Kategori aset"
              description="Klasifikasi global yang digunakan semua cakupan."
            />
            <div className="space-y-4 p-5">
              {canWrite ? (
                <form className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]" onSubmit={createCategory}>
                  <div>
                    <label className={labelClass} htmlFor="category-code">
                      Kode
                    </label>
                    <input
                      id="category-code"
                      className={`${inputClass} mt-1`}
                      value={categoryCode}
                      onChange={(event) => setCategoryCode(event.target.value)}
                      maxLength={32}
                      required
                      placeholder="SINTETIS-BRIDGE"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="category-name">
                      Nama
                    </label>
                    <input
                      id="category-name"
                      className={`${inputClass} mt-1`}
                      value={categoryName}
                      onChange={(event) => setCategoryName(event.target.value)}
                      maxLength={120}
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className={primaryButtonClass} disabled={busy}>
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Tag className="size-3.5" aria-hidden="true" />
                      )}
                      Tambah
                    </button>
                  </div>
                </form>
              ) : null}

              {categories.length === 0 ? (
                <EmptyState
                  icon={<Tag className="size-5" aria-hidden="true" />}
                  title="Belum ada kategori"
                  description="Tambahkan kategori sintetis pertama untuk mengklasifikasikan aset."
                />
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {categories.map((category) => (
                    <li
                      key={category.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                    >
                      <div>
                        <p className="font-mono text-[11px] text-secondary">{category.code}</p>
                        <p className="text-sm text-ink">{category.name}</p>
                      </div>
                      {canWrite ? (
                        <button
                          type="button"
                          className={subtleButtonClass}
                          onClick={() => {
                            setEditingCategory(category.id);
                            void renameCategory(category);
                          }}
                          disabled={busy || editingCategory === category.id}
                        >
                          Ganti nama
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Lokasi"
              description="Titik referensi terikat cakupan. Hanya nama teks bebas; tanpa koordinat."
            />
            <div className="space-y-4 p-5">
              {canWrite ? (
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={editingLocation ? updateLocation : createLocation}
                >
                  {!editingLocation ? (
                    <>
                      <div>
                        <label className={labelClass} htmlFor="location-code">
                          Kode
                        </label>
                        <input
                          id="location-code"
                          className={`${inputClass} mt-1`}
                          value={locationCode}
                          onChange={(event) => setLocationCode(event.target.value)}
                          maxLength={32}
                          required
                          placeholder="SINTETIS-LOC-01"
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="location-scope">
                          Cakupan organisasi
                        </label>
                        <select
                          id="location-scope"
                          className={`${inputClass} mt-1`}
                          value={effectiveLocationScopeId}
                          onChange={(event) => setLocationScopeId(event.target.value)}
                          required
                        >
                          {scopes.map((scope) => (
                            <option key={scope.id} value={scope.id}>
                              {scope.code} — {scope.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : null}
                  <div>
                    <label className={labelClass} htmlFor="location-name">
                      Nama
                    </label>
                    <input
                      id="location-name"
                      className={`${inputClass} mt-1`}
                      value={locationName}
                      onChange={(event) => setLocationName(event.target.value)}
                      maxLength={120}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="location-description">
                      Deskripsi
                    </label>
                    <input
                      id="location-description"
                      className={`${inputClass} mt-1`}
                      value={locationDescription}
                      onChange={(event) => setLocationDescription(event.target.value)}
                      maxLength={255}
                    />
                  </div>
                  <div className="flex items-end gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      className={primaryButtonClass}
                      disabled={busy || !effectiveLocationScopeId}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <MapPin className="size-3.5" aria-hidden="true" />
                      )}
                      {editingLocation ? "Simpan lokasi" : "Tambah lokasi"}
                    </button>
                    {editingLocation ? (
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => {
                          setEditingLocation(null);
                          setLocationName("");
                          setLocationDescription("");
                        }}
                      >
                        Batal ubah
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : null}

              {locations.length === 0 ? (
                <EmptyState
                  icon={<MapPin className="size-5" aria-hidden="true" />}
                  title="Belum ada lokasi"
                  description="Tambahkan lokasi sintetis untuk mengikat aset ke suatu tempat."
                />
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {locations.map((location) => (
                    <li
                      key={location.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-secondary">
                          {location.code} · {scopeCodes.get(location.scope_id) ?? "cakupan"}
                        </p>
                        <p className="text-sm text-ink">{location.name}</p>
                        {location.description ? (
                          <p className="text-[11px] text-secondary">{location.description}</p>
                        ) : null}
                      </div>
                      {canWrite ? (
                        <button
                          type="button"
                          className={subtleButtonClass}
                          onClick={() => startEditLocation(location)}
                        >
                          Ubah
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
