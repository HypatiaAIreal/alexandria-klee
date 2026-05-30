// ─────────────────────────────────────────────────────────────
//  JWT helpers (jose — edge-safe, used by middleware AND API routes).
//  This file MUST NOT import Node-only modules (mongoose, bcrypt, fs)
//  so it can run in the edge middleware runtime.
// ─────────────────────────────────────────────────────────────
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "klee_token";
const ISSUER = "alexandria-klee";

// In production set AUTH_SECRET. A dev fallback keeps local runs working.
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me-in-production"
);

export interface TokenPayload {
  sub: string; // user id
  email: string;
  name: string;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}
