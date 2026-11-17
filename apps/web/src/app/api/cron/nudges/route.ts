export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { runNudges } from "@/lib/nudges/run";

/**
 * The nudge engine (every 30 min, GitHub Actions → this route). Picks at most
 * one nudge per person per day, quiet 10pm–8am Lagos, push first, email if
 * push is off. ?dry=1 returns who would be nudged without sending anything.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  let result;
  try {
    result = await runNudges(admin, { dryRun });
  } catch (err) {
    console.error("[cron/nudges]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Nudge run failed" }, { status: 500 });
  }
  console.log(`[cron/nudges] ${dryRun ? "dry " : ""}people=${result.people} planned=${result.planned.length} sent=${result.sent} failed=${result.failed} acted=${result.actedMarked}${result.quietHours ? " (quiet hours)" : ""}`);
  return NextResponse.json(result);
}
