import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { checkReferralEligibility } from "@/lib/referral/eligibility";
import { getReferrerStanding } from "@/lib/referral/standing";

export const dynamic = "force-dynamic";

/**
 * Whether a wallet has finished onboarding enough to see/share its referral
 * link, and whether that link is currently locked (see lib/referral/standing.ts).
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase();
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const [result, standing] = await Promise.all([
    checkReferralEligibility(admin, address),
    getReferrerStanding(admin, address),
  ]);
  return NextResponse.json({ ...result, standing });
}
