import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isVaultUnlocked } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  return NextResponse.json({
    enabled: !!user.vaultPasswordHash,
    unlocked: await isVaultUnlocked(user.id),
  });
}
