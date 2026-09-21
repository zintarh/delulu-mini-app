import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";
import { isLeaderboardBlacklisted } from "@/lib/constant";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import {
  hasEarnedCampaignProofPointsOnGraph,
  hasQualifyingForfeitProofOnGraph,
} from "@/lib/community/campaign-subgraph";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? "0") || 0);
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase() || null;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: rows, error } = await admin
    .from("referral_leaderboard_v")
    .select("wallet_address, referral_count, gdollars_amount, last_referral_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const wallets = (rows ?? []).map((r) => r.wallet_address);

  // A referrer only appears on the leaderboard once they're a real,
  // fully-onboarded participant themselves, not just a wallet that grabbed a
  // referral code. Full checklist: face-verified, claimed their GoodDollar
  // daily UBI at least once, finished account setup, claimed the 1000 G$
  // onboarding gift, and joined a campaign with a real proof worth >= 1000
  // points (or the Forfeit equivalent).
  const profileByAddress = new Map<
    string,
    { onboarded_at: string | null; onboarding_gift_claimed_at: string | null; claim_count: number | null }
  >();
  if (wallets.length > 0) {
    const { data: profileRows } = await admin
      .from("profiles")
      .select("address, onboarded_at, onboarding_gift_claimed_at, claim_count")
      .in("address", wallets);
    for (const p of profileRows ?? []) profileByAddress.set(p.address, p);
  }

  const eligibility = new Map<string, boolean>();
  await Promise.all(
    wallets.map(async (wallet) => {
      const profile = profileByAddress.get(wallet);
      if (
        !profile?.onboarded_at ||
        !profile.onboarding_gift_claimed_at ||
        !profile.claim_count ||
        profile.claim_count < 1
      ) {
        eligibility.set(wallet, false);
        return;
      }

      const [verified, hasCampaignProof, hasForfeitProof] = await Promise.all([
        isGoodDollarVerified(wallet),
        hasEarnedCampaignProofPointsOnGraph(wallet, BASE_PROOF_POINTS),
        hasQualifyingForfeitProofOnGraph(wallet),
      ]);

      eligibility.set(wallet, verified && (hasCampaignProof || hasForfeitProof));
    }),
  );

  const filtered = (rows ?? []).filter(
    (row) => !isLeaderboardBlacklisted(row.wallet_address) && eligibility.get(row.wallet_address),
  );

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
