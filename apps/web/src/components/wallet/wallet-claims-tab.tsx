"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { Gift, Loader2, Sparkles, Trophy, Wallet } from "lucide-react";
import {
  useClaimCommunityCampaignReward,
  useClaimCommunityJoinStake,
} from "@/hooks/use-community-campaign-onchain";
import { getTokenDecimals } from "@/lib/token-amounts";
import { cn, formatGAmount } from "@/lib/utils";

type ClaimableItem = {
  campaignId: string;
  title: string;
  communitySlug: string | null;
  communityName: string | null;
  onChainChallengeId: number;
  amountWei: string;
  rank: number;
  proof: `0x${string}`[];
  merkleRoot: `0x${string}`;
};

type ReclaimableStakeItem = {
  campaignId: string;
  title: string;
  communitySlug: string | null;
  communityName: string | null;
  onChainChallengeId: number;
  amountWei: string;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  netAmountWei: string;
  missedMilestones: number;
  totalMilestones: number;
  forfeitPctPerMiss: number;
};

const MANROPE = { fontFamily: "var(--font-manrope)" } as const;

function formatClaimAmount(amountWei: string) {
  try {
    const n = parseFloat(formatUnits(BigInt(amountWei), 18));
    return formatGAmount(n);
  } catch {
    return "—";
  }
}

function formatStakeDisplay(amountWei: string, tokenAddress: string) {
  try {
    const decimals = getTokenDecimals(tokenAddress);
    const n = parseFloat(formatUnits(BigInt(amountWei), decimals));
    return formatGAmount(n);
  } catch {
    return "—";
  }
}

function CampaignClaimRow({
  item,
  address,
  onClaimed,
}: {
  item: ClaimableItem;
  address: string;
  onClaimed: (campaignId: string) => void;
}) {
  const {
    claimCommunityCampaignRewardAndWait,
    errorMessage: claimTxError,
    reset,
  } = useClaimCommunityCampaignReward();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClaim = useCallback(async () => {
    setBusy(true);
    setError(null);
    reset();
    try {
      const txHash = await claimCommunityCampaignRewardAndWait({
        challengeId: item.onChainChallengeId,
        amountWei: BigInt(item.amountWei),
        proof: item.proof,
      });
      const res = await fetch(`/api/community/campaigns/${item.campaignId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, txHash }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ??
            "On-chain claim succeeded, but we couldn't update your claim record. Refresh and check again.",
        );
      }
      onClaimed(item.campaignId);
    } catch (err) {
      setError(
        claimTxError ||
          (err instanceof Error ? err.message : "Claim failed. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }, [
    address,
    claimCommunityCampaignRewardAndWait,
    claimTxError,
    item,
    onClaimed,
    reset,
  ]);

  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-delulu-blue/10 text-delulu-blue">
        <Trophy className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground" style={MANROPE}>
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground" style={MANROPE}>
          {item.communityName ? `${item.communityName} · ` : ""}
          Prize · Rank #{item.rank} · {formatClaimAmount(item.amountWei)} G$
        </p>
        {item.communitySlug ? (
          <Link
            href={`/communities/${item.communitySlug}/campaigns/${item.campaignId}`}
            className="mt-0.5 inline-block text-[11px] font-semibold text-delulu-blue hover:underline"
          >
            View campaign
          </Link>
        ) : null}
        {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => void handleClaim()}
        disabled={busy}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-delulu-charcoal px-3.5 py-2 text-xs font-bold text-white",
          "transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
        Claim
      </button>
    </div>
  );
}

function StakeReclaimRow({
  item,
  onClaimed,
}: {
  item: ReclaimableStakeItem;
  onClaimed: (campaignId: string) => void;
}) {
  const {
    claimCommunityJoinStakeAndWait,
    errorMessage: claimTxError,
    reset,
  } = useClaimCommunityJoinStake();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClaim = useCallback(async () => {
    setBusy(true);
    setError(null);
    reset();
    try {
      await claimCommunityJoinStakeAndWait(item.onChainChallengeId);
      onClaimed(item.campaignId);
    } catch (err) {
      setError(
        claimTxError ||
          (err instanceof Error ? err.message : "Reclaim failed. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }, [claimCommunityJoinStakeAndWait, claimTxError, item, onClaimed, reset]);

  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
        <Wallet className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground" style={MANROPE}>
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground" style={MANROPE}>
          {item.communityName ? `${item.communityName} · ` : ""}
          Join stake · {formatStakeDisplay(item.amountWei, item.tokenAddress)}{" "}
          {item.tokenSymbol}
        </p>
        {item.missedMilestones > 0 ? (
          <p className="mt-0.5 text-[11px] font-medium text-amber-600" style={MANROPE}>
            Missed {item.missedMilestones}/{item.totalMilestones} milestone
            {item.missedMilestones === 1 ? "" : "s"} · you&apos;ll receive{" "}
            {formatStakeDisplay(item.netAmountWei, item.tokenAddress)} {item.tokenSymbol}
          </p>
        ) : null}
        {item.communitySlug ? (
          <Link
            href={`/communities/${item.communitySlug}/campaigns/${item.campaignId}`}
            className="mt-0.5 inline-block text-[11px] font-semibold text-delulu-blue hover:underline"
          >
            View campaign
          </Link>
        ) : null}
        {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => void handleClaim()}
        disabled={busy}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-delulu-charcoal px-3.5 py-2 text-xs font-bold text-white",
          "transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
        Reclaim
      </button>
    </div>
  );
}

export function WalletClaimsTab({ address }: { address: `0x${string}` }) {
  const [prizeItems, setPrizeItems] = useState<ClaimableItem[]>([]);
  const [stakeItems, setStakeItems] = useState<ReclaimableStakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = encodeURIComponent(address);
      const [prizeRes, stakeRes] = await Promise.all([
        fetch(`/api/community/campaigns/claimable?address=${qs}`),
        fetch(`/api/community/campaigns/reclaimable-stakes?address=${qs}`),
      ]);
      const prizeJson = await prizeRes.json().catch(() => ({}));
      const stakeJson = await stakeRes.json().catch(() => ({}));
      if (!prizeRes.ok) {
        throw new Error((prizeJson as { error?: string }).error ?? "Failed to load prize claims");
      }
      if (!stakeRes.ok) {
        throw new Error((stakeJson as { error?: string }).error ?? "Failed to load stakes");
      }
      setPrizeItems((prizeJson as { items: ClaimableItem[] }).items ?? []);
      setStakeItems((stakeJson as { items: ReclaimableStakeItem[] }).items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load claims");
      setPrizeItems([]);
      setStakeItems([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
        <div className="divide-y divide-border/40">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted/60" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-36 animate-pulse rounded bg-muted/60" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
              </div>
              <div className="h-8 w-16 animate-pulse rounded-full bg-muted/60" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card px-6 py-10 text-center">
        <p className="text-sm font-semibold text-foreground">Couldn&apos;t load claims</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 text-xs font-bold text-delulu-blue hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (prizeItems.length === 0 && stakeItems.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
        <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/60">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </span>
          <p className="text-sm font-semibold text-foreground">Nothing to claim yet</p>
          <p className="text-xs text-muted-foreground" style={MANROPE}>
            Ended campaign prizes and paid join stakes you can reclaim will show up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stakeItems.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-foreground" style={MANROPE}>
            Join stakes
          </h3>
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <div className="divide-y divide-border/40">
              {stakeItems.map((item) => (
                <StakeReclaimRow
                  key={`stake-${item.campaignId}`}
                  item={item}
                  onClaimed={(id) =>
                    setStakeItems((prev) => prev.filter((i) => i.campaignId !== id))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {prizeItems.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-foreground" style={MANROPE}>
            Prize claims
          </h3>
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <div className="divide-y divide-border/40">
              {prizeItems.map((item) => (
                <CampaignClaimRow
                  key={`prize-${item.campaignId}`}
                  item={item}
                  address={address}
                  onClaimed={(id) =>
                    setPrizeItems((prev) => prev.filter((i) => i.campaignId !== id))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
