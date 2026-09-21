import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { isValidOnChainChallengeId } from "@/lib/community/campaign-milestone-counts";
import { isCampaignExpired } from "@/lib/community/campaign-types";
import { ONBOARDING_GIFT_GDOLLARS } from "@/lib/onboarding/gift";

export const dynamic = "force-dynamic";

/**
 * Finds any live, joinable campaign priced at exactly the onboarding-gift
 * amount, so the claim modal has something concrete to upsell into without
 * hardcoding a specific campaign — create as many 1000 G$ campaigns as you
 * like and this just picks one.
 */
export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: candidates, error } = await admin
    .from("community_campaigns")
    .select(
      "id, on_chain_challenge_id, is_hidden, status, display_ends_at, created_at, duration_days, join_amount, is_free_to_join",
    )
    .eq("join_amount", ONBOARDING_GIFT_GDOLLARS)
    .eq("is_free_to_join", false)
    .in("status", ["approved", "active"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const match = (candidates ?? []).find(
    (c) =>
      !c.is_hidden &&
      isValidOnChainChallengeId(c.on_chain_challenge_id) &&
      !isCampaignExpired(c),
  );

  return NextResponse.json({ campaignId: match?.id ?? null });
}
