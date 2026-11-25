"use client";

import { useCallback } from "react";
import { usePublicClient, useReadContracts } from "wagmi";
import { formatUnits, keccak256, toHex, zeroAddress } from "viem";
import { REWARD_VAULT_ABI } from "@/lib/abi/reward-vault";
import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES, getRewardVaultAddress } from "@/lib/constant";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

const VAULT = (() => {
  try {
    return getRewardVaultAddress(CELO_MAINNET_ID);
  } catch {
    return undefined;
  }
})();
const G = GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`;

/** Purchase kinds, as the vault's `kind` (keccak256 of the name). */
export const PURCHASE = {
  STREAK_FREEZE: keccak256(toHex("STREAK_FREEZE")),
} as const;

/**
 * G$ a player holds inside the RewardVault (v3): stake-only credit (welcome
 * gift, referrals) and unclaimed rewards. Both can be staked straight from the
 * vault — no wallet G$ and no approval needed. `live` is false before the v3
 * upgrade (stakeCredit doesn't exist yet), and then everything reads 0.
 */
export function useVaultFunds(address: `0x${string}` | undefined) {
  const { data, refetch, isLoading } = useReadContracts({
    allowFailure: true,
    query: { enabled: !!VAULT && !!address, staleTime: 15_000 },
    contracts: address && VAULT
      ? [
          { address: VAULT, abi: REWARD_VAULT_ABI, functionName: "stakeCredit", args: [address, G], chainId: CELO_MAINNET_ID },
          { address: VAULT, abi: REWARD_VAULT_ABI, functionName: "pendingReward", args: [address, G], chainId: CELO_MAINNET_ID },
        ]
      : [],
  });
  const credit = data?.[0]?.status === "success" ? Number(formatUnits(data[0].result as bigint, 18)) : 0;
  const rewards = data?.[1]?.status === "success" ? Number(formatUnits(data[1].result as bigint, 18)) : 0;
  const live = data?.[0]?.status === "success";
  return { live, credit, rewards, total: credit + rewards, refetch, isLoading };
}

export type VaultStakeInput = {
  stakeAmountWei: bigint;
  /** Allow unclaimed rewards to cover what credit doesn't (a rollover). */
  useRewards: boolean;
  destinationType: number;
  cadence: number;
  totalPeriods: number;
  periodSeconds: number;
  firstDeadline: number;
  verifier?: `0x${string}`;
};

/** Stake from the vault (credit first, then rewards) and wait until it's mined. */
export function useVaultStake() {
  const publicClient = usePublicClient({ chainId: CELO_MAINNET_ID });
  const { writeContractAsync } = useUnifiedWriteContract();

  const stakeFromVaultAndWait = useCallback(
    async (i: VaultStakeInput): Promise<`0x${string}`> => {
      if (!VAULT) throw new Error("Rewards aren't available right now.");
      const hash = await writeContractAsync({
        address: VAULT,
        abi: REWARD_VAULT_ABI,
        functionName: "stakeFromVault",
        args: [G, i.stakeAmountWei, i.useRewards, i.destinationType, zeroAddress, i.cadence, i.totalPeriods, BigInt(i.periodSeconds), BigInt(i.firstDeadline), i.verifier ?? zeroAddress],
      });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success") throw new Error("Staking didn't go through. Nothing was taken — try again.");
      return hash;
    },
    [publicClient, writeContractAsync],
  );

  /** Pay G$ from the wallet into the pot for something in the app (approve + purchase). */
  const purchaseAndWait = useCallback(
    async (amountWei: bigint, kind: `0x${string}`, ref: `0x${string}`): Promise<`0x${string}`> => {
      if (!VAULT) throw new Error("Not available right now.");
      const approve = await writeContractAsync({
        address: G,
        abi: [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] }],
        functionName: "approve",
        args: [VAULT, amountWei],
      });
      await publicClient!.waitForTransactionReceipt({ hash: approve, timeout: 120_000 });
      const hash = await writeContractAsync({ address: VAULT, abi: REWARD_VAULT_ABI, functionName: "purchase", args: [G, amountWei, kind, ref] });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success") throw new Error("Payment didn't go through. Nothing was taken — try again.");
      return hash;
    },
    [publicClient, writeContractAsync],
  );

  /** Cheer another player with G$ (approve + cheer); they get it minus the pot's cut. */
  const cheerAndWait = useCallback(
    async (to: `0x${string}`, amountWei: bigint, ref: `0x${string}`): Promise<`0x${string}`> => {
      if (!VAULT) throw new Error("Not available right now.");
      const approve = await writeContractAsync({
        address: G,
        abi: [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] }],
        functionName: "approve",
        args: [VAULT, amountWei],
      });
      await publicClient!.waitForTransactionReceipt({ hash: approve, timeout: 120_000 });
      const hash = await writeContractAsync({ address: VAULT, abi: REWARD_VAULT_ABI, functionName: "cheer", args: [to, G, amountWei, ref] });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success") throw new Error("The cheer didn't go through. Nothing was taken — try again.");
      return hash;
    },
    [publicClient, writeContractAsync],
  );

  return { stakeFromVaultAndWait, purchaseAndWait, cheerAndWait };
}
