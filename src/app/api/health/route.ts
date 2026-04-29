import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — used by Docker / reverse proxy healthchecks
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, db: "down", error: e.message }, { status: 503 });
  }
}
