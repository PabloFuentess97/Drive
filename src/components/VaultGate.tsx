"use client";

import { useEffect, useState, useCallback } from "react";

type Status = { enabled: boolean; unlocked: boolean } | null;

export function VaultGate({
  children,
}: {
  /** Función que recibe (status, refresh) y renderiza el contenido cuando
   *  la carpeta segura está desbloqueada. */
  children: (api: { lock: () => Promise<void>; refresh: () => void }) => React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Estado de los formularios.
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const refresh = useCallback(() => {
    fetch("/api/vault/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, unlocked: false }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function lock() {
    await fetch("/api/vault/lock", { method: "POST" });
    setStatus((s) => (s ? { ...s, unlocked: false } : s));
  }

  async function setup() {
    setError(null);
    if (password !== confirm) return setError("Las contraseñas no coinciden");
    if (password.length < 6) return setError("Mínimo 6 caracteres");
    setBusy(true);
    try {
      const r = await fetch("/api/vault/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      // Tras configurarla, la desbloqueamos automáticamente.
      await fetch("/api/vault/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setConfirm("");
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/vault/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Contraseña incorrecta");
      setPassword("");
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (status === null) {
    return <div className="p-6 text-slate-500">Cargando…</div>;
  }

  if (status.unlocked) {
    return <>{children({ lock, refresh })}</>;
  }

  // Pantalla central: configurar (si no existe) o desbloquear.
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-3xl dark:bg-amber-900/40">
          🔒
        </div>
        <h1 className="text-2xl font-bold">
          {status.enabled ? "Carpeta segura bloqueada" : "Configura la carpeta segura"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {status.enabled
            ? "Introduce tu contraseña para acceder a tus archivos protegidos."
            : "Crea una contraseña adicional para los archivos que quieras proteger. Es independiente de la de tu cuenta."}
        </p>

        <div className="mt-6 space-y-3 text-left">
          <div>
            <label className="mb-1 block text-sm font-medium">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              autoFocus
            />
          </div>
          {!status.enabled && (
            <div>
              <label className="mb-1 block text-sm font-medium">Confirmar contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={status.enabled ? unlock : setup}
            disabled={busy || !password}
            className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Procesando…" : status.enabled ? "Desbloquear" : "Crear y entrar"}
          </button>
          {!status.enabled && (
            <p className="text-xs text-slate-500">
              ⚠️ Si olvidas esta contraseña, los archivos seguirán existiendo
              pero no podrás acceder a ellos sin desactivar antes la carpeta
              segura desde tu cuenta.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
