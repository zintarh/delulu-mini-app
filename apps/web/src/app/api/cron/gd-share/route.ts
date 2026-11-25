export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { addDays, lagosToday, refreshDay } from "@/lib/ecosystem/gd-share";

/**
 * Daily, just after Lagos midnight: finalise yesterday's G$ shares (Admin → Ecosystem).
 * ?day=YYYY-MM-DD computes that day instead (manual backfill).
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const asked = request.nextUrl.searchParams.get("day");
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : addDays(lagosToday(), -1);
  try {
    const network = await refreshDay(admin, day);
    console.log("[cron/gd-share]", day, Math.round(network.totalG), "G$ on Celo,", network.transfers, "transfers");
    return NextResponse.json({ ok: true, day, network });
  } catch (e) {
    console.error("[cron/gd-share]", day, e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
