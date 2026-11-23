"use client";

import { ClipboardCheck, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/form-styles";
import { Card, CardHeader, Chip, EmptyState } from "@/components/ui";
import {
  apiRequest,
  ApiError,
  type ChecklistTemplate,
  type Page,
} from "@/lib/api";
import { INSPECTION_TYPE_LABELS } from "@/lib/domain";

interface ItemDraft {
  code: string;
  label: string;
  is_required: boolean;
}

const emptyItem = (): ItemDraft => ({ code: "", label: "", is_required: true });

export function ChecklistTemplates({ token }: { token: string }) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [inspectionType, setInspectionType] = useState("routine");
  const [isActive, setIsActive] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem(), emptyItem()]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiRequest<Page<ChecklistTemplate>>(
      "/api/v1/master/checklist-templates?page_size=100",
      { token },
    )
      .then((page) => {
        if (!cancelled) {
          setTemplates(page.items);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Tidak dapat memuat template checklist.",
          );
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
  }, [refreshKey, token]);

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((current) =>
      current.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    );
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prepared = items
      .map((item, index) => ({
        code: item.code.trim().toUpperCase(),
        label: item.label.trim(),
        position: index + 1,
        is_required: item.is_required,
      }))
      .filter((item) => item.code || item.label);
    if (!code.trim() || !name.trim() || prepared.length === 0) {
      setError("Kode, nama, dan minimal satu item checklist wajib diisi.");
      return;
    }
    if (prepared.some((item) => !item.code || !item.label)) {
      setError("Setiap item harus memiliki kode dan label.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest<ChecklistTemplate>("/api/v1/master/checklist-templates", {
        method: "POST",
        token,
        body: {
          code: code.trim(),
          name: name.trim(),
          inspection_type: inspectionType,
          is_active: isActive,
          items: prepared,
        },
      });
      setNotice(
        isActive
          ? "Template dibuat dan diaktifkan untuk inspeksi baru pada jenis tersebut."
          : "Template dibuat sebagai draf. Aktifkan agar diterapkan ke inspeksi baru.",
      );
      setCode("");
      setName("");
      setIsActive(false);
      setItems([emptyItem(), emptyItem()]);
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Tidak dapat membuat template checklist.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleTemplate(template: ChecklistTemplate) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest<ChecklistTemplate>(
        `/api/v1/master/checklist-templates/${template.id}`,
        {
          method: "PATCH",
          token,
          body: { is_active: !template.is_active },
        },
      );
      setNotice(
        template.is_active
          ? "Template dinonaktifkan. Inspeksi baru tidak lagi memakai template ini."
          : "Template diaktifkan. Template aktif lain pada jenis yang sama dinonaktifkan.",
      );
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Tidak dapat memperbarui template.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-success/20 bg-success-soft px-3 py-2 text-xs text-ink"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
        >
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader
          title="Template checklist inspeksi"
          description="Satu template aktif per jenis inspeksi. Inspeksi baru menerima salinan item saat dibuat, sehingga perubahan template tidak mengubah catatan lama."
        />
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Memuat template…
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="size-5" aria-hidden="true" />}
            title="Belum ada template checklist"
            description="Buat template di bawah ini agar inspeksi baru memiliki daftar periksa sesuai SOP yang disetujui."
          />
        ) : (
          <ul className="divide-y divide-border">
            {templates.map((template) => (
              <li key={template.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{template.name}</p>
                      <Chip tone={template.is_active ? "success" : "neutral"}>
                        {template.is_active ? "Aktif" : "Nonaktif"}
                      </Chip>
                    </div>
                    <p className="mt-1 text-xs text-secondary">
                      <span className="font-mono">{template.code}</span> ·{" "}
                      {INSPECTION_TYPE_LABELS[template.inspection_type] ??
                        template.inspection_type}{" "}
                      · versi {template.version} · {template.items.length} item
                    </p>
                  </div>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => void toggleTemplate(template)}
                    disabled={saving}
                  >
                    {template.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </div>
                <ol className="mt-3 space-y-1.5">
                  {template.items.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 text-xs text-secondary">
                      <span className="mt-0.5 font-mono text-[10px] text-primary">
                        {item.position.toString().padStart(2, "0")}
                      </span>
                      <span className="text-ink">{item.label}</span>
                      <span className="font-mono text-[10px]">
                        {item.code}
                        {item.is_required ? " · wajib" : " · opsional"}
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Buat template baru"
          description="Item checklist ditulis sesuai SOP KCIC setelah disetujui; data sintetis ini bukan SOP resmi."
        />
        <form className="grid gap-4 p-5" onSubmit={createTemplate} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="checklist-code">
                Kode template
              </label>
              <input
                id="checklist-code"
                className={`${inputClass} mt-1.5 font-mono`}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="ROUTINE-V1"
                maxLength={48}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="checklist-name">
                Nama template
              </label>
              <input
                id="checklist-name"
                className={`${inputClass} mt-1.5`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Checklist jalur rutin (SINTETIS)"
                maxLength={160}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="checklist-type">
                Jenis inspeksi
              </label>
              <select
                id="checklist-type"
                className={`${inputClass} mt-1.5`}
                value={inspectionType}
                onChange={(event) => setInspectionType(event.target.value)}
              >
                {Object.entries(INSPECTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <label className="mt-6 flex items-start gap-2 text-xs text-ink">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span>
                Aktifkan segera
                <span className="block text-[11px] text-secondary">
                  Template aktif lain pada jenis yang sama akan dinonaktifkan.
                </span>
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className={labelClass}>Item checklist</p>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setItems((current) => [...current, emptyItem()])}
                disabled={saving || items.length >= 100}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Tambah item
              </button>
            </div>
            {items.map((item, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border border-border bg-canvas p-3 sm:grid-cols-[140px_minmax(0,1fr)_auto_auto]"
              >
                <input
                  aria-label={`Kode item ${index + 1}`}
                  className={`${inputClass} font-mono`}
                  value={item.code}
                  onChange={(event) => updateItem(index, { code: event.target.value })}
                  placeholder="SURFACE"
                  maxLength={48}
                />
                <input
                  aria-label={`Label item ${index + 1}`}
                  className={inputClass}
                  value={item.label}
                  onChange={(event) => updateItem(index, { label: event.target.value })}
                  placeholder="Permukaan jalur bebas dari retak terbuka (SINTETIS)"
                  maxLength={200}
                />
                <label className="flex items-center gap-1.5 text-[11px] text-secondary">
                  <input
                    type="checkbox"
                    checked={item.is_required}
                    onChange={(event) =>
                      updateItem(index, { is_required: event.target.checked })
                    }
                  />
                  Wajib
                </label>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() =>
                    setItems((current) =>
                      current.length === 1
                        ? current
                        : current.filter((_, position) => position !== index),
                    )
                  }
                  disabled={saving || items.length === 1}
                  aria-label={`Hapus item ${index + 1}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button type="submit" className={primaryButtonClass} disabled={saving}>
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-3.5" aria-hidden="true" />
              )}
              {saving ? "Menyimpan…" : "Simpan template"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
