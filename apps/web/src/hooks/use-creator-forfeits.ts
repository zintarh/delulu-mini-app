"use client";

import { useQuery } from "@tanstack/react-query";

export type ForfeitPeriodSnapshot = {
  periodIndex: number;
  proofUrl: string | null;
  verifierAction: string | null;
  resolvedAt: string | null;
};

export type ForfeitFeedItem = {
  id: string;
  onChainCommitmentId: number | null;
  title: string;
  description: string | null;
  evidenceType: string;
  verificationMethod: string;
  status: string;
  createdAt: string;
  creatorWallet: string;
  verifierWallet: string | null;
  /** Creator's profile when I'm the verifier; friend-verifier's profile when I'm the creator. */
  otherPartyUsername: string | null;
  otherPartyPfpUrl: string | null;
  /** Off-chain: CommunityPool forfeits meant for charity vs Delulu. */
  isCharityIntent?: boolean;
  /** Friend destination display — username preferred, else email. */
  destinationFriendUsername?: string | null;
  destinationFriendEmail?: string | null;
  currentPeriod: ForfeitPeriodSnapshot | null;
  /** All known periods (proofs) for this commitment — used for day browsing on repeats. */
  periods?: ForfeitPeriodSnapshot[];
  onChain: {
    stakeAmount: string;
    token: string;
    destinationType?: number;
    destinationAddr?: string | null;
    cadence: string | number;
    periodSeconds?: string;
    totalPeriods: number;
    currentPeriodIndex: number;
    currentPeriodDeadline: string;
    active: boolean;
    cancelled: boolean;
    hasPendingVerifierInvite?: boolean;
  } | null;
};

export const forfeitFeedKeys = {
  creator: (address: string) =>
    ["forfeit", "commitments", "creator", address.toLowerCase()] as const,
  verifier: (address: string) =>
    ["forfeit", "commitments", "verifier", address.toLowerCase()] as const,
  destination: (address: string) =>
    ["forfeit", "commitments", "destination", address.toLowerCase()] as const,
};

async function fetchForfeitFeed(
  address: string,
  role: "creator" | "verifier" | "destination",
): Promise<ForfeitFeedItem[]> {
  const res = await fetch(
    `/api/forfeit/commitments/feed?address=${encodeURIComponent(address)}&role=${role}`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "Failed to load forfeits");
  return (json.items ?? []) as ForfeitFeedItem[];
}

export function useCreatorForfeits(address: string | undefined) {
  return useQuery({
    queryKey: forfeitFeedKeys.creator(address ?? ""),
    queryFn: () => fetchForfeitFeed(address!, "creator"),
    enabled: Boolean(address),
    staleTime: 45_000,
  });
}

/** Forfeits where `address` is the named friend-verifier, not the creator. */
export function useVerifierForfeits(address: string | undefined) {
  return useQuery({
    queryKey: forfeitFeedKeys.verifier(address ?? ""),
    queryFn: () => fetchForfeitFeed(address!, "verifier"),
    enabled: Boolean(address),
    staleTime: 45_000,
  });
}

/** Forfeits where `address` is the friend a creator's stake goes to on a miss. */
export function useDestinationForfeits(address: string | undefined) {
  return useQuery({
    queryKey: forfeitFeedKeys.destination(address ?? ""),
    queryFn: () => fetchForfeitFeed(address!, "destination"),
    enabled: Boolean(address),
    staleTime: 45_000,
  });
}

export function isActiveForfeit(item: ForfeitFeedItem): boolean {
  if (item.onChain?.cancelled || item.status === "cancelled") return false;
  if (item.status === "ended") return false;
  if (item.onChain && !item.onChain.active && item.status !== "pending_verifier") return false;
  return true;
}
