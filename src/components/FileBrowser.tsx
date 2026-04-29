"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatBytes, formatDate, cn } from "@/lib/utils";
import { FileIcon } from "./FileIcon";
import { FilePreview } from "./FilePreview";
import { ShareDialog } from "./ShareDialog";
import { offlineDb, syncQueuedUploads } from "@/lib/offline-db";

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}
interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  thumbnailKey: string | null;
  folderId: string | null;
  updatedAt: string;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface FileBrowserProps {
  folderId: string | null;
  /** Modo carpeta segura: añade ?secure=1 en las llamadas y cambia la navegación. */
  secure?: boolean;
  /** Etiqueta del breadcrumb raíz (por defecto "Mi unidad"). */
  rootName?: string;
  /** Prefijo de URL al navegar a una carpeta. */
  routePrefix?: string;
  /** Si está definido, muestra un botón "Bloquear" en la barra superior. */
  onLock?: () => void;
}

export function FileBrowser({
  folderId,
  secure = false,
  rootName = "Mi unidad",
  routePrefix = "/drive",
  onLock,
}: FileBrowserProps) {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: rootName }]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<FileItem | null>(null);
  const [sharing, setSharing] = useState<FileItem | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([]);

  const folderHref = (id: string | null) => (id ? `${routePrefix}/${id}` : routePrefix);

  const load = useCallback(
    async (q?: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (folderId) params.set("folderId", folderId);
      if (q) params.set("q", q);
      if (secure) params.set("secure", "1");
      try {
        const res = await fetch(`/api/files?${params.toString()}`);
        if (res.status === 423) {
          onLock?.();
          return;
        }
        const data = await res.json();
        setFolders(data.folders || []);
        setFiles(data.files || []);
      } catch {
        // Sin conexión: mostramos las subidas en cola como elementos fantasma.
        const queued = await offlineDb.listQueued();
        setFiles(
          queued
            .filter((q) => q.folderId === folderId)
            .map((q) => ({
              id: q.id,
              name: q.name + " (pendiente)",
              mimeType: q.blob.type,
              size: q.blob.size.toString(),
              thumbnailKey: null,
              folderId: q.folderId,
              updatedAt: new Date(q.createdAt).toISOString(),
            })),
        );
      } finally {
        setLoading(false);
      }

      if (folderId) {
        const r = await fetch(`/api/folders/${folderId}`);
        if (r.status === 423) {
          onLock?.();
        } else if (r.ok) {
          const d = await r.json();
          setBreadcrumb([{ id: null, name: rootName }, ...d.breadcrumb]);
        }
      } else {
        setBreadcrumb([{ id: null, name: rootName }]);
      }
    },
    [folderId, secure, rootName, onLock],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Reproduce las subidas pendientes cuando vuelve la conexión.
  useEffect(() => {
    function onOnline() {
      syncQueuedUploads().then((n) => {
        if (n > 0) load();
      });
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [load]);

  async function uploadOne(file: File) {
    setUploading((p) => [...p, { name: file.name, progress: 0 }]);

    const form = new FormData();
    form.append("file", file);
    if (folderId) form.append("folderId", folderId);
    if (secure) form.append("secure", "1");

    if (!navigator.onLine) {
      await offlineDb.queueUpload({
        id: crypto.randomUUID(),
        folderId,
        name: file.name,
        blob: file,
        createdAt: Date.now(),
      });
      setUploading((p) => p.filter((u) => u.name !== file.name));
      load();
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/files");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploading((p) =>
              p.map((u) => (u.name === file.name ? { ...u, progress: pct } : u)),
            );
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText)));
        xhr.onerror = () => reject(new Error("Error de red"));
        xhr.send(form);
      });
    } catch (e: any) {
      alert(`La subida ha fallado: ${e.message}`);
    } finally {
      setUploading((p) => p.filter((u) => u.name !== file.name));
      load();
    }
  }

  async function uploadFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    for (const f of arr) await uploadOne(f);
  }

  async function newFolder() {
    const name = prompt("Nombre de la carpeta");
    if (!name) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, parentId: folderId, secure }),
    });
    if (res.status === 423) {
      onLock?.();
      return;
    }
    if (res.ok) load();
    else {
      const d = await res.json();
      alert(d.error || "Error");
    }
  }

  async function renameFile(f: FileItem) {
    const name = prompt("Nuevo nombre", f.name);
    if (!name || name === f.name) return;
    const res = await fetch(`/api/files/${f.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) load();
  }

  async function deleteFile(f: FileItem) {
    if (!confirm(`¿Eliminar ${f.name}?`)) return;
    await fetch(`/api/files/${f.id}`, { method: "DELETE" });
    load();
  }

  async function renameFolder(folder: Folder) {
    const name = prompt("Nuevo nombre", folder.name);
    if (!name || name === folder.name) return;
    await fetch(`/api/folders/${folder.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    load();
  }

  async function deleteFolder(folder: Folder) {
    if (!confirm(`¿Eliminar "${folder.name}" y todo su contenido?`)) return;
    await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
    load();
  }

  async function pinOffline(f: FileItem) {
    const res = await fetch(`/api/files/${f.id}/download?disposition=inline`);
    const blob = await res.blob();
    await offlineDb.saveFile({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: Number(f.size),
      blob,
      cachedAt: Date.now(),
    });
    alert("Archivo guardado para acceso sin conexión");
  }

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
      }}
    >
      <div className={cn("drop-overlay", dragActive && "active")}>
        <div className="rounded-2xl bg-white p-8 text-xl font-semibold shadow-2xl dark:bg-slate-900">
          Suelta los archivos para subirlos
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div className="flex flex-1 items-center gap-2">
          {breadcrumb.map((b, i) => (
            <div key={`${b.id}-${i}`} className="flex items-center gap-2 text-sm">
              {i > 0 && <span className="text-slate-400">/</span>}
              <button
                onClick={() => router.push(folderHref(b.id))}
                className={cn(
                  "rounded-md px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800",
                  i === breadcrumb.length - 1 && "font-semibold",
                )}
              >
                {b.name}
              </button>
            </div>
          ))}
        </div>
        <input
          type="search"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            load(e.target.value);
          }}
          className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          onClick={newFolder}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          + Carpeta
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Subir
        </button>
        {onLock && (
          <button
            onClick={onLock}
            className="rounded-md border border-amber-500 px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            title="Bloquear la carpeta segura"
          >
            🔒 Bloquear
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {uploading.length > 0 && (
        <div className="border-b border-slate-200 px-6 py-3 dark:border-slate-800">
          {uploading.map((u) => (
            <div key={u.name} className="mb-1 text-xs">
              <div className="flex justify-between">
                <span className="truncate">{u.name}</span>
                <span>{u.progress}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full bg-brand-500" style={{ width: `${u.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <p className="text-slate-500">Cargando…</p>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
            <span className="text-6xl">📂</span>
            <p className="mt-4 text-lg">Esta carpeta está vacía</p>
            <p className="text-sm">Arrastra y suelta archivos o usa el botón Subir.</p>
          </div>
        ) : (
          <>
            {folders.length > 0 && (
              <>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Carpetas
                </h3>
                <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {folders.map((f) => (
                    <div
                      key={f.id}
                      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-3 hover:border-brand-400 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <button
                        onClick={() => router.push(folderHref(f.id))}
                        className="flex flex-col items-center gap-2 text-left"
                      >
                        <span className="text-3xl">📁</span>
                        <span className="line-clamp-2 w-full text-center text-sm font-medium">
                          {f.name}
                        </span>
                      </button>
                      <div className="mt-2 flex justify-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => renameFolder(f)}
                          className="rounded px-2 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Renombrar
                        </button>
                        <button
                          onClick={() => deleteFolder(f)}
                          className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {files.length > 0 && (
              <>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Archivos
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-brand-400 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <button
                        onClick={() => setPreview(f)}
                        className="aspect-square w-full"
                      >
                        {f.thumbnailKey ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`/api/files/${f.id}/download?thumb=1&disposition=inline`}
                            alt={f.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-5xl dark:bg-slate-800">
                            <FileIcon mime={f.mimeType} />
                          </div>
                        )}
                      </button>
                      <div className="flex flex-col gap-1 p-2 text-xs">
                        <div className="line-clamp-1 font-medium" title={f.name}>
                          {f.name}
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>{formatBytes(Number(f.size))}</span>
                          <span>{formatDate(f.updatedAt)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1 opacity-0 group-hover:opacity-100">
                          {!secure && (
                            <button onClick={() => setSharing(f)} className="rounded px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                              Compartir
                            </button>
                          )}
                          <button onClick={() => renameFile(f)} className="rounded px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                            Renombrar
                          </button>
                          {!secure && (
                            <button onClick={() => pinOffline(f)} className="rounded px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                              Sin conexión
                            </button>
                          )}
                          <button onClick={() => deleteFile(f)} className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
      {sharing && <ShareDialog fileId={sharing.id} onClose={() => setSharing(null)} />}
    </div>
  );
}
