import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { logCommunityMemberDailyClaim } from "@/lib/community/join-member";
import {
  requireAuthenticatedWallet,
  walletAuthErrorResponse,
} from "@/lib/auth/wallet-session";

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();
    try {
      requireAuthenticatedWallet(request, normalizedAddress);
    } catch (err) {
      return walletAuthErrorResponse(err);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { data: existing, error: selectError } = await supabase
      .from("profiles")
      .select("address, claim_count")
      .ilike("address", normalizedAddress)
      .maybeSingle();
    if (selectError) throw selectError;

    const nextCount = (existing?.claim_count ?? 0) + 1;

    if (existing) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ claim_count: nextCount, updated_at: new Date().toISOString() })
        .eq("address", normalizedAddress);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("profiles").insert({
        address: normalizedAddress,
        claim_count: nextCount,
        email: `${normalizedAddress}@wallet.local`,
        updated_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;
    }

    let communityLogOk = true;
    try {
      await logCommunityMemberDailyClaim(supabase, normalizedAddress);
    } catch (claimLogErr) {
      communityLogOk = false;
      console.error("[profile/claim] community claim log error:", claimLogErr);
    }

    return NextResponse.json({
      success: true,
      claim_count: nextCount,
      community_log_ok: communityLogOk,
    });
  } catch (error) {
    console.error("[profile/claim] increment error:", error);
    return NextResponse.json({ error: "Failed to increment claim count" }, { status: 500 });
  }
}
