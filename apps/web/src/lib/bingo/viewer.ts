import type { NextRequest } from "next/server";
import { isAddress } from "viem";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";

/** Read-only views: the session wallet, else ?address (writes always require the session). */
export function viewerWallet(request: NextRequest): string | null {
  const session = getAuthenticatedWallet(request);
  if (session) return session;
  const q = request.nextUrl.searchParams.get("address")?.trim().toLowerCase() ?? "";
  return isAddress(q) ? q : null;
}
