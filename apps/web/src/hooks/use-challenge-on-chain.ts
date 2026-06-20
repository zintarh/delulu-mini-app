"use client";

import { useReadContract, useChainId } from "wagmi";
import { formatUnits, zeroAddress } from "viem";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

type ChallengeTuple = readonly [
  bigint,
  string,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
];

function parseChallengeTuple(data: unknown) {
  if (!data || !Array.isArray(data)) return null;
  const row = data as unknown as ChallengeTuple;
  const id = row[0];
  if (id === 0n) return null;
  return {
    id: Number(id),
    poolAmountWei: row[2],
    poolAmount: parseFloat(formatUnits(row[2], 18)),
    startTime: Number(row[3]),
    duration: Number(row[4]),
    totalPoints: Number(row[5]),
    active: Boolean(row[6]),
  };
}

export function useChallengeOnChain(challengeId: number | null) {
  const chainId = useChainId();
  const contractAddress = getDeluluContractAddress(chainId);
  const { address } = useAuth();
  const { isAdmin } = useIsAdmin();

  const {
    data,
    isLoading: isLoadingChallenge,
    error,
    refetch: refetchChallenge,
  } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "challenges",
    args: challengeId !== null ? [BigInt(challengeId)] : undefined,
    chainId,
    query: { enabled: challengeId !== null },
  });

  const {
    data: funderRaw,
    isLoading: isLoadingFunder,
    refetch: refetchFunder,
  } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "challengeFunder",
    args: challengeId !== null ? [BigInt(challengeId)] : undefined,
    chainId,
    query: { enabled: challengeId !== null },
  });

  const challenge = parseChallengeTuple(data);
  const funderAddress =
    typeof funderRaw === "string" && funderRaw.toLowerCase() !== zeroAddress
      ? funderRaw
      : null;

  const isLegacyFunder = !funderAddress && isAdmin;
  const canWithdrawAsFunder =
    !!address &&
    ((funderAddress &&
      address.toLowerCase() === funderAddress.toLowerCase()) ||
      isLegacyFunder);

  const isEnded =
    !!challenge &&
    Date.now() / 1000 > challenge.startTime + challenge.duration;

  return {
    challenge,
    funderAddress,
    isLegacyFunder,
    canWithdrawAsFunder,
    isLoading: isLoadingChallenge || isLoadingFunder,
    error,
    refetch: async () => {
      await Promise.all([refetchChallenge(), refetchFunder()]);
    },
    canRefund:
      canWithdrawAsFunder &&
      isEnded &&
      !!challenge &&
      challenge.poolAmountWei > 0n,
    isRefunded: !!challenge && challenge.poolAmountWei === 0n,
  };
}
