import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // No incluimos archivos / carpetas de la carpeta segura en las
  // estadísticas globales para no filtrar su existencia.
  const [fileCount, folderCount, recent] = await Promise.all([
    prisma.file.count({ where: { ownerId: user.id, isSecure: false } }),
    prisma.folder.count({ where: { ownerId: user.id, isSecure: false } }),
    prisma.file.findMany({
      where: { ownerId: user.id, isSecure: false },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, name: true, mimeType: true, size: true, updatedAt: true },
    }),
  ]);

  return NextResponse.json({
    quotaBytes: user.quotaBytes.toString(),
    usedBytes: user.usedBytes.toString(),
    fileCount,
    folderCount,
    recent: recent.map((r) => ({ ...r, size: r.size.toString() })),
  });
}
