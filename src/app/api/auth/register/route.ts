import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, issueSession } from "@/lib/auth";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e.errors?.[0]?.message || "Invalid body" }, { status: 400 });
  }

  try {
    const user = await createUser(parsed.email, parsed.password, parsed.name);
    await issueSession(user.id, user.email, user.role);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Registration failed" }, { status: 400 });
  }
}
