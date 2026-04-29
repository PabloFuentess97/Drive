import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { signJwt, verifyJwt } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

export const VAULT_COOKIE = "drive_vault";
// Sesión efímera para la carpeta segura: 15 minutos por defecto.
const VAULT_TTL = "15m";
const VAULT_TTL_SECONDS = 15 * 60;

export interface VaultPayload {
  sub: string;
  vault: true;
}

export async function hashVaultPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

/**
 * Configura (o cambia) la contraseña de la carpeta segura.
 * Si ya hay una contraseña, requiere la actual para cambiarla.
 */
export async function setupVault(
  user: User,
  newPassword: string,
  currentPassword?: string,
): Promise<void> {
  if (newPassword.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }

  if (user.vaultPasswordHash) {
    if (!currentPassword) {
      throw new Error("Indica la contraseña actual de la carpeta segura");
    }
    const ok = await bcrypt.compare(currentPassword, user.vaultPasswordHash);
    if (!ok) throw new Error("La contraseña actual no es correcta");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { vaultPasswordHash: await hashVaultPassword(newPassword) },
  });
}

/**
 * Desactiva la carpeta segura. Verifica la contraseña, quita el flag
 * `isSecure` de todos los items del usuario y borra el hash.
 * Los archivos NO se eliminan, simplemente vuelven a ser accesibles
 * sin la contraseña adicional.
 */
export async function disableVault(user: User, password: string): Promise<void> {
  if (!user.vaultPasswordHash) return;

  const ok = await bcrypt.compare(password, user.vaultPasswordHash);
  if (!ok) throw new Error("Contraseña incorrecta");

  await prisma.$transaction([
    prisma.file.updateMany({
      where: { ownerId: user.id, isSecure: true },
      data: { isSecure: false },
    }),
    prisma.folder.updateMany({
      where: { ownerId: user.id, isSecure: true },
      data: { isSecure: false },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { vaultPasswordHash: null },
    }),
  ]);

  lockVault();
}

/**
 * Verifica la contraseña y emite la cookie de sesión de la carpeta segura.
 */
export async function unlockVault(user: User, password: string): Promise<void> {
  if (!user.vaultPasswordHash) {
    throw new Error("La carpeta segura no está configurada");
  }
  const ok = await bcrypt.compare(password, user.vaultPasswordHash);
  if (!ok) throw new Error("Contraseña incorrecta");

  const token = await signJwt({ sub: user.id, email: user.email, role: user.role }, VAULT_TTL);
  const expiresAt = new Date(Date.now() + VAULT_TTL_SECONDS * 1000);

  cookies().set(VAULT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Borra la cookie efímera. */
export function lockVault(): void {
  cookies().delete(VAULT_COOKIE);
}

/**
 * Comprueba que el usuario actual tiene una sesión válida de carpeta segura.
 * Devuelve true si la cookie existe, es válida y pertenece al mismo usuario.
 */
export async function isVaultUnlocked(userId: string): Promise<boolean> {
  const token = cookies().get(VAULT_COOKIE)?.value;
  if (!token) return false;
  const payload = await verifyJwt(token);
  return payload?.sub === userId;
}

/** Lanza Response 423 (Locked) si la carpeta segura no está desbloqueada. */
export async function requireVaultUnlocked(userId: string): Promise<void> {
  const ok = await isVaultUnlocked(userId);
  if (!ok) {
    throw new Response(
      JSON.stringify({ error: "Carpeta segura bloqueada", vaultLocked: true }),
      {
        status: 423,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
