"use client";

import { useEffect, useMemo, useState } from "react";

export default function PublicSharePage({ params }: { params: { token: string } }) {
  const [password, setPassword] = useState("");
  const [meta, setMeta] = useState<{ name: string; mimeType: string } | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const params2 = new URLSearchParams();
    if (password) params2.set("password", password);
    return `/api/share/${params.token}?${params2.toString()}`;
  }, [params.token, password]);

  async function check() {
    setError(null);
    const res = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (!res) {
      setError("Cannot reach server");
      return;
    }
    if (res.status === 401) {
      setNeedsPassword(true);
      return;
    }
    if (!res.ok) {
      setError(`Error ${res.status}`);
      return;
    }
    const dispo = res.headers.get("content-disposition") || "";
    const m = /filename\*=UTF-8''([^;]+)/.exec(dispo);
    setMeta({
      name: m ? decodeURIComponent(m[1]) : "shared file",
      mimeType: res.headers.get("content-type") || "application/octet-stream",
    });
    setNeedsPassword(false);
  }

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold">Shared file</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {needsPassword ? (
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-sm">This link is password protected.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            onClick={check}
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-white hover:bg-brand-700"
          >
            Unlock
          </button>
        </div>
      ) : meta ? (
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 truncate font-medium">{meta.name}</h2>
          {meta.mimeType.startsWith("image/") && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={url} alt={meta.name} className="mx-auto max-h-[60vh]" />
          )}
          {meta.mimeType.startsWith("video/") && (
            <video src={url} controls className="mx-auto max-h-[60vh]" />
          )}
          {meta.mimeType.startsWith("audio/") && <audio src={url} controls />}
          {meta.mimeType === "application/pdf" && (
            <iframe src={url} className="h-[70vh] w-full bg-white" title={meta.name} />
          )}
          <a
            href={url}
            download={meta.name}
            className="mt-4 inline-block rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
          >
            Download
          </a>
        </div>
      ) : (
        <p>Loading…</p>
      )}
    </main>
  );
}
