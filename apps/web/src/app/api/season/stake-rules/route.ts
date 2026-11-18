import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { loadStakeRules } from "@/lib/season/activity";
import { stakeRulesView } from "@/lib/season/rules";

export const dynamic = "force-dynamic";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** GET /api/season/stake-rules?address= — this wallet's minimum stake and tier. */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json(stakeRulesView({ firstSeenMs: null, acceptedProofs: 0, activeDays: 0 }));
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  return NextResponse.json(await loadStakeRules(admin, address));
}
