"use client";

import { useEffect } from "react";

interface FileLite {
  id: string;
  name: string;
  mimeType: string;
}

export function FilePreview({ file, onClose }: { file: FileLite; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const url = `/api/files/${file.id}/download?disposition=inline`;

  let body: React.ReactNode;
  if (file.mimeType.startsWith("image/")) {
    /* eslint-disable-next-line @next/next/no-img-element */
    body = <img src={url} alt={file.name} className="max-h-[80vh] max-w-full rounded-lg" />;
  } else if (file.mimeType.startsWith("video/")) {
    body = <video src={url} controls className="max-h-[80vh] max-w-full rounded-lg" />;
  } else if (file.mimeType.startsWith("audio/")) {
    body = <audio src={url} controls className="w-full" />;
  } else if (file.mimeType === "application/pdf") {
    body = <iframe src={url} className="h-[80vh] w-full rounded-lg bg-white" title={file.name} />;
  } else {
    body = (
      <a href={url} download={file.name} className="rounded-md bg-brand-600 px-4 py-2 text-white">
        Download {file.name}
      </a>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl rounded-2xl bg-slate-900 p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="truncate text-lg font-medium">{file.name}</h2>
          <div className="flex items-center gap-2">
            <a
              href={`/api/files/${file.id}/download?disposition=attachment`}
              className="rounded-md bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
            >
              Download
            </a>
            <button
              onClick={onClose}
              className="rounded-md bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex justify-center">{body}</div>
      </div>
    </div>
  );
}
