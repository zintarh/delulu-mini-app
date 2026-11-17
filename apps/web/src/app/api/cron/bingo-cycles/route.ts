export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { runBingoScheduler } from "@/lib/bingo/cycles";

/** Daily: sets up cycles starting within 2 days, ends finished ones, queues the next automatic cycle. */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const log = await runBingoScheduler(admin);
  console.log("[cron/bingo-cycles]", log.join(" | ") || "nothing to do");
  return NextResponse.json({ ok: true, log });
}
