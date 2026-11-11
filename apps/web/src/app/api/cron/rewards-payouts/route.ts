export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { reconcilePayouts } from "@/lib/rewards/ledger";
import { sweepMissedRewards } from "@/lib/rewards/engine";
import { retryLegacyFailedProofRewards } from "@/lib/proof-reward/grant";

/**
 * Rewards Engine upkeep. Hit every 15 minutes by GitHub Actions
 * (.github/workflows/rewards-payouts.yml), daily by Vercel cron as a fallback.
 *
 *  1. sweep:     reserves weekly/completion rewards a crashed request missed
 *  2. reconcile: settles submitted txs from their receipts, resends failed
 *                or stuck rewards within the vault pool's balance
 *  3. legacy:    drains old 10 G$ per-proof rewards that had failed
 *
 * Each step is independent and idempotent — one failing doesn't hide the others.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return errorResponse("Unauthorized", 401);
  const admin = getSupabaseAdmin();
  if (!admin) return errorResponse("Missing Supabase credentials.", 500);

  const step = async <T,>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> => {
    try {
      return await fn();
    } catch (e: any) {
      console.error(`[cron/rewards-payouts] ${name} failed`, e);
      return { error: e?.message ?? `${name} failed` };
    }
  };

  const sweep = await step("sweep", () => sweepMissedRewards(admin, { deadlineMs: 20_000 }));
  const reconcile = await step("reconcile", () => reconcilePayouts(admin, { deadlineMs: 60_000 }));
  const legacy = await step("legacy", () => retryLegacyFailedProofRewards(admin, 5));

  return jsonResponse({ ok: true, sweep, reconcile, legacy });
}
