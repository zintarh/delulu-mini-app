import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

/**
 * Informational history of Friend-destination forfeit rewards for a wallet —
 * the claimable amount itself always comes from a live on-chain read
 * (ForfeitMarket.pendingFriendReward), this is just "here's where it came from".
 */
export async function GET(request: NextRequest) {
  const rawAddress = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!isAddress(rawAddress)) {
    return NextResponse.json({ error: "Valid address is required" }, { status: 400 });
  }
  const address = getAddress(rawAddress).toLowerCase();

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data, error } = await admin
    .from("forfeit_friend_rewards")
    .select("id, commitment_id, token_address, token_symbol, amount, credited_at")
    .eq("recipient_address", address)
    .order("credited_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
