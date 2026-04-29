import { NextResponse } from "next/server";
import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { readFileStream, statObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/share/[token]?password=... -> stream the shared file
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const url = new URL(req.url);
  const password = url.searchParams.get("password") || "";

  const share = await prisma.share.findUnique({
    where: { token: params.token },
    include: { file: true },
  });
  if (!share) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: "El enlace ha caducado" }, { status: 410 });
  }
  if (share.maxDownloads && share.downloads >= share.maxDownloads) {
    return NextResponse.json({ error: "Límite de descargas alcanzado" }, { status: 410 });
  }
  if (share.passwordHash) {
    if (!password || !(await verifyPassword(password, share.passwordHash))) {
      return NextResponse.json({ error: "Contraseña requerida" }, { status: 401 });
    }
  }

  const stat = await statObject(share.file.ownerId, share.file.storageKey);
  const total = stat.size;
  const range = req.headers.get("range");
  const filename = encodeURIComponent(share.file.name);
  const baseHeaders: Record<string, string> = {
    "Content-Type": share.file.mimeType,
    "Accept-Ranges": "bytes",
    "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
  };

  // Increment download counter (best-effort, only on GET).
  if (req.method === "GET") {
    prisma.share.update({ where: { id: share.id }, data: { downloads: { increment: 1 } } }).catch(() => {});
  }

  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : total - 1;
      const stream = readFileStream(share.file.ownerId, share.file.storageKey, { start, end });
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": (end - start + 1).toString(),
        },
      });
    }
  }

  const stream = readFileStream(share.file.ownerId, share.file.storageKey);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: { ...baseHeaders, "Content-Length": total.toString() },
  });
}

// DELETE /api/share/[token] -> revoke
export async function DELETE(_req: Request, { params }: { params: { token: string } }) {
  const share = await prisma.share.findUnique({ where: { token: params.token } });
  if (!share) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await prisma.share.delete({ where: { id: share.id } });
  return NextResponse.json({ ok: true });
}
