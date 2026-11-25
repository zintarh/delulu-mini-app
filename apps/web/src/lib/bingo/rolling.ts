import { keeperAddress } from "@/lib/celo/forfeit-keeper";
import { isFirstWeekEligible, isFirstWeekSlug } from "@/lib/bingo/first-week";
import { createPublicClient, http, parseUnits } from "viem";
import { celo } from "viem/chains";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import { DELULU_CHAIN_ID, GOODDOLLAR_ADDRESSES, getForfeitMarketAddress } from "@/lib/constant";
import { parseForfeitCommitmentCreatedFromTx } from "@/lib/dashboard/parse-forfeit-tx";
import { finalizeAttempts, logBingoEvent } from "@/lib/bingo/cycles";
import { evaluateAndCreditReferral } from "@/lib/referral/evaluate";
import { DAY_MS, rollingAttemptOver, type BingoCampaignRow, type BingoVersionRow } from "@/lib/bingo/types";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** ForfeitMarket enums (see ForfeitMarket.sol). */
export const COMMUNITY_POOL_DESTINATION = 3;
export const DAILY_CADENCE = 1;

const reader = () =>
  createPublicClient({ chain: celo, transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://forno.celo.org") });
const market = () => getForfeitMarketAddress(DELULU_CHAIN_ID);

/** commitments(id) → creator, token, stake, destType, destAddr, cadence, periodSeconds, deadline, index, total, verifier, active, cancelled */
export async function readCommitment(id: number) {
  const c = (await reader().readContract({
    address: market(),
    abi: FORFEIT_MARKET_ABI,
    functionName: "commitments",
    args: [BigInt(id)],
  })) as readonly unknown[];
  return {
    creator: String(c[0]).toLowerCase(),
    token: String(c[1]).toLowerCase(),
    stake: c[2] as bigint,
    destinationType: Number(c[3]),
    cadence: Number(c[5]),
    periodSeconds: Number(c[6]),
    totalPeriods: Number(c[9]),
    verifier: String(c[10]).toLowerCase(),
    active: Boolean(c[11]),
  };
}

/** 0 Pending · 1 Success · 2 Forfeited */
export async function readPeriodOutcome(id: number, periodIndex: number): Promise<number> {
  return Number(
    await reader().readContract({
      address: market(),
      abi: FORFEIT_MARKET_ABI,
      functionName: "periodOutcome",
      args: [BigInt(id), periodIndex],
    }),
  );
}

/**
 * Opens a rolling attempt from the player's own ForfeitMarket commitment
 * (already saved by /api/forfeit/confirm-create, which makes it a normal
 * AI-verified goal for rewards and deadline handling). Every term is checked
 * on-chain: this wallet, G$, the Bingo's stake, community pool, daily, one
 * period per day of the Bingo, no friend verifier.
 */
export async function startRollingAttempt(admin: Admin, campaign: BingoCampaignRow, wallet: string, txHash: `0x${string}`) {
  if (campaign.enrollment !== "rolling" || campaign.status !== "live" || !campaign.current_version_id) {
    throw new Error("This Bingo isn't open right now.");
  }
  const { data: version } = await admin.from("bingo_versions").select("*").eq("id", campaign.current_version_id).single();
  const v = version as BingoVersionRow;

  // Your First Week: new and invited players only (the list hides it from everyone else).
  if (isFirstWeekSlug(campaign.slug) && !(await isFirstWeekEligible(admin, wallet))) {
    throw new Error(`${campaign.title} is for new players — try Outside Your Bubble instead.`);
  }

  if (campaign.recurrence === "one_time") {
    const { data: before } = await admin
      .from("bingo_attempts")
      .select("id, join_tx, required_filled")
      .eq("campaign_id", campaign.id)
      .eq("wallet", wallet)
      .order("started_at", { ascending: false });
    // A retry of the same stake is fine.
    const same = (before ?? []).find((a) => a.join_tx === txHash.toLowerCase());
    if (same) return same.id as string;
    // Finish-once: a card that ended on a missed day doesn't use it up — only finishing does
    // (a still-running card is caught below).
    const usedUp = (before ?? []).some((a) => Number(a.required_filled) >= campaign.duration_days);
    if (usedUp) throw new Error(`You've already finished ${campaign.title} — pick another Bingo.`);
  }

  const created = await parseForfeitCommitmentCreatedFromTx(txHash);
  if (!created || created.creator !== wallet) throw new Error("That stake isn't from your wallet.");
  const onChainId = Number(created.commitmentId);

  const { data: existing } = await admin.from("bingo_attempts").select("id").eq("forfeit_commitment_id", onChainId).maybeSingle();
  if (existing) return existing.id as string;

  const c = await readCommitment(onChainId);
  // The stake picks the tier (7-day Bingos offer 1,000 / 2,000 / 3,000 G$).
  const tier = v.tiers.find((t) => c.stake === parseUnits(String(t.stake), 18));
  const ok =
    !!tier &&
    c.creator === wallet &&
    c.token === GOODDOLLAR_ADDRESSES.mainnet.toLowerCase() &&
    c.destinationType === COMMUNITY_POOL_DESTINATION &&
    c.cadence === DAILY_CADENCE &&
    c.periodSeconds === DAY_MS / 1000 &&
    c.totalPeriods === campaign.duration_days &&
    // No verifier (the player signs each day) or Delulu's server (cards from 20 Nov, until the player takes the role).
    (c.verifier === "0x0000000000000000000000000000000000000000" || c.verifier === keeperAddress()) &&
    c.active;
  if (!ok || !tier) throw new Error("That stake doesn't match this Bingo's terms.");

  const { data: goal } = await admin
    .from("forfeit_commitments")
    .select("id")
    .eq("on_chain_commitment_id", onChainId)
    .maybeSingle();
  if (!goal) throw new Error("Your stake is still syncing. Try again in a moment.");

  // An earlier card that's over (finished or a missed day) is closed before the new one.
  const { data: open } = await admin
    .from("bingo_attempts")
    .select("id, started_at, ends_at, required_filled")
    .eq("campaign_id", campaign.id)
    .is("cycle_id", null)
    .eq("wallet", wallet)
    .eq("status", "active");
  for (const a of open ?? []) {
    if (!rollingAttemptOver(a as { started_at: string; ends_at: string; required_filled: number }, campaign.duration_days)) {
      throw new Error("You already have this Bingo going.");
    }
    await finalizeAttempts(admin, campaign, { attemptId: a.id as string });
  }

  const startedAt = Number(created.firstDeadline) * 1000 - DAY_MS;
  const { data, error } = await admin
    .from("bingo_attempts")
    .insert({
      campaign_id: campaign.id,
      version_id: v.id,
      cycle_id: null,
      tier_key: tier.key,
      wallet,
      stake_amount: tier.stake,
      forfeit_commitment_id: onChainId,
      join_tx: txHash.toLowerCase(),
      started_at: new Date(startedAt).toISOString(),
      ends_at: new Date(startedAt + campaign.duration_days * DAY_MS).toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    await logBingoEvent(admin, { campaignId: campaign.id, kind: "rolling_start_failed", ok: false, detail: `${wallet}: ${error.message}` });
    throw new Error(error.code === "23505" ? "You already have this Bingo going." : error.message);
  }
  await logBingoEvent(admin, { campaignId: campaign.id, kind: "rolling_started", detail: `${wallet} commitment ${onChainId}` });
  // Staking on a Bingo card is a qualifying referral action — credit the referrer now.
  void evaluateAndCreditReferral(admin, wallet).catch((err) => console.error("[bingo/start] referral check failed", err));
  return data.id as string;
}

/** On-chain id → forfeit_commitments row of a Bingo attempt (its proofs and rewards run as that goal). */
export async function bingoAttemptForCommitment(admin: Admin, onChainCommitmentId: number) {
  const { data } = await admin
    .from("bingo_attempts")
    .select("id, campaign_id, bingo_campaigns(slug)")
    .eq("forfeit_commitment_id", onChainCommitmentId)
    .maybeSingle();
  return data;
}
