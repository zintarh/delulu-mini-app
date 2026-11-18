import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { slotsView } from "@/lib/referral/slots";

export const dynamic = "force-dynamic";

/** GET /api/referral/slots — this round's referral spots: how many, how many taken, when fresh ones open. */
export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  return NextResponse.json(await slotsView(admin), { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
}
