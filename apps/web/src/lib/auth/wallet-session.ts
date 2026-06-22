import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage } from "viem";
import { isWalletAuthMessageValid } from "@/lib/auth/wallet-auth-message";

export { buildWalletAuthMessage } from "@/lib/auth/wallet-auth-message";

export const WALLET_SESSION_COOKIE = "delulu_wallet_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  const secret = process.env.WALLET_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("WALLET_SESSION_SECRET is not configured");
  return secret;
}

export async function verifyWalletOwnership(
  address: string,
  message: string,
  signature: string,
): Promise<boolean> {
  if (!isAddress(address)) return false;
  if (!isWalletAuthMessageValid(message, address)) return false;
  try {
    return await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

export function createWalletSessionToken(address: string): string {
  const normalized = address.toLowerCase();
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${normalized}:${exp}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function parseWalletSessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const [address, expStr] = payload.split(":");
  const exp = Number(expStr);
  if (!address?.startsWith("0x") || !Number.isFinite(exp) || Date.now() > exp) return null;
  return address;
}

export function walletSessionCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export class WalletAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Returns authenticated wallet address from session cookie. */
export function getAuthenticatedWallet(request: NextRequest): string | null {
  return parseWalletSessionToken(request.cookies.get(WALLET_SESSION_COOKIE)?.value);
}

/**
 * Require wallet session; optionally verify body/query address matches session.
 */
export function requireAuthenticatedWallet(
  request: NextRequest,
  bodyAddress?: string | null,
): string {
  const sessionAddress = getAuthenticatedWallet(request);
  if (!sessionAddress) {
    throw new WalletAuthError("Unauthorized — sign in required", 401);
  }
  if (bodyAddress) {
    const normalized = bodyAddress.trim().toLowerCase();
    if (!isAddress(normalized)) {
      throw new WalletAuthError("Invalid wallet address", 400);
    }
    if (normalized !== sessionAddress) {
      throw new WalletAuthError("Wallet address does not match session", 403);
    }
  }
  return sessionAddress;
}

export function walletAuthErrorResponse(err: unknown) {
  if (err instanceof WalletAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
