import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import {
  DELULU_CHAIN_ID,
  getCommunityMarketV1Address,
  getForfeitMarketAddress,
  getSubgraphUrlForChain,
} from "@/lib/constant";
import { isCampaignExpired } from "@/lib/community/campaign-types";
import { parseCommunityMilestoneProofSubmittedFromTx } from "@/lib/dashboard/parse-challenge-tx";
import { parseProofSubmittedFromTx } from "@/lib/dashboard/parse-forfeit-tx";
import { engineRewardId } from "@/lib/celo/reward-vault-payout";
import { recordApprovedProof } from "@/lib/proof-reward/grant";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import { loadRewardsConfig } from "@/lib/rewards/config";
import { processPayout, reserveReward, type PayoutStatus } from "@/lib/rewards/ledger";
import {
  addDays,
  campaignCompletionDedupeKey,
  completionAmountFor,
  dailyProofDedupeKey,
  decideSlotRelease,
  goalCompletionDedupeKey,
  isCategoryEnabled,
  isoWeekKey,
  owedMilestoneIds,
  proratedCompletionAmount,
  rewardDayFor,
  weekBounds,
  weeklyConsistencyDedupeKey,
  type GoalKind,
  type GoalState,
  type RewardsConfig,
} from "@/lib/rewards/rules";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const CELO_RPC =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.CELO_RPC_URL ??
  "https://forno.celo.org";

const publicClient = createPublicClient({ chain: celo, transport: http(CELO_RPC) });

/** What happened to one reward category for this proof. */
export type RewardOutcome =
  | { result: "paid" | "in_flight" | "queued" | "failed"; amount: number; payoutStatus: PayoutStatus }
  | {
      result: "daily_limit" | "goal_limit" | "goal_released" | "not_reached" | "not_complete" | "no_tier" | "legacy" | "disabled";
    };

export type ProofRewardsResult =
  | { status: "disabled" }
  | { status: "not_eligible"; reason: string }
  | { status: "self_verified" }
  /** Word-only Forfeit goal (no money staked): earns points, never G$. */
  | { status: "no_stake" }
  | { status: "awaiting_verifier" }
  | { status: "not_verified" }
  | {
      status: "processed";
      wallet: string;
      day: string;
      daily: RewardOutcome;
      weekly: RewardOutcome;
      completion: RewardOutcome;
    };

type VerifiedProof = {
  wallet: string;
  proofRowId: string;
  /** Status of the proof_rewards row — anything but 'approved' was handled by the retired 10 G$ scheme. */
  legacyStatus: string;
  goalKind: GoalKind;
  /** campaign: community_campaigns.id · forfeit: forfeit_commitments.id */
  goalRef: string;
};

type Rejection = Exclude<ProofRewardsResult, { status: "processed" }>;

/**
 * Re-derives who submitted what from the on-chain proof tx (never trusts the
 * caller) and finds the approval that proves this exact proof was reviewed:
 * the AI verdict row, or — for friend-verified forfeits — the friend's
 * on-chain approval. Self-verified goals never earn (the creator would be
 * approving their own photo).
 */
async function resolveVerifiedProof(
  admin: SupabaseAdmin,
  kind: GoalKind,
  proofTxHash: `0x${string}`,
): Promise<VerifiedProof | Rejection> {
  if (kind === "campaign") {
    const event = await parseCommunityMilestoneProofSubmittedFromTx(proofTxHash);
    if (!event) return { status: "not_eligible", reason: "proof_not_found" };
    const { data: row } = await admin
      .from("proof_rewards")
      .select("id, status, ref_id")
      .eq("wallet", event.participant)
      .eq("proof_url", event.proofLink)
      .eq("kind", "campaign")
      .maybeSingle();
    if (!row?.ref_id) return { status: "not_eligible", reason: "not_reviewed" };
    // The approval was for one campaign; the contract accepts any link, so
    // make sure it was submitted to that same campaign.
    const { data: campaign } = await admin
      .from("community_campaigns")
      .select("id, on_chain_challenge_id")
      .eq("id", row.ref_id)
      .maybeSingle();
    if (!campaign || String(campaign.on_chain_challenge_id) !== event.challengeId.toString()) {
      return { status: "not_eligible", reason: "campaign_mismatch" };
    }
    return {
      wallet: event.participant,
      proofRowId: row.id as string,
      legacyStatus: row.status as string,
      goalKind: "campaign",
      goalRef: campaign.id as string,
    };
  }

  const event = await parseProofSubmittedFromTx(proofTxHash);
  if (!event) return { status: "not_eligible", reason: "proof_not_found" };

  const { data: commitment } = await admin
    .from("forfeit_commitments")
    .select("id, verification_method, stake_amount_wei::text")
    .eq("on_chain_commitment_id", Number(event.commitmentId))
    .maybeSingle();
  if (!commitment) return { status: "not_eligible", reason: "commitment_not_found" };
  if (commitment.verification_method === "self") return { status: "self_verified" };
  if (!(await hasMoneyStake(commitment.stake_amount_wei, event.commitmentId))) return { status: "no_stake" };

  if (commitment.verification_method === "friend") {
    const { data: period } = await admin
      .from("forfeit_periods")
      .select("verifier_action")
      .eq("commitment_id", commitment.id)
      .eq("period_index", event.periodIndex)
      .maybeSingle();
    if (period?.verifier_action !== "approved") return { status: "awaiting_verifier" };
    await recordApprovedProof(admin, {
      wallet: event.creator,
      kind: "forfeit",
      proofUrl: event.proofLink,
      refId: commitment.id,
    });
  }

  const { data: row } = await admin
    .from("proof_rewards")
    .select("id, status")
    .eq("wallet", event.creator)
    .eq("proof_url", event.proofLink)
    .eq("kind", "forfeit")
    .maybeSingle();
  if (!row) return { status: "not_eligible", reason: "not_reviewed" };
  return {
    wallet: event.creator,
    proofRowId: row.id as string,
    legacyStatus: row.status as string,
    goalKind: "forfeit",
    goalRef: commitment.id as string,
  };
}

/**
 * Whether a Forfeit goal has money on the line. Word pledges (stake 0) earn
 * points only — G$ rewards are for people who put money behind their goal.
 * Uses the stake snapshot from confirm-create; older rows without one are
 * read from the contract.
 */
async function hasMoneyStake(snapshotWei: string | null | undefined, onChainId: bigint | number | string): Promise<boolean> {
  if (snapshotWei != null && snapshotWei !== "") {
    try {
      return BigInt(snapshotWei) > BigInt(0);
    } catch {
      // fall through to the chain
    }
  }
  const c = (await publicClient.readContract({
    address: getForfeitMarketAddress(DELULU_CHAIN_ID),
    abi: FORFEIT_MARKET_ABI,
    functionName: "commitments",
    args: [BigInt(onChainId)],
  })) as readonly unknown[];
  return (c[2] as bigint) > BigInt(0);
}

/** The proof's own block day — a retry tomorrow still counts toward the day it was submitted. */
async function proofTxDay(txHash: `0x${string}`, timeZone: string): Promise<string> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
  return rewardDayFor(new Date(Number(block.timestamp) * 1000), timeZone);
}

// ── Goal slots ──────────────────────────────────────────────────────────────

async function goalStates(
  admin: SupabaseAdmin,
  wallet: string,
  slots: { goal_kind: GoalKind; goal_ref: string }[],
): Promise<Map<string, GoalState>> {
  const states = new Map<string, GoalState>();
  const forfeitRefs = slots.filter((s) => s.goal_kind === "forfeit").map((s) => s.goal_ref);
  const campaignRefs = slots.filter((s) => s.goal_kind === "campaign").map((s) => s.goal_ref);

  if (forfeitRefs.length > 0) {
    const { data } = await admin.from("forfeit_commitments").select("id, status").in("id", forfeitRefs);
    for (const c of data ?? []) {
      const state: GoalState =
        c.status === "completed"
          ? "completed"
          : c.status === "forfeited" || c.status === "cancelled"
            ? "abandoned"
            : "active";
      states.set(`forfeit:${c.id}`, state);
    }
  }

  if (campaignRefs.length > 0) {
    const [{ data: campaigns }, { data: participants }] = await Promise.all([
      admin
        .from("community_campaigns")
        .select("id, status, display_ends_at, created_at, duration_days")
        .in("id", campaignRefs),
      admin
        .from("campaign_participants")
        .select("campaign_id, status")
        .eq("wallet_address", wallet)
        .in("campaign_id", campaignRefs),
    ]);
    const participantStatus = new Map((participants ?? []).map((p) => [p.campaign_id as string, p.status as string]));
    for (const c of campaigns ?? []) {
      const status = participantStatus.get(c.id as string);
      // Leaving is the user's choice (abandoned); the campaign running out is not (completed).
      const state: GoalState =
        status === "left" || status === "withdrawn"
          ? "abandoned"
          : c.status === "ended" || c.status === "rejected" || isCampaignExpired(c)
            ? "completed"
            : "active";
      states.set(`campaign:${c.id}`, state);
    }
  }
  return states;
}

/**
 * Frees slots whose goal is over, before a new proof asks for one. The goal
 * this proof belongs to is skipped: its proof shows it was live that day,
 * even if (say) the final proof just marked it completed.
 */
async function releaseEndedSlots(
  admin: SupabaseAdmin,
  wallet: string,
  config: RewardsConfig,
  skip: { kind: GoalKind; ref: string },
): Promise<void> {
  const { data: held } = await admin
    .from("reward_goal_slots")
    .select("id, goal_kind, goal_ref, last_active_day")
    .eq("wallet", wallet)
    .is("released_at", null);
  const slots = (held ?? []).filter((s) => !(s.goal_kind === skip.kind && s.goal_ref === skip.ref)) as {
    id: string;
    goal_kind: GoalKind;
    goal_ref: string;
    last_active_day: string;
  }[];
  if (slots.length === 0) return;

  const today = rewardDayFor(new Date(), config.timezone);
  const states = await goalStates(admin, wallet, slots);
  for (const slot of slots) {
    const decision = decideSlotRelease({
      state: states.get(`${slot.goal_kind}:${slot.goal_ref}`) ?? "unknown",
      lastActiveDay: slot.last_active_day,
      today,
      config: config.dailyProof,
    });
    if (!decision.release) continue;
    const { error } = await admin
      .from("reward_goal_slots")
      .update({
        released_at: new Date().toISOString(),
        released_day: today,
        release_reason: decision.reason,
        cooldown_until: decision.cooldownUntilDay,
      })
      .eq("id", slot.id)
      .is("released_at", null);
    if (error) console.error(`[rewards] slot release ${slot.id} failed`, error);
  }
}

// ── Payout helper ───────────────────────────────────────────────────────────

/** Sends a reserved reward within whatever request time is left; anything not finished is left to the cron. */
async function pay(
  admin: SupabaseAdmin,
  payoutId: string,
  amount: number,
  status: PayoutStatus,
  deadline: number,
): Promise<RewardOutcome> {
  let payoutStatus = status;
  const remaining = deadline - Date.now();
  if ((status === "pending" || status === "failed") && remaining > 5_000) {
    try {
      payoutStatus = await processPayout(admin, payoutId, { waitMs: Math.min(25_000, remaining - 3_000) });
    } catch (err) {
      console.error(`[rewards] payout ${payoutId} errored`, err);
    }
  }
  const result =
    payoutStatus === "confirmed"
      ? "paid"
      : payoutStatus === "submitted" || payoutStatus === "processing"
        ? "in_flight"
        : payoutStatus === "failed"
          ? "failed"
          : "queued";
  return { result, amount, payoutStatus };
}

// ── Categories ──────────────────────────────────────────────────────────────

async function evaluateDaily(
  admin: SupabaseAdmin,
  proof: VerifiedProof,
  day: string,
  config: RewardsConfig,
  deadline: number,
): Promise<RewardOutcome> {
  if (!isCategoryEnabled(config, "daily_proof")) return { result: "disabled" };
  const dedupeKey = dailyProofDedupeKey(proof.wallet, proof.goalKind, proof.goalRef, day);
  const amount = config.dailyProof.amount;
  const { data, error } = await admin.rpc("reserve_daily_proof_reward", {
    p_wallet: proof.wallet,
    p_goal_kind: proof.goalKind,
    p_goal_ref: proof.goalRef,
    p_day: day,
    p_amount: amount,
    p_max_goals: config.dailyProof.maxEligibleGoals,
    p_dedupe_key: dedupeKey,
    p_reward_id: engineRewardId(dedupeKey),
    p_source_proof_id: proof.proofRowId,
  });
  if (error) throw new Error(`[rewards] daily reservation: ${error.message}`);
  const res = data as { outcome: string; payout_id?: string; status?: PayoutStatus };
  if (res.outcome === "reserved" || res.outcome === "exists") {
    return pay(admin, res.payout_id!, amount, res.status ?? "pending", deadline);
  }
  return { result: res.outcome as "daily_limit" | "goal_limit" | "goal_released" };
}

/**
 * 250 G$ once per user per Mon–Sun week, after `minProofs` proofs that each
 * earned a daily reward that week. Counting daily-rewarded proofs (rather
 * than every proof) means extra goals or several proofs in one sitting can't
 * stand in for showing up on several days.
 */
export async function evaluateWeekly(
  admin: SupabaseAdmin,
  wallet: string,
  day: string,
  config: RewardsConfig,
  deadline: number,
): Promise<RewardOutcome> {
  if (!isCategoryEnabled(config, "weekly_consistency")) return { result: "disabled" };
  const { start, end } = weekBounds(day);
  const { count, error } = await admin
    .from("reward_payouts")
    .select("id", { count: "exact", head: true })
    .eq("wallet", wallet)
    .eq("category", "daily_proof")
    .gte("reward_day", start)
    .lte("reward_day", end);
  if (error) throw new Error(`[rewards] weekly count: ${error.message}`);
  if ((count ?? 0) < config.weeklyConsistency.minProofs) return { result: "not_reached" };

  const weekKey = isoWeekKey(day);
  const dedupeKey = weeklyConsistencyDedupeKey(wallet, weekKey);
  const amount = config.weeklyConsistency.amount;
  const reserved = await reserveReward(admin, {
    wallet,
    category: "weekly_consistency",
    amount,
    dedupeKey,
    rewardId: engineRewardId(dedupeKey),
    periodKey: weekKey,
    rewardDay: start,
    metadata: { qualifyingProofs: count, weekStart: start, weekEnd: end },
  });
  return pay(admin, reserved.id, amount, reserved.status, deadline);
}

const CAMPAIGN_PROGRESS_QUERY = `
  query RewardCampaignProgress($challengeId: BigInt!, $address: String!) {
    communityCampaignMilestones(where: { challengeId: $challengeId }, first: 500) {
      milestoneId
      deadline
    }
    communityCampaignParticipants(where: { challengeId: $challengeId, participantAddress: $address }, first: 1) {
      joinedAt
    }
    communityCampaignMilestoneCompletions(
      where: { challengeId: $challengeId, participantAddress: $address }
      first: 500
    ) {
      milestoneId
      proofLink
    }
  }
`;

async function fetchCampaignProgress(challengeId: string, wallet: string) {
  const url = getSubgraphUrlForChain(DELULU_CHAIN_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  if (!url) throw new Error("Subgraph URL not configured");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: CAMPAIGN_PROGRESS_QUERY, variables: { challengeId, address: wallet } }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "Subgraph query failed");
  const data = json.data ?? {};
  const joinedAt = data.communityCampaignParticipants?.[0]?.joinedAt;
  return {
    milestones: ((data.communityCampaignMilestones ?? []) as { milestoneId: string; deadline: string }[]).map((m) => ({
      id: Number(m.milestoneId),
      deadlineSec: Number(m.deadline),
    })),
    joinedAtSec: joinedAt != null ? Number(joinedAt) : null,
    completions: (data.communityCampaignMilestoneCompletions ?? []) as { milestoneId: string; proofLink: string }[],
  };
}

/**
 * Completion reward for a campaign: every milestone the user was there for
 * done on-chain AND each of those proofs approved in review — the contract
 * alone accepts any link, so on-chain completion isn't a verified event by
 * itself. Amount by the campaign's length (tiers); a late joiner gets
 * tier × share^lateJoinExponent, share = milestones open to them / all.
 * Once per wallet per campaign, ever.
 */
export async function evaluateCampaignCompletion(
  admin: SupabaseAdmin,
  wallet: string,
  campaignId: string,
  config: RewardsConfig,
  deadline: number,
): Promise<RewardOutcome> {
  const dedupeKey = campaignCompletionDedupeKey(wallet, campaignId);
  const { data: existing } = await admin
    .from("reward_payouts")
    .select("id, amount, status")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existing) return pay(admin, existing.id as string, Number(existing.amount), existing.status as PayoutStatus, deadline);
  if (!isCategoryEnabled(config, "campaign_completion")) return { result: "disabled" };

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("id, duration_days, on_chain_challenge_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign?.on_chain_challenge_id) return { result: "not_complete" };
  const durationDays = Number(campaign.duration_days);
  const fullAmount = completionAmountFor(durationDays, config.campaignCompletion.tiers);
  if (fullAmount <= 0) return { result: "no_tier" };

  const challengeId = BigInt(campaign.on_chain_challenge_id);
  const milestoneCount = Number(
    (await publicClient.readContract({
      address: getCommunityMarketV1Address(DELULU_CHAIN_ID),
      abi: COMMUNITY_CAMPAIGN_ABI,
      functionName: "campaignMilestoneCount",
      args: [challengeId],
    })) as bigint,
  );
  if (milestoneCount === 0) return { result: "not_complete" };

  // If the subgraph hasn't indexed every milestone or the last proof yet,
  // this reads as not complete and the cron sweep retries shortly.
  const progress = await fetchCampaignProgress(challengeId.toString(), wallet);
  if (progress.milestones.length < milestoneCount) return { result: "not_complete" };
  const owed = owedMilestoneIds(progress.milestones, progress.joinedAtSec);
  const linkByMilestone = new Map(progress.completions.map((c) => [Number(c.milestoneId), c.proofLink]));
  if (owed.length === 0 || owed.some((id) => !linkByMilestone.has(id))) return { result: "not_complete" };

  const links = [...new Set(owed.map((id) => linkByMilestone.get(id)!))];
  if (links.length < owed.length) return { result: "not_complete" }; // one proof reused for several milestones
  const { data: approved, error } = await admin
    .from("proof_rewards")
    .select("proof_url")
    .eq("wallet", wallet)
    .eq("kind", "campaign")
    .eq("ref_id", campaignId)
    .in("proof_url", links);
  if (error) throw new Error(`[rewards] completion approvals: ${error.message}`);
  if ((approved?.length ?? 0) < links.length) return { result: "not_complete" };

  const share = owed.length / milestoneCount;
  const amount = proratedCompletionAmount(fullAmount, share, config.campaignCompletion.lateJoinExponent);
  if (amount <= 0) return { result: "no_tier" };

  const reserved = await reserveReward(admin, {
    wallet,
    category: "campaign_completion",
    amount,
    dedupeKey,
    rewardId: engineRewardId(dedupeKey),
    goalKind: "campaign",
    goalRef: campaignId,
    periodKey: campaignId,
    rewardDay: rewardDayFor(new Date(), config.timezone),
    metadata: { durationDays, milestoneCount, owedMilestones: owed.length, fullAmount, share },
  });
  return pay(admin, reserved.id, amount, reserved.status, deadline);
}

/** PeriodOutcome.Success in ForfeitMarket.sol. */
const PERIOD_OUTCOME_SUCCESS = 1;

/** Daily-rewarded proofs for one Forfeit goal: engine rows plus paid proofs from the retired 10 G$ scheme. */
export async function countRewardedGoalProofs(admin: SupabaseAdmin, wallet: string, commitmentId: string) {
  const [{ count: engine }, { count: legacy }] = await Promise.all([
    admin
      .from("reward_payouts")
      .select("id", { count: "exact", head: true })
      .eq("wallet", wallet)
      .eq("category", "daily_proof")
      .eq("goal_kind", "forfeit")
      .eq("goal_ref", commitmentId),
    admin
      .from("proof_rewards")
      .select("id", { count: "exact", head: true })
      .eq("wallet", wallet)
      .eq("kind", "forfeit")
      .eq("ref_id", commitmentId)
      .eq("status", "sent"),
  ]);
  return (engine ?? 0) + (legacy ?? 0);
}

/**
 * Completion bonus for a Forfeit goal: every period succeeded on-chain (one
 * miss forfeits the whole goal, so a completed goal has no misses). Amount
 * by the goal's length (goalCompletion tiers) × share^shareExponent, where
 * share = the goal's daily-rewarded proofs / its periods. Only goals that
 * ran in one of the user's earning slots get rewarded proofs, so finishing
 * five goals at once pays at most the two that were slotted. Self-verified
 * goals never earn. Once per goal, ever.
 */
export async function evaluateGoalCompletion(
  admin: SupabaseAdmin,
  wallet: string,
  commitmentId: string,
  config: RewardsConfig,
  deadline: number,
): Promise<RewardOutcome> {
  const dedupeKey = goalCompletionDedupeKey(wallet, commitmentId);
  const { data: existing } = await admin
    .from("reward_payouts")
    .select("id, amount, status")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existing) return pay(admin, existing.id as string, Number(existing.amount), existing.status as PayoutStatus, deadline);
  if (!isCategoryEnabled(config, "goal_completion")) return { result: "disabled" };

  // Cheap DB checks first — most proofs aren't a goal's last.
  const { data: commitment } = await admin
    .from("forfeit_commitments")
    .select("id, status, verification_method, on_chain_commitment_id, creator_wallet, stake_amount_wei::text")
    .eq("id", commitmentId)
    .maybeSingle();
  if (
    !commitment ||
    commitment.status !== "completed" ||
    commitment.verification_method === "self" ||
    commitment.on_chain_commitment_id == null ||
    String(commitment.creator_wallet).toLowerCase() !== wallet
  ) {
    return { result: "not_complete" };
  }

  const market = getForfeitMarketAddress(DELULU_CHAIN_ID);
  const onChainId = BigInt(commitment.on_chain_commitment_id);
  // Word pledges never earn G$ (normally they have no rewarded proofs anyway; this guards legacy ones).
  if (!(await hasMoneyStake(commitment.stake_amount_wei, onChainId))) return { result: "not_complete" };
  const c = (await publicClient.readContract({
    address: market,
    abi: FORFEIT_MARKET_ABI,
    functionName: "commitments",
    args: [onChainId],
  })) as readonly unknown[];
  // creator, token, stakeAmount, destinationType, destinationAddr, cadence,
  // periodSeconds, currentPeriodDeadline, currentPeriodIndex, totalPeriods,
  // verifier, active, cancelled
  const periodSeconds = Number(c[6] as bigint);
  const totalPeriods = Number(c[9]);
  const active = c[11] as boolean;
  const cancelled = c[12] as boolean;
  if (active || cancelled || totalPeriods <= 0) return { result: "not_complete" };
  const lastOutcome = Number(
    await publicClient.readContract({
      address: market,
      abi: FORFEIT_MARKET_ABI,
      functionName: "periodOutcome",
      args: [onChainId, totalPeriods - 1],
    }),
  );
  if (lastOutcome !== PERIOD_OUTCOME_SUCCESS) return { result: "not_complete" };

  const durationDays = Math.round((totalPeriods * periodSeconds) / 86_400);
  const fullAmount = completionAmountFor(durationDays, config.goalCompletion.tiers);
  if (fullAmount <= 0) return { result: "no_tier" };

  const rewardedProofs = await countRewardedGoalProofs(admin, wallet, commitmentId);
  const share = rewardedProofs / totalPeriods;
  const amount = proratedCompletionAmount(fullAmount, share, config.goalCompletion.shareExponent);
  if (amount <= 0) return { result: "no_tier" };

  const reserved = await reserveReward(admin, {
    wallet,
    category: "goal_completion",
    amount,
    dedupeKey,
    rewardId: engineRewardId(dedupeKey),
    goalKind: "forfeit",
    goalRef: commitmentId,
    periodKey: commitmentId,
    rewardDay: rewardDayFor(new Date(), config.timezone),
    metadata: { durationDays, totalPeriods, rewardedProofs, fullAmount, share },
  });
  return pay(admin, reserved.id, amount, reserved.status, deadline);
}

/**
 * The Rewards Engine's entry point for one on-chain proof. Safe to call any
 * number of times for the same tx (client retries, friend approval, cron):
 * every reward has a unique dedupe key and an on-chain rewardId derived from
 * it, so each is reserved and paid at most once.
 *
 * Only verified events count: the proof must be reviewed (AI or friend) and
 * submitted on-chain, the wallet must be GoodDollar face-verified, and the
 * goal can't be self-verified or a word-only pledge (no money staked).
 */
export async function processVerifiedProof(
  admin: SupabaseAdmin,
  params: { kind: GoalKind; proofTxHash: `0x${string}` },
  opts: { budgetMs?: number } = {},
): Promise<ProofRewardsResult> {
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  const config = await loadRewardsConfig(admin);
  if (!config.enabled) return { status: "disabled" };

  const proofTxHash = params.proofTxHash.toLowerCase() as `0x${string}`;
  const resolved = await resolveVerifiedProof(admin, params.kind, proofTxHash);
  if ("status" in resolved) return resolved;
  const proof = resolved;

  if (!(await isGoodDollarVerified(proof.wallet))) return { status: "not_verified" };

  const day = await proofTxDay(proofTxHash, config.timezone);

  // Mark the approval as matched to its on-chain tx. proof_tx_hash is unique,
  // so the same tx can never stand behind two approvals.
  const { error: verifyError } = await admin
    .from("proof_rewards")
    .update({ proof_tx_hash: proofTxHash, reward_day: day, verified_at: new Date().toISOString() })
    .eq("id", proof.proofRowId)
    .is("verified_at", null);
  if (verifyError) {
    console.error("[rewards] could not mark proof verified", verifyError);
    return { status: "not_eligible", reason: "proof_tx_conflict" };
  }

  // Proofs already handled by the retired 10 G$ scheme don't earn again.
  let daily: RewardOutcome;
  if (proof.legacyStatus !== "approved") {
    daily = { result: "legacy" };
  } else {
    await releaseEndedSlots(admin, proof.wallet, config, { kind: proof.goalKind, ref: proof.goalRef });
    daily = await evaluateDaily(admin, proof, day, config, deadline);
  }

  const weekly = await evaluateWeekly(admin, proof.wallet, day, config, deadline).catch((err) => {
    console.error("[rewards] weekly evaluation failed", err);
    return { result: "not_reached" } as RewardOutcome;
  });

  const evaluateCompletion = proof.goalKind === "campaign" ? evaluateCampaignCompletion : evaluateGoalCompletion;
  const completion = await evaluateCompletion(admin, proof.wallet, proof.goalRef, config, deadline).catch((err) => {
    console.error("[rewards] completion evaluation failed", err);
    return { result: "not_complete" } as RewardOutcome;
  });

  return { status: "processed", wallet: proof.wallet, day, daily, weekly, completion };
}

/**
 * Cron safety net for rewards a crashed or timed-out request never got to:
 * weekly bonuses for this week and last, and completions for campaigns and
 * Forfeit goals with a verified proof in the last few days. Every check is idempotent, so
 * running this often is harmless.
 */
export async function sweepMissedRewards(
  admin: SupabaseAdmin,
  opts: { deadlineMs?: number; maxCompletionChecks?: number } = {},
): Promise<{ weeklyChecked: number; completionChecked: number; granted: number }> {
  const deadline = Date.now() + (opts.deadlineMs ?? 30_000);
  const config = await loadRewardsConfig(admin);
  const out = { weeklyChecked: 0, completionChecked: 0, granted: 0 };
  if (!config.enabled) return out;

  const today = rewardDayFor(new Date(), config.timezone);
  const lastWeekStart = weekBounds(addDays(today, -7)).start;

  const { data: dailyRows, error } = await admin
    .from("reward_payouts")
    .select("wallet, reward_day")
    .eq("category", "daily_proof")
    .gte("reward_day", lastWeekStart)
    .limit(5000);
  if (error) throw new Error(`[rewards] sweep daily rows: ${error.message}`);

  const perWalletWeek = new Map<string, { wallet: string; day: string; count: number }>();
  for (const r of dailyRows ?? []) {
    const key = `${r.wallet}|${isoWeekKey(r.reward_day as string)}`;
    const entry = perWalletWeek.get(key) ?? { wallet: r.wallet as string, day: r.reward_day as string, count: 0 };
    entry.count++;
    perWalletWeek.set(key, entry);
  }
  for (const { wallet, day, count } of perWalletWeek.values()) {
    if (count < config.weeklyConsistency.minProofs || Date.now() > deadline) continue;
    const { data: existing } = await admin
      .from("reward_payouts")
      .select("id")
      .eq("dedupe_key", weeklyConsistencyDedupeKey(wallet, isoWeekKey(day)))
      .maybeSingle();
    if (existing) continue; // open rows are retried by reconcilePayouts
    out.weeklyChecked++;
    // Reserve only; reconcilePayouts sends it within the pool budget.
    const outcome = await evaluateWeekly(admin, wallet, day, config, 0);
    if ("amount" in outcome) out.granted++;
  }

  // Completions (campaigns and Forfeit goals) with a verified proof lately.
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data: recent } = await admin
    .from("proof_rewards")
    .select("wallet, kind, ref_id")
    .gte("verified_at", since)
    .limit(1000);
  const pairs = new Map<string, { wallet: string; kind: GoalKind; ref: string }>();
  for (const r of recent ?? []) {
    if (!r.ref_id) continue;
    pairs.set(`${r.wallet}|${r.kind}|${r.ref_id}`, {
      wallet: r.wallet as string,
      kind: r.kind as GoalKind,
      ref: r.ref_id as string,
    });
  }
  let checks = 0;
  for (const { wallet, kind, ref } of pairs.values()) {
    if (checks >= (opts.maxCompletionChecks ?? 20) || Date.now() > deadline) break;
    const key = kind === "campaign" ? campaignCompletionDedupeKey(wallet, ref) : goalCompletionDedupeKey(wallet, ref);
    const { data: existing } = await admin.from("reward_payouts").select("id").eq("dedupe_key", key).maybeSingle();
    if (existing) continue;
    checks++;
    out.completionChecked++;
    try {
      const evaluate = kind === "campaign" ? evaluateCampaignCompletion : evaluateGoalCompletion;
      const outcome = await evaluate(admin, wallet, ref, config, 0);
      if ("amount" in outcome) out.granted++;
    } catch (err) {
      console.error(`[rewards] completion sweep ${wallet}/${kind}/${ref} failed`, err);
    }
  }
  return out;
}
