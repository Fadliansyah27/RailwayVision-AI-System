"use client";

import { Info, Loader2, Map as MapIcon, Plus, RefreshCw, ShieldX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { AssetEditor } from "@/components/asset-editor";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import { AssetStatusChip, DemoBadge, Pagination } from "@/components/records";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type AssetCategory,
  type AssetStats,
  type AssetSummary,
  type LocationInfo,
  type Page,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { buildQuery, formatDateTime } from "@/lib/domain";

const PAGE_SIZE = 12;
const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "active", label: "Aktif" },
  { value: "out_of_service", label: "Tidak Beroperasi" },
  { value: "retired", label: "Dinonaktifkan" },
];

interface AssetQuery {
  search: string;
  status: string;
  categoryId: string;
  locationId: string;
  page: number;
}

export default function AssetsPage() {
  const { token, has } = useAuth();
  const [query, setQuery] = useState<AssetQuery>({
    search: "",
    status: "",
    categoryId: "",
    locationId: "",
    page: 1,
  });
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState<Page<AssetSummary> | null>(null);
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canWrite = has("assets:write");

  const loadAssets = useCallback(
    async (current: AssetQuery) => {
      if (!token) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const page = await apiRequest<Page<AssetSummary>>(
          `/api/v1/assets${buildQuery({
            page: current.page,
            page_size: PAGE_SIZE,
            search: current.search,
            status: current.status,
            category_id: current.categoryId,
            location_id: current.locationId,
          })}`,
          { token },
        );
        setData(page);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "Tidak dapat memuat aset.");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount and on query change; state updates follow the awaited request
    void loadAssets(query);
  }, [loadAssets, query, reloadKey, token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    apiRequest<AssetStats>("/api/v1/assets/summary", { token })
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

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    Promise.all([
      apiRequest<AssetCategory[]>("/api/v1/asset-categories", { token }),
      apiRequest<LocationInfo[]>("/api/v1/locations", { token }),
    ])
      .then(([categoryData, locationData]) => {
        if (cancelled) {
          return;
        }
        setCategories(categoryData);
        setLocations(locationData);
        setOptionError(null);
      })
      .catch((caught) => {
        if (!cancelled) {
          setOptionError(
            caught instanceof ApiError
              ? caught.message
              : "Tidak dapat memuat kategori dan lokasi.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery((current) => ({ ...current, search: searchInput.trim(), page: 1 }));
  }

  function resetFilters() {
    setSearchInput("");
    setQuery({ search: "", status: "", categoryId: "", locationId: "", page: 1 });
  }

  function handleCreated(asset: AssetSummary) {
    setShowCreate(false);
    setNotice(`Aset ${asset.code} telah didaftarkan.`);
    setReloadKey((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Register · Fase 3"
        title="Aset & lokasi"
        description="Register aset sesuai cakupan yang mendasari setiap inspeksi. Catatan berupa data DEMO sintetis sampai KCIC menyetujui master aset dan hierarki lokasi."
        actions={
          <>
            <Link href="/assets/reference" className={secondaryButtonClass}>
              Kategori & lokasi
            </Link>
            <Link href="/inspections" className={secondaryButtonClass}>
              Lihat inspeksi
            </Link>
            {canWrite ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  setShowCreate((value) => !value);
                  setNotice(null);
                }}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Daftarkan aset
              </button>
            ) : null}
          </>
        }
      />

      {notice ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-success/20 bg-success-soft px-4 py-3"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-sm text-ink">{notice}</p>
        </div>
      ) : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total dalam cakupan", value: stats.total },
            { label: "Aktif", value: stats.active },
            { label: "Tidak Beroperasi", value: stats.out_of_service },
            { label: "Dinonaktifkan", value: stats.retired },
          ].map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-xs font-medium text-secondary">{item.label}</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-ink">{item.value}</p>
            </Card>
          ))}
        </div>
      ) : null}

      {showCreate && canWrite ? (
        <Card className="p-5">
          {optionError ? (
            <p className="text-sm text-critical">{optionError}</p>
          ) : (
            <AssetEditor
              token={token ?? ""}
              categories={categories}
              locations={locations}
              onSaved={handleCreated}
              onCancel={() => setShowCreate(false)}
            />
          )}
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Filter register"
          description="Cari berdasarkan kode atau nama aset. Filter diterapkan API dalam cakupan organisasi Anda."
        />
        <form className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5" onSubmit={handleFilter}>
          <div>
            <label className={labelClass} htmlFor="asset-search">
              Cari
            </label>
            <input
              id="asset-search"
              className={`${inputClass} mt-1`}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              maxLength={120}
              placeholder="DEMO-AST or bridge"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="asset-status-filter">
              Status
            </label>
            <select
              id="asset-status-filter"
              className={`${inputClass} mt-1`}
              value={query.status}
              onChange={(event) =>
                setQuery((current) => ({ ...current, status: event.target.value, page: 1 }))
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="asset-category-filter">
              Kategori
            </label>
            <select
              id="asset-category-filter"
              className={`${inputClass} mt-1`}
              value={query.categoryId}
              onChange={(event) =>
                setQuery((current) => ({ ...current, categoryId: event.target.value, page: 1 }))
              }
            >
              <option value="">Semua kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="asset-location-filter">
              Lokasi
            </label>
            <select
              id="asset-location-filter"
              className={`${inputClass} mt-1`}
              value={query.locationId}
              onChange={(event) =>
                setQuery((current) => ({ ...current, locationId: event.target.value, page: 1 }))
              }
            >
              <option value="">Semua lokasi</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} — {location.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className={primaryButtonClass}>
              Terapkan filter
            </button>
            <button type="button" className={secondaryButtonClass} onClick={resetFilters}>
              Atur ulang
            </button>
          </div>
        </form>
        {optionError ? (
          <p className="px-5 pb-4 text-xs text-warning">{optionError}</p>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Register aset"
          description={
            data ? `${data.total} aset dalam cakupan Anda` : undefined
          }
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

        {loading ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Memuat register aset…
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 px-5 py-8">
            <ShieldX className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink">Register aset tidak tersedia</p>
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
            icon={<MapIcon className="size-5" aria-hidden="true" />}
            title="Tidak ada aset yang cocok"
            description={
              query.search || query.status || query.categoryId || query.locationId
                ? "Hapus atau ubah filter untuk melihat catatan lain dalam cakupan Anda."
                : "Belum ada aset dalam cakupan Anda. Supervisor dan administrator dapat mendaftarkan aset DEMO pertama."
            }
          />
        ) : (
          <>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {data.items.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-secondary">
                          {asset.code}
                        </span>
                        <DemoBadge code={asset.code} />
                      </div>
                      <Link
                        href={`/assets/${asset.id}`}
                        className="mt-1 block truncate text-sm font-semibold text-ink hover:text-primary"
                      >
                        {asset.name}
                      </Link>
                    </div>
                    <AssetStatusChip status={asset.status} />
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <dt className="text-secondary">Kategori</dt>
                      <dd className="mt-0.5 text-ink">{asset.category.name}</dd>
                    </div>
                    <div>
                      <dt className="text-secondary">Lokasi</dt>
                      <dd className="mt-0.5 truncate text-ink">
                        {asset.location ? asset.location.name : "Belum ditetapkan"}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
                    <span className="text-secondary">
                      Diperbarui {formatDateTime(asset.updated_at)}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-secondary">
                      {asset.scope.code}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              onPage={(page) => setQuery((current) => ({ ...current, page }))}
            />
          </>
        )}
      </Card>
    </div>
  );
}
