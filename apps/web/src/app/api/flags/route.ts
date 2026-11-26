import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getFlowVoteEnabled } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

/** GET /api/flags — the admin switches players' screens follow. */
export async function GET() {
  const flowVote = await getFlowVoteEnabled(getSupabaseAdmin());
  return NextResponse.json({ flowVote }, { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } });
}
