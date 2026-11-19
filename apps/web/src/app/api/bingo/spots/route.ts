import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { viewerWallet } from "@/lib/bingo/viewer";
import { loadRewardsConfig } from "@/lib/rewards/config";
import { rewardDayFor } from "@/lib/rewards/rules";
import { loadSpots } from "@/lib/rewards/spots";

export const dynamic = "force-dynamic";

/**
 * GET — the viewer's photo-reward spots, so the join sheet can say up front
 * whether a new card will earn per photo: { max, used, bingoStakes } where
 * bingoStakes are the stakes of running Bingo cards holding a spot.
 */
export async function GET(request: NextRequest) {
  const wallet = viewerWallet(request);
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  if (!wallet) return NextResponse.json({ max: null, used: 0, bingoStakes: [] });
  const config = await loadRewardsConfig(admin);
  const day = rewardDayFor(new Date(), config.timezone);
  const { held, cooling } = await loadSpots(admin, wallet, day);
  return NextResponse.json({
    max: config.dailyProof.maxEligibleGoals,
    used: held.length + cooling,
    bingoStakes: held.map((h) => h.bingoStake).filter((n): n is number => n != null),
  });
}
