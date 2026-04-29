import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { persistUpload, removeObject } from "@/lib/storage";
import { env } from "@/lib/env";
import { safeName } from "@/lib/utils";
import { isVaultUnlocked, requireVaultUnlocked } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/files?folderId=...&q=...&secure=1   -> lista archivos y carpetas
//
// secure=1 → operamos dentro de la carpeta segura (requiere desbloqueo).
// secure=0 (por defecto) → sólo elementos NO seguros.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId") || null;
  const q = searchParams.get("q")?.trim() || "";
  const recent = searchParams.get("recent") === "1";
  const secure = searchParams.get("secure") === "1";

  if (secure) await requireVaultUnlocked(user.id);

  if (recent) {
    // Los recientes nunca incluyen ficheros seguros (no queremos
    // enseñarlos en el panel general).
    const files = await prisma.file.findMany({
      where: { ownerId: user.id, isSecure: false },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ files: files.map(serializeFile), folders: [] });
  }

  // Si nos piden listar dentro de una carpeta, validamos que pertenece
  // al usuario y que el flag isSecure encaja con el modo solicitado.
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, ownerId: user.id },
    });
    if (!folder) return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
    if (folder.isSecure !== secure) {
      return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
    }
  }

  const folderFilter = folderId === null ? null : folderId;

  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: {
        ownerId: user.id,
        parentId: folderFilter,
        isSecure: secure,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    }),
    prisma.file.findMany({
      where: {
        ownerId: user.id,
        folderId: folderFilter,
        isSecure: secure,
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

// POST /api/files  multipart/form-data: file, folderId?, secure?
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const folderId = (form.get("folderId") as string | null) || null;
  const secureFlag = form.get("secure") === "1";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se ha proporcionado ningún archivo" }, { status: 400 });
  }

  if (file.size > env.MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "El archivo supera el tamaño máximo permitido" }, { status: 413 });
  }

  const remaining = Number(user.quotaBytes - user.usedBytes);
  if (file.size > remaining) {
    return NextResponse.json({ error: "Has superado tu cuota de almacenamiento" }, { status: 413 });
  }

  // Determinamos isSecure final: si la carpeta padre es segura, hereda.
  // Si no hay carpeta padre, usa el flag enviado.
  let willBeSecure = secureFlag;
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, ownerId: user.id },
    });
    if (!folder) return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
    willBeSecure = folder.isSecure;
  }
  if (willBeSecure) await requireVaultUnlocked(user.id);

  const fileId = randomUUID().replace(/-/g, "");
  const stored = await persistUpload(user.id, fileId, file.stream(), file.type || "application/octet-stream");

  if (Number(user.usedBytes) + stored.size > Number(user.quotaBytes)) {
    await removeObject(user.id, stored.storageKey);
    if (stored.thumbnailKey) await removeObject(user.id, stored.thumbnailKey);
    return NextResponse.json({ error: "Has superado tu cuota de almacenamiento" }, { status: 413 });
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
        isSecure: willBeSecure,
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
