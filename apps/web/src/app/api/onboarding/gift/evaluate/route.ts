import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { evaluateAndCreditOnboardingGift, ONBOARDING_GIFT_GDOLLARS } from "@/lib/onboarding/gift";

export const dynamic = "force-dynamic";

/**
 * Re-checks live eligibility (GoodDollar-verified + finished account setup)
 * and grants the one-time onboarding gift if both are now true. Safe to call
 * repeatedly/redundantly — see evaluateAndCreditOnboardingGift. Called from
 * account-setup completion, right after identity verification completes,
 * and as a fallback re-check on every dashboard load (onboarding-gift-modal)
 * so a missed timing race in the first two never permanently sticks a wallet
 * at not_eligible/failed.
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
