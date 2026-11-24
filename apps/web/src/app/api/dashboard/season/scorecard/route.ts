import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { loadGdScorecard } from "@/lib/analytics/gd-scorecard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET — GoodDollar's season metrics next to ours (Admin → Season). */
export async function GET() {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  return NextResponse.json(await loadGdScorecard(admin));
}
