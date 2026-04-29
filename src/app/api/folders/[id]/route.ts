import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeObject } from "@/lib/storage";
import { safeName } from "@/lib/utils";
import { requireVaultUnlocked } from "@/lib/vault";

export const runtime = "nodejs";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  parentId: z.string().nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const folder = await prisma.folder.findFirst({
    where: { id: params.id, ownerId: user.id },
  });
  if (!folder) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (folder.isSecure) await requireVaultUnlocked(user.id);

  const trail: { id: string; name: string }[] = [];
  let current: { id: string; name: string; parentId: string | null } | null = folder;
  while (current) {
    trail.unshift({ id: current.id, name: current.name });
    current = current.parentId
      ? await prisma.folder.findFirst({
          where: { id: current.parentId, ownerId: user.id },
          select: { id: true, name: true, parentId: true },
        })
      : null;
  }

  return NextResponse.json({ folder, breadcrumb: trail });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const folder = await prisma.folder.findFirst({ where: { id: params.id, ownerId: user.id } });
  if (!folder) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (folder.isSecure) await requireVaultUnlocked(user.id);

  const data = Patch.parse(await req.json());

  if (data.parentId === folder.id) {
    return NextResponse.json({ error: "Una carpeta no puede ser su propia carpeta padre" }, { status: 400 });
  }
  if (data.parentId) {
    const parent = await prisma.folder.findFirst({ where: { id: data.parentId, ownerId: user.id } });
    if (!parent) return NextResponse.json({ error: "Carpeta padre no encontrada" }, { status: 404 });
    if (parent.isSecure !== folder.isSecure) {
      return NextResponse.json(
        { error: "No puedes mover carpetas entre la carpeta segura y el resto" },
        { status: 400 },
      );
    }
    let cur: typeof parent | null = parent;
    while (cur) {
      if (cur.parentId === folder.id) {
        return NextResponse.json({ error: "No puedes mover una carpeta dentro de una de sus subcarpetas" }, { status: 400 });
      }
      cur = cur.parentId
        ? await prisma.folder.findFirst({ where: { id: cur.parentId, ownerId: user.id } })
        : null;
    }
  }

  const updated = await prisma.folder.update({
    where: { id: folder.id },
    data: {
      ...(data.name ? { name: safeName(data.name) } : {}),
      ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
    },
  });
  return NextResponse.json({ folder: updated });
}

// Borrado recursivo: elimina archivos hijos (con sus blobs) y carpetas.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const folder = await prisma.folder.findFirst({ where: { id: params.id, ownerId: user.id } });
  if (!folder) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (folder.isSecure) await requireVaultUnlocked(user.id);

  const folderIds = await collectDescendants(folder.id, user.id);
  folderIds.push(folder.id);

  const files = await prisma.file.findMany({
    where: { ownerId: user.id, folderId: { in: folderIds } },
    select: { id: true, size: true, storageKey: true, thumbnailKey: true },
  });

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0n);

  await prisma.$transaction([
    prisma.file.deleteMany({ where: { id: { in: files.map((f) => f.id) } } }),
    prisma.folder.deleteMany({ where: { id: { in: folderIds } } }),
    prisma.user.update({
      where: { id: user.id },
      data: { usedBytes: { decrement: totalBytes } },
    }),
  ]);

  for (const f of files) {
    await removeObject(user.id, f.storageKey);
    if (f.thumbnailKey) await removeObject(user.id, f.thumbnailKey);
  }

  return NextResponse.json({ ok: true });
}

async function collectDescendants(rootId: string, ownerId: string): Promise<string[]> {
  const all: string[] = [];
  let frontier: string[] = [rootId];
  while (frontier.length) {
    const children = await prisma.folder.findMany({
      where: { ownerId, parentId: { in: frontier } },
      select: { id: true },
    });
    const ids = children.map((c) => c.id);
    all.push(...ids);
    frontier = ids;
  }
  return all;
}
