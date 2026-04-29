import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

export interface AppJwtPayload extends JWTPayload {
  sub: string;
  email: string;
  role: "USER" | "ADMIN";
}

export async function signJwt(payload: Omit<AppJwtPayload, "iat" | "exp">, expiresIn = "7d") {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyJwt(token: string): Promise<AppJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as AppJwtPayload;
  } catch {
    return null;
  }
}
