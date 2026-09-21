import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { checkReferralEligibility } from "@/lib/referral/eligibility";

export const dynamic = "force-dynamic";

/** Whether a wallet has finished onboarding enough to see/share its referral link. */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase();
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const result = await checkReferralEligibility(admin, address);
  return NextResponse.json(result);
}
