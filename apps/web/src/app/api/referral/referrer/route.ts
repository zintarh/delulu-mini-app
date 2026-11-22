import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { normalizeReferralCode } from "@/lib/referral/attribution";

export const dynamic = "force-dynamic";

/**
 * Public lookup for the invite landing (/sign-in?ref=CODE): who invited you.
 * Deliberately minimal — no wallet address or campaign data. An invite is
 * never on hold for the friend; a referrer who's behind only has their
 * payout held (lib/referral/standing.ts).
 */
export async function GET(request: NextRequest) {
  const code = normalizeReferralCode(request.nextUrl.searchParams.get("code"));
  if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: referrer } = await admin
    .from("profiles")
    .select("username, pfp_url")
    .eq("referral_code", code)
    .maybeSingle();
  if (!referrer) return NextResponse.json({ found: false });

  return NextResponse.json({
    found: true,
    username: referrer.username ?? null,
    pfpUrl: referrer.pfp_url ?? null,
  });
}
