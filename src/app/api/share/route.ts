import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const Body = z.object({
  fileId: z.string(),
  password: z.string().min(4).max(128).optional().nullable(),
  expiresInHours: z.number().int().positive().max(24 * 30).optional(),
  maxDownloads: z.number().int().positive().max(10000).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = Body.parse(await req.json());
  const file = await prisma.file.findFirst({ where: { id: data.fileId, ownerId: user.id } });
  if (!file) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });

  const token = randomBytes(24).toString("base64url");
  const expiresAt = data.expiresInHours
    ? new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000)
    : null;

  const share = await prisma.share.create({
    data: {
      token,
      fileId: file.id,
      ownerId: user.id,
      passwordHash: data.password ? await hashPassword(data.password) : null,
      expiresAt,
      maxDownloads: data.maxDownloads ?? null,
    },
  });

  return NextResponse.json({ share: { ...share, url: `/share/${share.token}` } }, { status: 201 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const shares = await prisma.share.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { file: { select: { id: true, name: true, mimeType: true } } },
  });
  return NextResponse.json({ shares });
}
