import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { ensureReferralCode } from "@/lib/referral/code";

export async function GET(
  _request: NextRequest,
  { params }: { params: { address: string } }
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("address, username, email, pfp_url, referral_code")
    .eq("address", params.address.toLowerCase())
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }

  // Self-heal: any existing profile without a referral_code gets one lazily.
  if (data && !data.referral_code) {
    try {
      data.referral_code = await ensureReferralCode(supabase, data.address as string);
    } catch (err) {
      console.error("[profile/[address]] ensureReferralCode failed", err);
    }
  }

  let referralCount = 0;
  if (data) {
    const { count } = await supabase
      .from("referral_credits")
      .select("id", { count: "exact", head: true })
      .eq("referrer_wallet", (data.address as string).toLowerCase());
    referralCount = count ?? 0;
  }

  return NextResponse.json({ profile: data, referralCount }, {
    headers: { "Cache-Control": "no-store" },
  });
}
