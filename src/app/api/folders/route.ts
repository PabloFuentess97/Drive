import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeName } from "@/lib/utils";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().nullable().optional(),
});

// GET /api/folders -> full tree of the current user
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const folders = await prisma.folder.findMany({
    where: { ownerId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, parentId: true, updatedAt: true },
  });
  return NextResponse.json({ folders });
}

// POST /api/folders -> create
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = Body.parse(await req.json());
  const parentId = data.parentId || null;

  if (parentId) {
    const parent = await prisma.folder.findFirst({ where: { id: parentId, ownerId: user.id } });
    if (!parent) return NextResponse.json({ error: "Carpeta padre no encontrada" }, { status: 404 });
  }

  try {
    const folder = await prisma.folder.create({
      data: {
        name: safeName(data.name) || "untitled",
        ownerId: user.id,
        parentId,
      },
    });
    return NextResponse.json({ folder }, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una carpeta con ese nombre aquí" }, { status: 409 });
    }
    throw e;
  }
}
