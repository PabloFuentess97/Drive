import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeObject } from "@/lib/storage";
import { safeName } from "@/lib/utils";

export const runtime = "nodejs";

// PATCH /api/files/[id] -> rename / move
const Patch = z.object({
  name: z.string().min(1).max(240).optional(),
  folderId: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await prisma.file.findFirst({ where: { id: params.id, ownerId: user.id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = Patch.parse(await req.json());

  if (data.folderId) {
    const folder = await prisma.folder.findFirst({ where: { id: data.folderId, ownerId: user.id } });
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const updated = await prisma.file.update({
    where: { id: file.id },
    data: {
      ...(data.name ? { name: safeName(data.name) } : {}),
      ...(data.folderId !== undefined ? { folderId: data.folderId } : {}),
    },
  });

  return NextResponse.json({ file: { ...updated, size: updated.size.toString() } });
}

// DELETE /api/files/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await prisma.file.findFirst({ where: { id: params.id, ownerId: user.id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.file.delete({ where: { id: file.id } });
    await tx.user.update({
      where: { id: user.id },
      data: { usedBytes: { decrement: file.size } },
    });
  });

  await removeObject(user.id, file.storageKey);
  if (file.thumbnailKey) await removeObject(user.id, file.thumbnailKey);

  return NextResponse.json({ ok: true });
}
