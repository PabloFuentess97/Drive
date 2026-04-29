"use client";

import { useEffect, useState } from "react";
import { FileIcon } from "@/components/FileIcon";
import { FilePreview } from "@/components/FilePreview";
import { formatBytes, formatDate } from "@/lib/utils";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  thumbnailKey: string | null;
  updatedAt: string;
}

export default function RecentPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [preview, setPreview] = useState<FileItem | null>(null);

  useEffect(() => {
    fetch("/api/files?recent=1")
      .then((r) => r.json())
      .then((d) => setFiles(d.files || []));
  }, []);

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-6 text-2xl font-bold">Recent files</h1>
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {files.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => setPreview(f)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <FileIcon mime={f.mimeType} className="text-2xl" />
              <div className="flex-1">
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-slate-500">
                  {formatBytes(Number(f.size))} · {formatDate(f.updatedAt)}
                </div>
              </div>
            </button>
          </li>
        ))}
        {files.length === 0 && (
          <li className="p-6 text-center text-sm text-slate-500">No files yet</li>
        )}
      </ul>
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
