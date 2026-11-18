import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getEarnFacts } from "@/lib/earn/facts";

export const dynamic = "force-dynamic";

/** GET /api/earn/facts — what the 7-day Bingo pays and what top players earned, in $ and ₦. */
export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const facts = await getEarnFacts(admin);
  return NextResponse.json(facts, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } });
}
