import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signJwt, verifyJwt } from "@/lib/jwt";
import bcrypt from "bcryptjs";
import { adminEmails, env } from "@/lib/env";

export const SESSION_COOKIE = "drive_session";
const ONE_WEEK = 60 * 60 * 24 * 7;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createUser(email: string, password: string, name?: string) {
  const normalized = email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email: normalized } });
  if (exists) throw new Error("Ese correo ya está registrado");

  const role = adminEmails.includes(normalized) ? "ADMIN" : "USER";

  return prisma.user.create({
    data: {
      email: normalized,
      name: name?.trim() || null,
      passwordHash: await hashPassword(password),
      role,
      quotaBytes: BigInt(env.DEFAULT_QUOTA_BYTES),
    },
  });
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

export async function issueSession(userId: string, email: string, role: "USER" | "ADMIN") {
  const token = await signJwt({ sub: userId, email, role }, env.JWT_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + ONE_WEEK * 1000);

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {});
  }
  cookies().delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyJwt(token);
  if (!payload?.sub) return null;
  return prisma.user.findUnique({ where: { id: payload.sub } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Response("No autorizado", { status: 401 });
  return user;
}
