import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { lagosDay, payPotWeek } from "@/lib/pool/active-pot";
import { addDays, weekBounds } from "@/lib/rewards/rules";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Monday after a week: pay last week's Active Pot. Idempotent — safe to re-run (and it retries the week before too). */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return errorResponse("Unauthorized", 401);
  const admin = getSupabaseAdmin();
  if (!admin) return errorResponse("Missing Supabase credentials.", 500);
  const lastWeek = weekBounds(addDays(lagosDay(Date.now()), -7)).start;
  const results = [];
  for (const start of [lastWeek, weekBounds(addDays(lastWeek, -7)).start]) {
    results.push(await payPotWeek(admin, start, { deadlineMs: 50_000 }).catch((e) => ({ start, error: String(e?.message ?? e) })));
  }
  return jsonResponse({ ok: true, results });
}
