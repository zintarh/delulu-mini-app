import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { evaluateAndCreditOnboardingGift, ONBOARDING_GIFT_GDOLLARS } from "@/lib/onboarding/gift";

export const dynamic = "force-dynamic";

/**
 * Re-checks live eligibility (GoodDollar-verified + joined a campaign) and
 * grants the one-time onboarding gift if both are now true. Safe to call
 * repeatedly/redundantly — see evaluateAndCreditOnboardingGift. Called from
 * campaign-join confirmation and right after identity verification
 * completes, since either can be the condition that newly satisfies both.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const address = String(body.address ?? "").trim().toLowerCase();
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const result = await evaluateAndCreditOnboardingGift(admin, address);

  return NextResponse.json({
    status: result.status,
    claimedAt: result.claimedAt,
    justGranted: result.justGranted,
    amount: ONBOARDING_GIFT_GDOLLARS,
    mustClaim: result.status === "sent" && !result.claimedAt,
  });
}
