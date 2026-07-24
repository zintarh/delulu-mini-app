import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import {
  requireAuthenticatedWallet,
  walletAuthErrorResponse,
} from "@/lib/auth/wallet-session";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export type AdminRewardGrantDto = {
  id: string;
  amount: number;
  tokenSymbol: string;
  tokenAddress: string;
  reason: string | null;
  txHash: string;
  createdAt: string;
};

/**
 * List admin RewardVault grants for the authenticated wallet (Activity feed).
 * GET /api/rewards/grants?address=0x…
 */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("address")?.trim() ?? "";
    if (!isAddress(raw)) {
      return NextResponse.json({ error: "Valid address is required" }, { status: 400 });
    }
    const address = getAddress(raw).toLowerCase();

    try {
      requireAuthenticatedWallet(request, address);
    } catch (err) {
      return walletAuthErrorResponse(err);
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const { data, error } = await admin
      .from("admin_reward_grants")
      .select("id, amount, token_symbol, token_address, reason, tx_hash, created_at")
      .eq("recipient_address", address)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[rewards/grants] query failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const grants: AdminRewardGrantDto[] = (data ?? []).map((row) => ({
      id: String(row.id),
      amount: Number(row.amount) || 0,
      tokenSymbol: String(row.token_symbol ?? ""),
      tokenAddress: String(row.token_address ?? ""),
      reason: row.reason ? String(row.reason) : null,
      txHash: String(row.tx_hash ?? ""),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }));

    return NextResponse.json(
      { grants },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    console.error("[rewards/grants] error:", err);
    return NextResponse.json({ error: "Failed to load grants" }, { status: 500 });
  }
}
