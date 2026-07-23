import { createPublicClient, formatUnits, http, parseUnits, type Address, type Hex, getAddress } from "viem";
import { celo } from "viem/chains";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMerkleTreeFromLeaves,
  communityPayoutLeaf,
} from "@/lib/community/merkle-payout";
import { getCommunityMarketV1Address, DELULU_CHAIN_ID } from "@/lib/constant";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? "https://forno.celo.org"),
});

/**
 * Live on-chain poolAmount, not a DB snapshot of it — the pool grows after
 * creation via fundCommunityChallenge and, since the forfeit feature, via
 * forfeited stake from claimCommunityJoinStake. Building a payout snapshot
 * off a stale DB field would silently exclude any of that from what winners
 * can actually claim.
 */
export async function readOnChainPoolAmountHuman(challengeId: number): Promise<number> {
  const contract = getCommunityMarketV1Address(DELULU_CHAIN_ID);
  const result = await publicClient.readContract({
    address: contract,
    abi: COMMUNITY_CAMPAIGN_ABI,
    functionName: "campaigns",
    args: [BigInt(challengeId)],
  });
  const poolAmountWei = (result as readonly unknown[])[1] as bigint;
  return Number(formatUnits(poolAmountWei, 18));
}

export type PayoutWinnerRow = {
  wallet_address: string;
  points_total: number;
  rank: number;
  amount_wei: string;
};

export type PayoutSnapshot = {
  merkleRoot: Hex;
  totalClaimableWei: string;
  winners: PayoutWinnerRow[];
};

/**
 * Build a pro-rata merkle snapshot for the top N winners (by points).
 * Pool is split among winners with points_total > 0.
 */
export function buildWinnerPayoutSnapshot(input: {
  campaignIdOnChain: number;
  prizeWinnerCount: number;
  poolAmountHuman: number;
  leaderboard: Array<{ wallet_address: string; points_total: number }>;
}): PayoutSnapshot {
  const topN = Math.max(1, input.prizeWinnerCount);
  const winnersRaw = input.leaderboard
    .slice(0, topN)
    .filter((r) => Number(r.points_total) > 0)
    .map((r, i) => ({
      wallet_address: getAddress(r.wallet_address as Address),
      points_total: Number(r.points_total),
      rank: i + 1,
    }));

  if (winnersRaw.length === 0) {
    throw new Error("No winners with points to build a payout snapshot.");
  }
  if (!(input.poolAmountHuman > 0)) {
    throw new Error("Prize pool must be greater than zero.");
  }

  const poolWei = parseUnits(String(input.poolAmountHuman), 18);
  const totalPoints = winnersRaw.reduce((s, w) => s + w.points_total, 0);
  if (totalPoints <= 0) {
    throw new Error("Total points must be greater than zero.");
  }

  // Floor each share; give leftover wei to rank 1 so sum == pool.
  const amounts: bigint[] = [];
  let allocated = 0n;
  for (let i = 0; i < winnersRaw.length; i++) {
    if (i === winnersRaw.length - 1) {
      amounts.push(poolWei - allocated);
    } else {
      const share =
        (poolWei * BigInt(winnersRaw[i]!.points_total)) / BigInt(totalPoints);
      amounts.push(share);
      allocated += share;
    }
  }

  const campaignId = BigInt(input.campaignIdOnChain);
  const leaves: Hex[] = winnersRaw.map((w, i) =>
    communityPayoutLeaf(campaignId, w.wallet_address as Address, amounts[i]!),
  );
  const tree = buildMerkleTreeFromLeaves(leaves);

  const winners: PayoutWinnerRow[] = winnersRaw.map((w, i) => ({
    ...w,
    amount_wei: amounts[i]!.toString(),
  }));

  return {
    merkleRoot: tree.root,
    totalClaimableWei: poolWei.toString(),
    winners,
  };
}

/** Persist snapshot leaves + root on the campaign. Replaces any prior unpublished snapshot. */
export async function persistPayoutSnapshot(
  admin: SupabaseClient,
  campaignUuid: string,
  snapshot: PayoutSnapshot,
): Promise<void> {
  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("community_campaigns")
    .update({
      payout_merkle_root: snapshot.merkleRoot,
      payout_total_claimable_wei: snapshot.totalClaimableWei,
      updated_at: now,
    })
    .eq("id", campaignUuid);

  if (updateError) throw new Error(updateError.message);

  // Replace leaves (keep claimed rows if already claimed — shouldn't happen pre-publish)
  await admin.from("campaign_payout_claims").delete().eq("campaign_id", campaignUuid);

  const rows = snapshot.winners.map((w) => ({
    campaign_id: campaignUuid,
    wallet_address: w.wallet_address.toLowerCase(),
    amount_wei: w.amount_wei,
    rank: w.rank,
    points_total: w.points_total,
  }));

  const { error: insertError } = await admin.from("campaign_payout_claims").insert(rows);
  if (insertError) throw new Error(insertError.message);
}

export function getProofForWinner(input: {
  campaignIdOnChain: number;
  winners: PayoutWinnerRow[];
  wallet: string;
}): { amountWei: bigint; proof: Hex[]; rank: number } | null {
  const idx = input.winners.findIndex(
    (w) => w.wallet_address.toLowerCase() === input.wallet.toLowerCase(),
  );
  if (idx < 0) return null;

  const campaignId = BigInt(input.campaignIdOnChain);
  const leaves = input.winners.map((w) =>
    communityPayoutLeaf(
      campaignId,
      getAddress(w.wallet_address as Address),
      BigInt(w.amount_wei),
    ),
  );
  const tree = buildMerkleTreeFromLeaves(leaves);
  const winner = input.winners[idx]!;
  return {
    amountWei: BigInt(winner.amount_wei),
    proof: tree.getProof(idx),
    rank: winner.rank,
  };
}
