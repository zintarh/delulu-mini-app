import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import { totalProofPointsOnGraph } from "@/lib/community/campaign-subgraph";
import { REFERRAL_MIN_POINTS, evaluateAndCreditReferral } from "@/lib/referral/evaluate";
import { hasConsecutiveDays, payReferralStreakBonus } from "@/lib/referral/streak";
import { referralRoundAt, roundFirstPayment } from "@/lib/referral/campaign";

export const dynamic = "force-dynamic";

export type MyReferralSteps = {
  signedUp: boolean;
  verified: boolean;
  joined: boolean;
  proofApproved: boolean;
  /** Showed up 3 days in a row — unlocks the second part of the reward. */
  streak3: boolean;
};

export type MyReferral = {
  username: string | null;
  pfpUrl: string | null;
  joinedAt: string;
  steps: MyReferralSteps;
  /** Counted toward the referrer — and whether the reward has gone out yet. */
  counted: boolean;
  payout: "sent" | "held" | "failed" | null;
  /** G$ actually paid for this referral's first part, once sent. */
  amount?: number | null;
  /** The 3-days-in-a-row bonus: what it is and whether it's been paid. */
  bonus?: { amount: number; paid: boolean } | null;
};

/**
 * Everyone who signed up with this wallet's referral link and how far along
 * each is — so a referrer can see why someone isn't counted yet and nudge
 * them. Mirrors the crediting rules in lib/referral/evaluate.ts: verified +
 * an approved campaign or Forfeit proof.
 * GET /api/referral/my-referrals?address=0x…
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase();
  if (!address) return NextResponse.json({ error: "Address is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const [{ data: referred, error }, { data: credits }] = await Promise.all([
    admin
      .from("profiles")
      .select("address, username, pfp_url, created_at")
      .eq("referred_by", address)
      .order("created_at", { ascending: false }),
    admin
      .from("referral_credits")
      .select("referred_wallet, payout_status, gdollars_amount, credited_at, streak_status")
      .eq("referrer_wallet", address)
      // Before the streak-bonus migration the column isn't there — fall back without it.
      .then(async (r) =>
        r.error && /streak_status/.test(r.error.message)
          ? admin.from("referral_credits").select("referred_wallet, payout_status, gdollars_amount, credited_at").eq("referrer_wallet", address)
          : r,
      ),
  ]);
  const creditRow = new Map(
    ((credits ?? []) as { referred_wallet: string; credited_at: string; streak_status?: string | null }[]).map((c) => [String(c.referred_wallet).toLowerCase(), c]),
  );
  // 3 days in a row, from each friend's accepted photos.
  const streakOf = async (wallet: string) => {
    const { data } = await admin.from("proof_image_fingerprints").select("created_at").eq("status", "accepted").ilike("wallet", wallet).limit(500);
    return hasConsecutiveDays((data ?? []).map((p) => String(p.created_at)));
  };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const creditByWallet = new Map(
    (credits ?? []).map((c) => [String(c.referred_wallet).toLowerCase(), c.payout_status as string]),
  );
  const amountByWallet = new Map(
    (credits ?? []).map((c) => [String(c.referred_wallet).toLowerCase(), c.gdollars_amount != null ? Number(c.gdollars_amount) : null]),
  );

  const referrals: MyReferral[] = await Promise.all(
    (referred ?? []).map(async (r) => {
      const wallet = String(r.address).toLowerCase();
      const payoutStatus = creditByWallet.get(wallet);
      const base = {
        username: (r.username as string | null) ?? null,
        pfpUrl: (r.pfp_url as string | null) ?? null,
        joinedAt: r.created_at as string,
      };

      // Already counted — the first four steps are done by definition.
      if (payoutStatus) {
        const row = creditRow.get(wallet);
        const round = row ? referralRoundAt(row.credited_at) : null;
        const bonusAmount = round ? round.reward - roundFirstPayment(round) : 0;
        const streak3 = await streakOf(wallet);
        let bonusPaid = row?.streak_status === "sent";
        // Due but not paid yet (a missed trigger) — settle it here too.
        if (streak3 && bonusAmount > 0 && !bonusPaid && payoutStatus === "sent") {
          bonusPaid = (await payReferralStreakBonus(admin, wallet).catch(() => "failed")) === "paid";
        }
        return {
          ...base,
          steps: { signedUp: true, verified: true, joined: true, proofApproved: true, streak3 },
          counted: true,
          payout: payoutStatus === "sent" ? "sent" : payoutStatus === "failed" ? "failed" : "held",
          amount: amountByWallet.get(wallet) ?? null,
          bonus: bonusAmount > 0 ? { amount: bonusAmount, paid: bonusPaid } : null,
        };
      }

      const [verified, joins, forfeits, bingo, points] = await Promise.all([
        isGoodDollarVerified(wallet),
        admin.from("campaign_participants").select("id").eq("wallet_address", wallet).limit(1),
        admin.from("forfeit_commitments").select("id").eq("creator_wallet", wallet).limit(1),
        admin.from("bingo_attempts").select("id").eq("wallet", wallet).limit(1),
        totalProofPointsOnGraph(wallet),
      ]);
      // Same bar as the evaluator: 1,000 proof points in total (missions, Bingo, Forfeit goals).
      const proofApproved = points.total >= REFERRAL_MIN_POINTS;

      // Every step done but never credited (a missed trigger) — the evaluator
      // is idempotent, so self-heal it here instead of leaving it stuck.
      if (verified && proofApproved) {
        try {
          const result = await evaluateAndCreditReferral(admin, wallet);
          if (result.credited) {
            return {
              ...base,
              steps: { signedUp: true, verified: true, joined: true, proofApproved: true, streak3: false },
              counted: true,
              payout: "held" as const,
            };
          }
        } catch (err) {
          console.error(`[my-referrals] evaluate failed for ${wallet}:`, err);
        }
      }

      return {
        ...base,
        steps: {
          signedUp: true,
          verified,
          joined: proofApproved || (joins.data ?? []).length > 0 || (forfeits.data ?? []).length > 0 || (bingo.data ?? []).length > 0,
          proofApproved,
          streak3: await streakOf(wallet),
        },
        counted: false,
        payout: null,
      };
    }),
  );

  return NextResponse.json({ referrals });
}
