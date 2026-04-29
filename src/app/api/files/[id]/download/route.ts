import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFileStream, statObject } from "@/lib/storage";
import { requireVaultUnlocked } from "@/lib/vault";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/files/[id]/download?thumb=1&disposition=attachment|inline
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const useThumb = url.searchParams.get("thumb") === "1";
  const disposition = url.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";

  const file = await prisma.file.findFirst({ where: { id: params.id, ownerId: user.id } });
  if (!file) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (file.isSecure) await requireVaultUnlocked(user.id);

  const key = useThumb && file.thumbnailKey ? file.thumbnailKey : file.storageKey;
  const mime = useThumb && file.thumbnailKey ? "image/webp" : file.mimeType;

  const stat = await statObject(user.id, key);
  const total = stat.size;
  const range = req.headers.get("range");

  const filename = encodeURIComponent(file.name);
  const baseHeaders: Record<string, string> = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, must-revalidate",
    "Content-Disposition": `${disposition}; filename*=UTF-8''${filename}`,
  };

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : total - 1;
      if (start >= total || end >= total) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      const chunkSize = end - start + 1;
      const stream = readFileStream(user.id, key, { start, end });
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": chunkSize.toString(),
        },
      });
    }
  }

  const stream = readFileStream(user.id, key);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": total.toString() },
  });
}
