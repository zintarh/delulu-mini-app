"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { Check, Gift, HeartHandshake, Loader2, Sparkles, Trophy, Wallet } from "lucide-react";
import {
  useClaimCommunityCampaignReward,
  useClaimCommunityJoinStake,
} from "@/hooks/use-community-campaign-onchain";
import { useClaimAllFriendRewards, useClaimFriendReward } from "@/hooks/use-forfeit-friend-reward";
import { getTokenDecimals } from "@/lib/token-amounts";
import { KNOWN_TOKEN_SYMBOLS } from "@/lib/constant";
import { cn, formatGAmount } from "@/lib/utils";
import { fireConfetti } from "@/lib/celebrate";

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
  isClaimed,
  onClaimed,
}: {
  item: ClaimableItem;
  address: string;
  isClaimed: boolean;
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
      void fireConfetti();
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
          Ended campaign win · Rank #{item.rank} · {formatClaimAmount(item.amountWei)} G$
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
      {isClaimed ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-600">
          <Check className="h-3.5 w-3.5" />
          Claimed
        </span>
      ) : (
        <button
          type="button"
          onClick={() => void handleClaim()}
          disabled={busy}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground",
            "transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
          Claim
        </button>
      )}
    </div>
  );
}

function StakeReclaimRow({
  item,
  isClaimed,
  onClaimed,
}: {
  item: ReclaimableStakeItem;
  isClaimed: boolean;
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
      void fireConfetti();
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
          You&apos;ll receive{" "}
          {formatStakeDisplay(item.netAmountWei, item.tokenAddress)} {item.tokenSymbol}
        </p>
        {item.missedMilestones > 0 ? (
          <p className="mt-0.5 text-[11px] font-medium text-amber-600" style={MANROPE}>
            Missed {item.missedMilestones}/{item.totalMilestones} milestone
            {item.missedMilestones === 1 ? "" : "s"} · original stake{" "}
            {formatStakeDisplay(item.amountWei, item.tokenAddress)} {item.tokenSymbol}
          </p>
        ) : item.amountWei !== item.netAmountWei ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground" style={MANROPE}>
            Original stake {formatStakeDisplay(item.amountWei, item.tokenAddress)}{" "}
            {item.tokenSymbol}
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
      {isClaimed ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-600">
          <Check className="h-3.5 w-3.5" />
          Reclaimed
        </span>
      ) : (
        <button
          type="button"
          onClick={() => void handleClaim()}
          disabled={busy}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground",
            "transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
          Reclaim
        </button>
      )}
    </div>
  );
}

function FriendRewardRow({
  token,
  pending,
  historyCount,
  isClaimed,
  onClaimed,
}: {
  token: `0x${string}`;
  pending: bigint;
  historyCount: number;
  isClaimed: boolean;
  onClaimed: () => void;
}) {
  const { claimFriendReward, error: claimTxError, reset } = useClaimFriendReward();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decimals = getTokenDecimals(token);
  const amount = parseFloat(formatUnits(pending, decimals));
  const symbol = KNOWN_TOKEN_SYMBOLS[token.toLowerCase()] ?? "";

  const handleClaim = useCallback(async () => {
    setBusy(true);
    setError(null);
    reset();
    try {
      await claimFriendReward(token);
      onClaimed();
      void fireConfetti();
    } catch (err) {
      setError(
        (claimTxError as Error | undefined)?.message ||
          (err instanceof Error ? err.message : "Claim failed. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }, [claimFriendReward, claimTxError, onClaimed, reset, token]);

  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-delulu-yellow-reserved/15 text-primary">
        <HeartHandshake className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground" style={MANROPE}>
          {amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {symbol}
        </p>
        <p className="text-xs text-muted-foreground" style={MANROPE}>
          From a friend who missed {historyCount > 1 ? `${historyCount} commitments` : "their commitment"}
        </p>
        {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
      </div>
      {isClaimed ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-600">
          <Check className="h-3.5 w-3.5" />
          Claimed
        </span>
      ) : (
        <button
          type="button"
          onClick={() => void handleClaim()}
          disabled={busy}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground",
            "transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
          Claim
        </button>
      )}
    </div>
  );
}

/** Friend-destination ForfeitMarket rewards — self-hides when nothing is pending. */
function FriendRewardsSection({ address }: { address: `0x${string}` }) {
  const { pendingByToken, isLoading } = useClaimAllFriendRewards(address);
  const [historyByToken, setHistoryByToken] = useState<Record<string, number>>({});
  const [claimedTokens, setClaimedTokens] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/forfeit/friend-rewards?address=${address}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const counts: Record<string, number> = {};
        for (const item of (json.items ?? []) as Array<{ token_address: string }>) {
          const key = item.token_address.toLowerCase();
          counts[key] = (counts[key] ?? 0) + 1;
        }
        setHistoryByToken(counts);
      } catch {
        // Best-effort — the count is informational only, the claim itself never depends on it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (isLoading) return null;
  const rows = pendingByToken.filter((t) => t.pending > 0n && !claimedTokens.has(t.token));
  if (rows.length === 0) return null;

  return (
    <div>
      <div className="mb-2">
        <h3 className="text-sm font-semibold tracking-wide text-foreground" style={MANROPE}>
          Forfeit rewards
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground" style={MANROPE}>
          Stakes forfeited to you by a friend
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        <div className="divide-y divide-border/40">
          {rows.map((row) => (
            <FriendRewardRow
              key={row.token}
              token={row.token}
              pending={row.pending}
              historyCount={historyByToken[row.token.toLowerCase()] ?? 1}
              isClaimed={claimedTokens.has(row.token)}
              onClaimed={() => {
                setClaimedTokens((prev) => new Set(prev).add(row.token));
                void row.refetch();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function WalletClaimsTab({ address }: { address: `0x${string}` }) {
  const [prizeItems, setPrizeItems] = useState<ClaimableItem[]>([]);
  const [stakeItems, setStakeItems] = useState<ReclaimableStakeItem[]>([]);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
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

  const campaignClaimsContent = loading ? (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
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
  ) : error ? (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm px-6 py-10 text-center">
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
  ) : prizeItems.length === 0 && stakeItems.length === 0 ? (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/60">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </span>
        <p className="text-sm font-semibold text-foreground">Nothing to claim yet</p>
        <p className="text-xs text-muted-foreground" style={MANROPE}>
          When campaigns end, prize wins and reclaimable join stakes will show up here.
        </p>
      </div>
    </div>
  ) : (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-muted-foreground" style={MANROPE}>
        These are from <span className="font-semibold text-foreground">ended campaigns</span> —
        prize wins you earned and join stakes you can reclaim. Team rewards to claim are above.
      </p>

      {prizeItems.length > 0 ? (
        <div>
          <div className="mb-2">
            <h3 className="text-sm font-semibold tracking-wide text-foreground" style={MANROPE}>
              Campaign wins
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground" style={MANROPE}>
              Prizes from campaigns you placed in
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
            <div className="divide-y divide-border/40">
              {prizeItems.map((item) => (
                <CampaignClaimRow
                  key={`prize-${item.campaignId}`}
                  item={item}
                  address={address}
                  isClaimed={claimedIds.has(`prize-${item.campaignId}`)}
                  onClaimed={(id) =>
                    setClaimedIds((prev) => new Set(prev).add(`prize-${id}`))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {stakeItems.length > 0 ? (
        <div>
          <div className="mb-2">
            <h3 className="text-sm font-semibold tracking-wide text-foreground" style={MANROPE}>
              Stake reclaims
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground" style={MANROPE}>
              Join stakes returned after a campaign ended
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
            <div className="divide-y divide-border/40">
              {stakeItems.map((item) => (
                <StakeReclaimRow
                  key={`stake-${item.campaignId}`}
                  item={item}
                  isClaimed={claimedIds.has(`stake-${item.campaignId}`)}
                  onClaimed={(id) =>
                    setClaimedIds((prev) => new Set(prev).add(`stake-${id}`))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
      <FriendRewardsSection address={address} />
      {campaignClaimsContent}
    </div>
  );
}
