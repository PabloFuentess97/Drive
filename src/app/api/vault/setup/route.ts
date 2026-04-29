import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { setupVault } from "@/lib/vault";

export const runtime = "nodejs";

const Body = z.object({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  currentPassword: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e.errors?.[0]?.message || "Datos no válidos" }, { status: 400 });
  }

  try {
    await setupVault(user, parsed.password, parsed.currentPassword);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
