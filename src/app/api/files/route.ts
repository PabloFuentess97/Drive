import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { persistUpload, removeObject } from "@/lib/storage";
import { env } from "@/lib/env";
import { safeName } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/files?folderId=...&q=...   -> list files & folders inside a folder
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId") || null;
  const q = searchParams.get("q")?.trim() || "";
  const recent = searchParams.get("recent") === "1";

  const folderFilter = folderId === null ? null : folderId;

  if (recent) {
    const files = await prisma.file.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ files: files.map(serializeFile), folders: [] });
  }

  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: {
        ownerId: user.id,
        parentId: folderFilter,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    }),
    prisma.file.findMany({
      where: {
        ownerId: user.id,
        folderId: folderFilter,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    folders,
    files: files.map(serializeFile),
  });
}

function serializeFile(f: any) {
  return {
    ...f,
    size: f.size.toString(),
  };
}

// POST /api/files  multipart/form-data: file, folderId?
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const folderId = (form.get("folderId") as string | null) || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > env.MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File exceeds max upload size" }, { status: 413 });
  }

  // Quota check (size on the request is reliable for browser uploads).
  const remaining = Number(user.quotaBytes - user.usedBytes);
  if (file.size > remaining) {
    return NextResponse.json({ error: "Storage quota exceeded" }, { status: 413 });
  }

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, ownerId: user.id },
    });
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const fileId = randomUUID().replace(/-/g, "");
  const stored = await persistUpload(user.id, fileId, file.stream(), file.type || "application/octet-stream");

  // Re-check quota with the actual size persisted (in case the client lied).
  if (Number(user.usedBytes) + stored.size > Number(user.quotaBytes)) {
    await removeObject(user.id, stored.storageKey);
    if (stored.thumbnailKey) await removeObject(user.id, stored.thumbnailKey);
    return NextResponse.json({ error: "Storage quota exceeded" }, { status: 413 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const created = await tx.file.create({
      data: {
        id: fileId,
        name: safeName(file.name) || "untitled",
        mimeType: file.type || "application/octet-stream",
        size: BigInt(stored.size),
        storageKey: stored.storageKey,
        checksum: stored.checksum,
        thumbnailKey: stored.thumbnailKey,
        width: stored.width,
        height: stored.height,
        ownerId: user.id,
        folderId,
      },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { usedBytes: { increment: BigInt(stored.size) } },
    });
    return created;
  });

  return NextResponse.json({ file: serializeFile(created) }, { status: 201 });
}
