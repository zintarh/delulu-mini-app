import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";
import { isLeaderboardBlacklisted } from "@/lib/constant";
import { checkReferralEligibility } from "@/lib/referral/eligibility";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

/**
 * Rollout instant for the "referrer must clear the full onboarding
 * checklist" requirement below. A referral credited before this keeps
 * counting under the old, looser rule (just not blacklisted) — grandfathered
 * in so referrals that were already valid under the rules at the time don't
 * get retroactively wiped off the leaderboard. Only referrals credited from
 * this point on need the referrer to actually clear the new bar. Frozen on
 * purpose (not `new Date()`), so it doesn't drift forward on every redeploy.
 */
const ELIGIBILITY_CHECK_CUTOFF_ISO = "2026-09-21T00:00:00+01:00";

type ReferralCreditRow = {
  referrer_wallet: string;
  gdollars_amount: number | string | null;
  credited_at: string;
};

export async function GET(request: NextRequest) {
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? "0") || 0);
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase() || null;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: creditRows, error } = await admin
    .from("referral_credits")
    .select("referrer_wallet, gdollars_amount, credited_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const credits = (creditRows ?? []) as ReferralCreditRow[];

  // Only referrers with at least one post-cutoff referral need the live
  // full-checklist check — legacy-only referrers skip it entirely (see below).
  const walletsNeedingCheck = new Set(
    credits
      .filter((r) => r.credited_at >= ELIGIBILITY_CHECK_CUTOFF_ISO)
      .map((r) => r.referrer_wallet),
  );
  const eligibility = new Map<string, boolean>();
  await Promise.all(
    Array.from(walletsNeedingCheck).map(async (wallet) => {
      const result = await checkReferralEligibility(admin, wallet);
      eligibility.set(wallet, result.eligible);
    }),
  );

  const aggregates = new Map<
    string,
    { referral_count: number; gdollars_amount: number; last_referral_at: string }
  >();
  for (const row of credits) {
    const wallet = row.referrer_wallet;
    if (isLeaderboardBlacklisted(wallet)) continue;

    const isPreCutoff = row.credited_at < ELIGIBILITY_CHECK_CUTOFF_ISO;
    if (!isPreCutoff && !eligibility.get(wallet)) continue;

    const amount = Number(row.gdollars_amount) || 0;
    const existing = aggregates.get(wallet);
    if (existing) {
      existing.referral_count += 1;
      existing.gdollars_amount += amount;
      if (row.credited_at > existing.last_referral_at) existing.last_referral_at = row.credited_at;
    } else {
      aggregates.set(wallet, {
        referral_count: 1,
        gdollars_amount: amount,
        last_referral_at: row.credited_at,
      });
    }
  }

  const filtered = Array.from(aggregates.entries()).map(([wallet_address, agg]) => ({
    wallet_address,
    ...agg,
  }));

  const sorted = filtered.sort((a, b) => {
    const countDiff = b.referral_count - a.referral_count;
    if (countDiff !== 0) return countDiff;
    // Tie → whoever hit that count first ranks higher.
    return new Date(a.last_referral_at).getTime() - new Date(b.last_referral_at).getTime();
  });

  const enriched = await enrichLeaderboardWithUsernames(admin, sorted);

  const totalCount = enriched.length;
  const from = page * PAGE_SIZE;
  const pageRows = enriched.slice(from, from + PAGE_SIZE).map((row, idx) => ({
    rank: from + idx + 1,
    wallet_address: row.wallet_address,
    username: row.username,
    referral_count: row.referral_count,
    gdollars_amount: row.gdollars_amount,
  }));

  let myEntry: (typeof pageRows)[number] | null = null;
  if (address) {
    const idx = enriched.findIndex((row) => row.wallet_address.toLowerCase() === address);
    if (idx !== -1) {
      const row = enriched[idx];
      myEntry = {
        rank: idx + 1,
        wallet_address: row.wallet_address,
        username: row.username,
        referral_count: row.referral_count,
        gdollars_amount: row.gdollars_amount,
      };
    }
  }

  return NextResponse.json({
    leaderboard: pageRows,
    hasMore: from + PAGE_SIZE < totalCount,
    totalCount,
    myEntry,
  });
}
