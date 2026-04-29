"use client";

import { useState } from "react";

export function ShareDialog({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [expiresInHours, setExpiresInHours] = useState<number | "">("");
  const [maxDownloads, setMaxDownloads] = useState<number | "">("");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileId,
          password: password || undefined,
          expiresInHours: typeof expiresInHours === "number" ? expiresInHours : undefined,
          maxDownloads: typeof maxDownloads === "number" ? maxDownloads : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear el enlace");
      setLink(`${window.location.origin}/share/${data.share.token}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Compartir archivo</h2>
        {!link ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Contraseña (opcional)</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Déjalo vacío para no usar contraseña"
                className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Expira en (h)</label>
                <input
                  type="number"
                  min={1}
                  value={expiresInHours}
                  onChange={(e) =>
                    setExpiresInHours(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Descargas máx.</label>
                <input
                  type="number"
                  min={1}
                  value={maxDownloads}
                  onChange={(e) =>
                    setMaxDownloads(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="rounded-md px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button
                onClick={create}
                disabled={loading}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? "Creando…" : "Crear enlace"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Comparte este enlace con quien quieras:
            </p>
            <input
              readOnly
              value={link}
              className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(link)}
                className="rounded-md bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300 dark:bg-slate-700"
              >
                Copiar
              </button>
              <button
                onClick={onClose}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Listo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
