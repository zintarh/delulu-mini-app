import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { ONBOARDING_GIFT_GDOLLARS } from "@/lib/onboarding/gift";

export const dynamic = "force-dynamic";

/** Cheap read of current gift state — no on-chain check, safe to call on every page load. */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase();
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: profile } = await admin
    .from("profiles")
    .select("onboarding_gift_status, onboarding_gift_claimed_at")
    .eq("address", address)
    .maybeSingle();

  const status = profile?.onboarding_gift_status ?? "not_eligible";
  const claimedAt = profile?.onboarding_gift_claimed_at ?? null;

  return NextResponse.json({
    status,
    claimedAt,
    amount: ONBOARDING_GIFT_GDOLLARS,
    // The modal blocks exactly this state: granted, not yet claimed.
    mustClaim: status === "sent" && !claimedAt,
  });
}
