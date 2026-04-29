import { NextResponse } from "next/server";
import { lockVault } from "@/lib/vault";

export const runtime = "nodejs";

export async function POST() {
  lockVault();
  return NextResponse.json({ ok: true });
}
