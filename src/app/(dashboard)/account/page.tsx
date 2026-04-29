"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/utils";
import { offlineDb } from "@/lib/offline-db";
import { VaultManager } from "@/components/VaultManager";

interface Stats {
  quotaBytes: string;
  usedBytes: string;
  fileCount: number;
  folderCount: number;
  recent: { id: string; name: string; size: string; updatedAt: string }[];
}

export default function AccountPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [me, setMe] = useState<any>(null);
  const [cachedCount, setCachedCount] = useState(0);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats);
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user));
    offlineDb.listFiles().then((f) => setCachedCount(f.length));
  }, []);

  if (!stats || !me) return <div className="p-6">Cargando…</div>;

  const used = Number(stats.usedBytes);
  const quota = Number(stats.quotaBytes);
  const pct = Math.round((used / quota) * 100);

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-6 text-2xl font-bold">Tu cuenta</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-lg font-semibold">Perfil</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{me.name || "—"}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{me.email}</p>
          <p className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
            {me.role === "ADMIN" ? "Administrador" : "Usuario"}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-lg font-semibold">Almacenamiento</h2>
          <div className="mb-3 text-sm">
            <strong>{formatBytes(used)}</strong> de <strong>{formatBytes(quota)}</strong> usados (
            {pct}%)
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-300">
            <li>{stats.fileCount} archivos</li>
            <li>{stats.folderCount} carpetas</li>
            <li>{cachedCount} guardados sin conexión</li>
          </ul>
        </section>
      </div>

      <div className="mt-6">
        <VaultManager />
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold">Actividad reciente</h2>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {stats.recent.map((f) => (
            <li key={f.id} className="flex justify-between py-2 text-sm">
              <span>{f.name}</span>
              <span className="text-slate-500">{formatBytes(Number(f.size))}</span>
            </li>
          ))}
          {stats.recent.length === 0 && (
            <li className="py-2 text-sm text-slate-500">Sin actividad por ahora</li>
          )}
        </ul>
      </section>
    </div>
  );
}
