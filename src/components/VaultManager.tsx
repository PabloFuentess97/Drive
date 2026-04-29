"use client";

import { useEffect, useState } from "react";

type Status = { enabled: boolean; unlocked: boolean };

export function VaultManager() {
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState<"idle" | "change" | "disable">("idle");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    fetch("/api/vault/status")
      .then((r) => r.json())
      .then(setStatus);
  }
  useEffect(refresh, []);

  function reset() {
    setMode("idle");
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  }

  async function changePassword() {
    setError(null);
    if (next !== confirm) return setError("Las contraseñas nuevas no coinciden");
    if (next.length < 6) return setError("La nueva contraseña debe tener al menos 6 caracteres");
    setBusy(true);
    try {
      const r = await fetch("/api/vault/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: next, currentPassword: current }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      setInfo("Contraseña actualizada");
      reset();
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function disableVault() {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/vault/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: current }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      setInfo("Carpeta segura desactivada. Tus archivos siguen ahí, pero ahora son accesibles sin contraseña.");
      reset();
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-2 text-lg font-semibold">🔒 Carpeta segura</h2>
      {info && (
        <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          {info}
        </div>
      )}

      {!status.enabled ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          La carpeta segura no está configurada. Ve a{" "}
          <a href="/secure" className="text-brand-600 hover:underline">
            Carpeta segura
          </a>{" "}
          en el menú lateral para crearla.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tu carpeta segura está activa. Necesitas tu contraseña adicional
            para acceder a los archivos protegidos.
          </p>

          {mode === "idle" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setMode("change")}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Cambiar contraseña
              </button>
              <button
                onClick={() => setMode("disable")}
                className="rounded-md border border-red-400 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Desactivar carpeta segura
              </button>
            </div>
          )}

          {mode === "change" && (
            <div className="mt-4 space-y-3">
              <input
                type="password"
                placeholder="Contraseña actual"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="password"
                placeholder="Nueva contraseña"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="password"
                placeholder="Repite la nueva contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={changePassword}
                  disabled={busy}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Guardar
                </button>
                <button onClick={reset} className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {mode === "disable" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Al desactivar la carpeta segura, los archivos que tenías protegidos
                seguirán existiendo pero ya no requerirán la contraseña adicional.
              </p>
              <input
                type="password"
                placeholder="Contraseña de la carpeta segura"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={disableVault}
                  disabled={busy || !current}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Desactivar
                </button>
                <button onClick={reset} className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
