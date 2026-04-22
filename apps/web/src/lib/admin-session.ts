import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const ADMIN_SESSION_COOKIE = "delulu_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

type AdminSessionPayload = {
  role: "ops";
  email: string;
};

function getJwtSecret() {
  const secret =
    process.env.ADMIN_OPS_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "dev-admin-session-secret";
  return new TextEncoder().encode(secret);
}

export function isOpsAuthConfigured() {
  return Boolean(process.env.ADMIN_OPS_EMAIL && process.env.ADMIN_OPS_PASSWORD);
}

export async function createAdminSession(email: string) {
  const jwt = await new SignJWT({ role: "ops", email } satisfies AdminSessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_TTL_SECONDS}s`)
    .sign(getJwtSecret());

  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(ADMIN_SESSION_COOKIE);
}

export async function readAdminSession(): Promise<AdminSessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, getJwtSecret());
    const payload = verified.payload as Partial<AdminSessionPayload>;
    if (payload.role !== "ops" || !payload.email) return null;
    return { role: "ops", email: payload.email };
  } catch {
    return null;
  }
}

export function validateOpsCredentials(email: string, password: string) {
  const expectedEmail = process.env.ADMIN_OPS_EMAIL;
  const expectedPassword = process.env.ADMIN_OPS_PASSWORD;
  if (!expectedEmail || !expectedPassword) return false;
  return email.trim().toLowerCase() === expectedEmail.toLowerCase() && password === expectedPassword;
}

