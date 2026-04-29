"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/utils";

interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    quotaBytes: string;
    usedBytes: string;
  } | null;
}

export function Header() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse["user"]>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: MeResponse) => setMe(d.user))
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const used = me ? Number(me.usedBytes) : 0;
  const quota = me ? Number(me.quotaBytes) : 1;
  const pct = Math.min(100, Math.round((used / quota) * 100));

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="text-sm text-slate-500">
        {me ? (
          <span>
            Conectado como <strong>{me.name || me.email}</strong>
          </span>
        ) : (
          "…"
        )}
      </div>
      <div className="flex items-center gap-4">
        {me && (
          <div className="hidden w-48 sm:block">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>{formatBytes(used)}</span>
              <span>{formatBytes(quota)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
