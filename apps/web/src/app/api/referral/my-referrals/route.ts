import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import {
  hasEarnedCampaignProofPointsOnGraph,
  hasQualifyingForfeitProofOnGraph,
} from "@/lib/community/campaign-subgraph";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";
import { evaluateAndCreditReferral } from "@/lib/referral/evaluate";

export const dynamic = "force-dynamic";

export type MyReferralSteps = {
  signedUp: boolean;
  verified: boolean;
  joined: boolean;
  proofApproved: boolean;
};

export type MyReferral = {
  username: string | null;
  pfpUrl: string | null;
  joinedAt: string;
  steps: MyReferralSteps;
  /** Counted toward the referrer — and whether the 6,000 G$ has gone out yet. */
  counted: boolean;
  payout: "sent" | "held" | "failed" | null;
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
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });

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
      .select("referred_wallet, payout_status")
      .eq("referrer_wallet", address),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const creditByWallet = new Map(
    (credits ?? []).map((c) => [String(c.referred_wallet).toLowerCase(), c.payout_status as string]),
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

      // Already counted — every step is done by definition.
      if (payoutStatus) {
        return {
          ...base,
          steps: { signedUp: true, verified: true, joined: true, proofApproved: true },
          counted: true,
          payout: payoutStatus === "sent" ? "sent" : payoutStatus === "failed" ? "failed" : "held",
        };
      }

      const [verified, joins, forfeits, campaignProof, forfeitProof] = await Promise.all([
        isGoodDollarVerified(wallet),
        admin.from("campaign_participants").select("id").eq("wallet_address", wallet).limit(1),
        admin.from("forfeit_commitments").select("id").eq("creator_wallet", wallet).limit(1),
        hasEarnedCampaignProofPointsOnGraph(wallet, BASE_PROOF_POINTS),
        hasQualifyingForfeitProofOnGraph(wallet),
      ]);
      const proofApproved = campaignProof || forfeitProof;

      // Every step done but never credited (a missed trigger) — the evaluator
      // is idempotent, so self-heal it here instead of leaving it stuck.
      if (verified && proofApproved) {
        try {
          const result = await evaluateAndCreditReferral(admin, wallet);
          if (result.credited) {
            return {
              ...base,
              steps: { signedUp: true, verified: true, joined: true, proofApproved: true },
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
          joined: proofApproved || (joins.data ?? []).length > 0 || (forfeits.data ?? []).length > 0,
          proofApproved,
        },
        counted: false,
        payout: null,
      };
    }),
  );

  return NextResponse.json({ referrals });
}
