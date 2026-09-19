import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

/**
 * Called by the claim modal right after a successful on-chain claimReward()
 * for G$, so the blocking modal never shows again for this wallet. Separate
 * from the RewardVault balance itself, since a claim sweeps the whole
 * pending G$ balance (any source), not just this gift.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const address = String(body.address ?? "").trim().toLowerCase();
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: profile } = await admin
    .from("profiles")
    .select("onboarding_gift_status, onboarding_gift_claimed_at")
    .eq("address", address)
    .maybeSingle();

  if (!profile || profile.onboarding_gift_status !== "sent") {
    return NextResponse.json({ error: "No pending onboarding gift for this wallet" }, { status: 409 });
  }
  if (profile.onboarding_gift_claimed_at) {
    return NextResponse.json({ ok: true, alreadyClaimed: true });
  }

  const { error } = await admin
    .from("profiles")
    .update({ onboarding_gift_claimed_at: new Date().toISOString() })
    .eq("address", address);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
