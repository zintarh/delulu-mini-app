import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { loadPartner } from "@/lib/referral/partners";

export const dynamic = "force-dynamic";

/**
 * GET /api/join/:code — what a /join/<code> link is: a partner's referral link
 * ({ kind: "partner", name }) or anything else ({ kind: "community" }, the
 * older community invite codes). Public: only says whether the code is a
 * partner's and their display name.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const admin = getSupabaseAdmin();
  const partner = admin ? await loadPartner(admin, code).catch(() => null) : null;
  if (partner?.active) return NextResponse.json({ kind: "partner", code: partner.code, name: partner.name });
  return NextResponse.json({ kind: "community" });
}
