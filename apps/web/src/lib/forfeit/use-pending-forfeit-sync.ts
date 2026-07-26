"use client";

import { useEffect, useState } from "react";
import type { ForfeitFeedItem } from "@/hooks/use-creator-forfeits";
import {
  ensurePendingForfeitConfirmed,
  readPendingForfeitConfirm,
  type PendingForfeitConfirm,
} from "@/lib/forfeit/pending-forfeit-confirm";

/** Map a just-staked pending confirm into a feed-shaped card so the UI never blanks. */
export function pendingToOptimisticFeedItem(
  pending: PendingForfeitConfirm,
): ForfeitFeedItem {
  const totalPeriods = Math.max(1, pending.totalPeriods || 1);
  const cadence = pending.cadence ?? 0;
  const periodSeconds = pending.periodSeconds || 86_400;
  return {
    id: `pending:${pending.txHash}`,
    onChainCommitmentId: null,
    title: pending.title || "Forfeit",
    description: pending.description,
    evidenceType: pending.evidenceType,
    verificationMethod: pending.verificationMethod,
    status: "active",
    createdAt: new Date(pending.savedAt).toISOString(),
    creatorWallet: pending.walletAddress,
    verifierWallet: null,
    otherPartyUsername: null,
    otherPartyPfpUrl: null,
    isCharityIntent: pending.isCharityIntent,
    destinationFriendUsername: pending.destinationFriendUsername,
    destinationFriendEmail: pending.destinationFriendEmail,
    currentPeriod: null,
    onChain: {
      stakeAmount: pending.stakeAmountWei,
      token: pending.token,
      destinationType: pending.destinationType,
      destinationAddr: pending.destinationAddr,
      cadence,
      periodSeconds: String(periodSeconds),
      totalPeriods,
      currentPeriodIndex: 0,
      currentPeriodDeadline: String(pending.firstDeadline),
      active: true,
      cancelled: false,
    },
  };
}

/**
 * If this wallet has a stake that isn't indexed in Supabase yet, keep confirming
 * in the background and expose an optimistic feed item so the forfeit never "vanishes".
 */
export function usePendingForfeitSync(address: string | undefined) {
  const [pending, setPending] = useState<PendingForfeitConfirm | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!address) {
      setPending(null);
      return;
    }
    const stored = readPendingForfeitConfirm(address);
    setPending(stored);
    setSynced(false);
    if (!stored) return;

    let cancelled = false;
    void (async () => {
      const ok = await ensurePendingForfeitConfirmed(stored);
      if (cancelled) return;
      if (ok) {
        setPending(null);
        setSynced(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  const optimisticItem =
    pending && pending.stakeAmountWei && pending.token
      ? pendingToOptimisticFeedItem(pending)
      : null;

  return { pending, optimisticItem, justSynced: synced };
}
