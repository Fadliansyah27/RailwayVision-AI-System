"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/admin/form-styles";
import { Card, CardHeader } from "@/components/ui";
import { apiRequest, ApiError, type ScopeInfo } from "@/lib/api";

export function ScopeManagement({
  token,
  scopes,
  onScopesChange,
}: {
  token: string;
  scopes: ScopeInfo[];
  onScopesChange: (scopes: ScopeInfo[]) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCode, setSavedCode] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSavedCode(null);
    try {
      const created = await apiRequest<ScopeInfo>("/api/v1/scopes", {
        method: "POST",
        token,
        body: {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          parent_id: parentId || undefined,
        },
      });
      onScopesChange([...scopes, created].sort((a, b) => a.path.localeCompare(b.path)));
      setSavedCode(created.code);
      setCode("");
      setName("");
      setParentId("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Tidak dapat membuat cakupan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader
          title="Cakupan organisasi"
          description="Batas visibilitas hierarkis. Pengguna hanya dapat menjangkau catatan pada atau di bawah jalur cakupannya."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Kode
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Nama
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Jalur
                </th>
              </tr>
            </thead>
            <tbody>
              {scopes.map((scope) => (
                <tr key={scope.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-ink">{scope.code}</td>
                  <td className="px-5 py-3 text-ink">{scope.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-secondary">{scope.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Buat cakupan" description="Tambahkan batas organisasi sintetis." />
        <form className="space-y-3 p-5" onSubmit={handleSubmit}>
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-critical/20 bg-critical-soft px-3 py-2 text-xs text-ink"
            >
              {error}
            </p>
          ) : null}
          {savedCode ? (
            <p
              role="status"
              className="rounded-lg border border-success/20 bg-success-soft px-3 py-2 text-xs text-ink"
            >
              Cakupan {savedCode} dibuat.
            </p>
          ) : null}
          <div>
            <label htmlFor="scope-code" className={labelClass}>
              Kode
            </label>
            <input
              id="scope-code"
              required
              minLength={2}
              maxLength={64}
              pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="SINTETIS-EAST"
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <label htmlFor="scope-name" className={labelClass}>
              Nama
            </label>
            <input
              id="scope-name"
              required
              minLength={2}
              maxLength={160}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="SINTETIS — Koridor timur"
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <label htmlFor="scope-parent" className={labelClass}>
              Cakupan induk
            </label>
            <select
              id="scope-parent"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className={`mt-1.5 ${inputClass}`}
            >
              <option value="">Tidak ada (tingkat teratas)</option>
              {scopes.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving || !code || !name}
            className={`w-full ${primaryButtonClass}`}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-3.5" aria-hidden="true" />
            )}
            Buat cakupan
          </button>
        </form>
      </Card>
    </div>
  );
}
