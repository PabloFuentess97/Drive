import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, issueSession } from "@/lib/auth";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  }

  const user = await authenticate(parsed.email, parsed.password);
  if (!user) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
  }
  await issueSession(user.id, user.email, user.role);
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
