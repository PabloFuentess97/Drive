import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeName } from "@/lib/utils";
import { requireVaultUnlocked } from "@/lib/vault";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().nullable().optional(),
  secure: z.boolean().optional(), // sólo se usa si parentId == null
});

// GET /api/folders -> árbol completo del usuario.
// secure=1 sólo devuelve carpetas seguras; por defecto, sólo no-seguras.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const secure = searchParams.get("secure") === "1";
  if (secure) await requireVaultUnlocked(user.id);

  const folders = await prisma.folder.findMany({
    where: { ownerId: user.id, isSecure: secure },
    orderBy: { name: "asc" },
    select: { id: true, name: true, parentId: true, isSecure: true, updatedAt: true },
  });
  return NextResponse.json({ folders });
}

// POST /api/folders -> crea una carpeta (hereda isSecure del padre o
// usa el flag `secure` cuando se crea en raíz).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = Body.parse(await req.json());
  const parentId = data.parentId || null;

  let isSecure = !!data.secure;
  if (parentId) {
    const parent = await prisma.folder.findFirst({ where: { id: parentId, ownerId: user.id } });
    if (!parent) return NextResponse.json({ error: "Carpeta padre no encontrada" }, { status: 404 });
    isSecure = parent.isSecure;
  }
  if (isSecure) await requireVaultUnlocked(user.id);

  try {
    const folder = await prisma.folder.create({
      data: {
        name: safeName(data.name) || "untitled",
        ownerId: user.id,
        parentId,
        isSecure,
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
