import { fileKindFromMime } from "@/lib/utils";

const map: Record<string, string> = {
  image: "🖼️",
  video: "🎬",
  audio: "🎵",
  pdf: "📕",
  text: "📄",
  file: "📦",
};

export function FileIcon({ mime, className }: { mime: string; className?: string }) {
  const kind = fileKindFromMime(mime);
  return <span className={className}>{map[kind] || map.file}</span>;
}
