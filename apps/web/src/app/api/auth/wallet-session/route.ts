import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  WALLET_SESSION_COOKIE,
  createWalletSessionToken,
  getAuthenticatedWallet,
  verifyWalletOwnership,
  walletSessionCookieOptions,
} from "@/lib/auth/wallet-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const address = getAuthenticatedWallet(request);
  if (!address) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true, address });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const address = String(body.address ?? "").trim();
    const message = String(body.message ?? "");
    const signature = String(body.signature ?? "");

    if (!isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }
    if (!message || !signature) {
      return NextResponse.json({ error: "message and signature are required" }, { status: 400 });
    }

    const valid = await verifyWalletOwnership(address, message, signature);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const token = createWalletSessionToken(address);
    const response = NextResponse.json({ ok: true, address: address.toLowerCase() });
    response.cookies.set(
      WALLET_SESSION_COOKIE,
      token,
      walletSessionCookieOptions(7 * 24 * 60 * 60),
    );
    return response;
  } catch (error) {
    console.error("[wallet-session] POST error:", error);
    return NextResponse.json({ error: "Failed to establish session" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(WALLET_SESSION_COOKIE, "", walletSessionCookieOptions(0));
  return response;
}
