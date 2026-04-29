"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

interface ShareItem {
  id: string;
  token: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloads: number;
  createdAt: string;
  passwordHash: string | null;
  file: { id: string; name: string; mimeType: string };
}

export default function SharedPage() {
  const [shares, setShares] = useState<ShareItem[]>([]);

  async function load() {
    const res = await fetch("/api/share");
    const d = await res.json();
    setShares(d.shares || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function revoke(token: string) {
    if (!confirm("¿Revocar este enlace?")) return;
    await fetch(`/api/share/${token}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-6 text-2xl font-bold">Enlaces compartidos</h1>
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {shares.map((s) => {
          const url = `${window.location.origin}/share/${s.token}`;
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex-1">
                <div className="font-medium">{s.file.name}</div>
                <div className="text-xs text-slate-500">
                  Creado {formatDate(s.createdAt)} ·{" "}
                  {s.expiresAt ? `expira ${formatDate(s.expiresAt)}` : "no expira"} ·{" "}
                  {s.downloads} descarga(s)
                  {s.passwordHash ? " · protegido con contraseña" : ""}
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs text-brand-600 hover:underline"
                >
                  {url}
                </a>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(url)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Copiar enlace
              </button>
              <button
                onClick={() => revoke(s.token)}
                className="rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-200"
              >
                Revocar
              </button>
            </li>
          );
        })}
        {shares.length === 0 && (
          <li className="p-6 text-center text-sm text-slate-500">No tienes enlaces activos.</li>
        )}
      </ul>
    </div>
  );
}
