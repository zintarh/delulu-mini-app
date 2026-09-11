import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  requireAuthenticatedWallet,
  walletAuthErrorResponse,
} from "@/lib/auth/wallet-session";
import { evaluateAndCreditReferral } from "@/lib/referral/evaluate";

/**
 * Called after GoodDollar verification completes (see identityHook.ts) to
 * re-check whether a pending referral should now be credited. Idempotent —
 * safe to call redundantly; evaluateAndCreditReferral always re-checks live
 * state, so it never double-credits.
 */
export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json().catch(() => ({}));

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    try {
      requireAuthenticatedWallet(request, normalizedAddress);
    } catch (err) {
      return walletAuthErrorResponse(err);
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const result = await evaluateAndCreditReferral(admin, normalizedAddress);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[referral/evaluate] error:", error);
    return NextResponse.json({ error: "Failed to evaluate referral" }, { status: 500 });
  }
}
