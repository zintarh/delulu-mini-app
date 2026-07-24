"use client";

import { useCallback, useRef, useState } from "react";
import { useChainId, useReadContract, usePublicClient } from "wagmi";
import { encodePacked, keccak256 } from "viem";
import { getRewardVaultAddress, CELO_MAINNET_ID } from "@/lib/constant";
import { REWARD_VAULT_ABI } from "@/lib/abi/reward-vault";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { useAuth } from "@/hooks/use-auth";
import { parseTokenAmount } from "@/lib/token-amounts";

const ERC20_ALLOWANCE_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

function vaultAddressOrUndefined(chainId: number): `0x${string}` | undefined {
  try {
    return getRewardVaultAddress(chainId);
  } catch {
    return undefined;
  }
}

/** Read a user's claimable reward balance for a given token. Pinned to Celo mainnet — same reasoning as useTokenBalance: reads must not silently follow whatever chain the wallet happens to be on. */
export function usePendingReward(userAddress: `0x${string}` | undefined, tokenAddress: `0x${string}` | undefined) {
  const vault = vaultAddressOrUndefined(CELO_MAINNET_ID);

  const { data, isLoading, error, refetch } = useReadContract({
    address: vault,
    abi: REWARD_VAULT_ABI,
    functionName: "pendingReward",
    args: userAddress && tokenAddress ? [userAddress, tokenAddress] : undefined,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!vault && !!userAddress && !!tokenAddress },
  });

  return { pending: (data as bigint | undefined) ?? 0n, isLoading, error, refetch };
}

/** Read the vault's configured owner/rewarder — lets the UI warn before a guaranteed-revert submit. */
export function useRewardVaultRoles() {
  const vault = vaultAddressOrUndefined(CELO_MAINNET_ID);

  const { data: owner } = useReadContract({
    address: vault,
    abi: REWARD_VAULT_ABI,
    functionName: "owner",
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!vault },
  });
  const { data: rewarder } = useReadContract({
    address: vault,
    abi: REWARD_VAULT_ABI,
    functionName: "rewarder",
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!vault },
  });

  return { owner: owner as `0x${string}` | undefined, rewarder: rewarder as `0x${string}` | undefined };
}

async function awaitMinedSuccess(
  publicClient: ReturnType<typeof usePublicClient>,
  hash: `0x${string}`,
  failureMessage: string,
) {
  if (!publicClient) throw new Error("No RPC client available to confirm the transaction");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(failureMessage);
  return receipt;
}

/** User-side claim of their full pending reward balance for a token. */
export function useClaimReward() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: hash, isPending, error, reset } = useUnifiedWriteContract();
  const [isConfirming, setIsConfirming] = useState(false);
  const isRunningRef = useRef(false);

  const claimReward = useCallback(
    async (tokenAddress: `0x${string}`) => {
      if (isRunningRef.current) throw new Error("A claim is already in progress");
      isRunningRef.current = true;
      setIsConfirming(true);
      try {
        const txHash = await writeContractAsync({
          address: getRewardVaultAddress(chainId),
          abi: REWARD_VAULT_ABI,
          functionName: "claimReward",
          args: [tokenAddress],
        });
        await awaitMinedSuccess(publicClient, txHash, "Claim transaction failed on-chain");
        return txHash;
      } finally {
        setIsConfirming(false);
        isRunningRef.current = false;
      }
    },
    [chainId, publicClient, writeContractAsync],
  );

  return {
    claimReward,
    hash,
    isPending: isPending || isConfirming,
    error,
    reset,
  };
}

/**
 * Admin-side reward grant. Handles the ERC20 approval (vault pulls via
 * transferFrom) and derives a one-time rewardId so a retried/duplicated
 * admin action can't double-credit the same grant. Resolves only once the
 * deposit transaction is actually mined and successful — never on a merely
 * signed/broadcast tx, which could still revert on-chain.
 */
export function useDepositReward() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { address: adminAddress } = useAuth();
  const { writeContractAsync, data: hash, isPending, error, reset } = useUnifiedWriteContract();
  const [step, setStep] = useState<"idle" | "checking" | "approving" | "depositing">("idle");
  // Synchronous in-flight guard — `step` is React state and doesn't update
  // until the next render, so a fast double-click could otherwise slip two
  // calls through before either sets step away from "idle".
  const isRunningRef = useRef(false);

  const depositReward = useCallback(
    async (params: {
      userAddress: `0x${string}`;
      tokenAddress: `0x${string}`;
      amount: number;
      decimals?: number;
    }) => {
      if (isRunningRef.current) throw new Error("A reward deposit is already in progress");
      isRunningRef.current = true;
      setStep("checking");

      try {
        const { userAddress, tokenAddress, amount, decimals } = params;
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
        if (!adminAddress) throw new Error("Connect the rewarder wallet first");
        if (!publicClient) throw new Error("No RPC client available to confirm the transaction");

        const vault = getRewardVaultAddress(chainId);
        // Round to the token's own decimal precision — a raw user-typed value
        // with more fractional digits than the token supports (e.g. 7 decimal
        // places for 6-decimal USDT) would otherwise throw inside parseUnits.
        const dec = decimals ?? 18;
        const roundedAmount = Number(amount.toFixed(dec));
        const amountWei = parseTokenAmount(roundedAmount, tokenAddress, dec);

        const allowance = (await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "allowance",
          args: [adminAddress, vault],
        })) as bigint;

        if (allowance < amountWei) {
          setStep("approving");
          const approveHash = await writeContractAsync({
            address: tokenAddress,
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "approve",
            args: [vault, amountWei],
          });
          await awaitMinedSuccess(publicClient, approveHash, "Token approval failed on-chain");
        }

        // Unique per grant: user + token + amount + a random nonce, so identical
        // repeat rewards to the same user don't collide on rewardId.
        const nonce = crypto.randomUUID();
        const rewardId = keccak256(
          encodePacked(
            ["address", "address", "uint256", "string"],
            [userAddress, tokenAddress, amountWei, nonce],
          ),
        );

        setStep("depositing");
        const txHash = await writeContractAsync({
          address: vault,
          abi: REWARD_VAULT_ABI,
          functionName: "depositReward",
          args: [userAddress, tokenAddress, amountWei, rewardId],
        });
        await awaitMinedSuccess(publicClient, txHash, "Deposit transaction failed on-chain");
        return {
          txHash,
          amountWei: amountWei.toString(),
          rewardId,
          vaultAddress: vault,
          senderAddress: adminAddress,
          tokenAddress,
          userAddress,
          amount: roundedAmount,
        };
      } finally {
        setStep("idle");
        isRunningRef.current = false;
      }
    },
    [chainId, publicClient, writeContractAsync, adminAddress],
  );

  return {
    depositReward,
    step,
    hash,
    // `step` stays non-"idle" through approval + deposit + their on-chain
    // confirmation — `isPending` alone would flip false as soon as the wallet
    // returns a signed tx hash, before it's actually mined, letting a caller
    // re-enable its submit button mid-flight.
    isPending: isPending || step !== "idle",
    error,
    reset,
  };
}
