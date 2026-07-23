import { parseUnits, type Address, type Hex, getAddress } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMerkleTreeFromLeaves,
  communityPayoutLeaf,
} from "@/lib/community/merkle-payout";

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
