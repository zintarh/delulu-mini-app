"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormattedDelulu } from "@/lib/types";
import { cn, formatGAmount } from "@/lib/utils";
import {
  getDefaultTipAmount,
  getTokenSymbol,
  parseTokenAmount,
} from "@/lib/token-amounts";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { Check, DollarSign, Loader2 } from "lucide-react";
import { useApolloClient } from "@apollo/client/react";
import { GET_DELULU_BY_ID, useGraphDelulu } from "@/hooks/graph/useGraphDelulu";
import { useAuth } from "@/hooks/use-auth";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { SIGN_IN_BUTTON_LABEL } from "@/lib/auth-redirect";
import { useRequireGoodDollarWhitelist } from "@/hooks/use-require-gooddollar-whitelist";
import { useChainId, useWaitForTransactionReceipt } from "wagmi";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { DELULU_ABI } from "@/lib/abi";
import { getDeluluContractAddress } from "@/lib/constant";
import { refetchDeluluData } from "@/lib/graph/refetch-utils";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { isDeluluCreator } from "@/lib/delulu-utils";
import {
  getMilestoneEndTimeMs,
  getDeluluCreatedAtMs,
  shouldShowBuyButton,
} from "@/lib/milestone-utils";
import type { FeedMilestone } from "@/hooks/graph/useAllDelulus";
import { resolveIPFSContent } from "@/lib/graph/ipfs-cache";
import { UserAvatar } from "@/components/ui/user-avatar";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}


function formatTimeLeftDayHour(nowMs: number, targetMs: number): string {
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) return "Ended";
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  return `${hours}h`;
}

interface DeluluCardProps {
  delusion: FormattedDelulu;
  onClick?: () => void;
  href?: string;
  onStake?: () => void;
  className?: string;
  /** Softer Pinterest-style presentation on home feed rows. */
  variant?: "default" | "feed" | "feed-for-you" | "grid";
  isLast?: boolean;
  nowMs?: number;
  disableMilestoneQuery?: boolean;
  disableUsernameLookup?: boolean;
  feedMilestones?: FeedMilestone[];
  totalMilestoneCount?: number;
  creatorPfpUrl?: string | null | undefined;
}

export function DeluluCard({
  delusion,
  onClick,
  href,
  onStake,
  className = "",
  variant = "default",
  isLast = false,
  nowMs,
  disableMilestoneQuery = false,
  disableUsernameLookup = false,
  feedMilestones,
  totalMilestoneCount,
  creatorPfpUrl,
}: DeluluCardProps) {
  const legacyStakeTotal = delusion.totalBelieverStake + delusion.totalDoubterStake;
  const totalReceived = delusion.totalSupportCollected ?? 0;
  const fallbackReceived = (delusion.creatorStake ?? 0) + legacyStakeTotal;
  const tvlValue = totalReceived > 0 ? totalReceived : fallbackReceived;
  const creatorAddress = disableUsernameLookup
    ? undefined
    : (delusion.creator as `0x${string}`);
  const { username: contractUsername } = useUsernameByAddress(creatorAddress);
  const displayUsername = contractUsername || delusion.username || null;
  const creatorLabel = displayUsername
    ? `@${displayUsername}`
    : formatAddress(delusion.creator);
  // creatorPfpUrl comes from Supabase (most reliable). delusion.pfpUrl is from IPFS
  // metadata — may be stale but used as a fallback for users who set a pfp at creation time.
  const resolvedPfpUrl = creatorPfpUrl !== undefined
    ? creatorPfpUrl  // undefined = still loading, pass through as-is
    : (delusion.pfpUrl ?? null);

  const { milestones, isLoading: isMilestonesLoading } = useGraphDelulu(
    disableMilestoneQuery ? null : delusion.id,
  );
  const effectiveMilestones = feedMilestones ?? milestones;
  const effectiveMilestonesLoading = disableMilestoneQuery
    ? false
    : isMilestonesLoading;

  const { address, authenticated } = useAuth();
  const { redirectToSignIn } = useRedirectToSignIn();
  const { ensureWhitelisted, isChecking: isCheckingWhitelist } =
    useRequireGoodDollarWhitelist();
  const isCreator = isDeluluCreator(address, delusion);
  const router = useRouter();
  const apolloClient = useApolloClient();
  const chainId = useChainId();

  const {
    writeContract: writeQuickTip,
    data: quickTipHash,
    isPending: isQuickTipPending,
  } = useUnifiedWriteContract();
  const { isLoading: isConfirmingQuickTip, isSuccess: isQuickTipSuccess } =
    useWaitForTransactionReceipt({ hash: quickTipHash });
  const {
    approve: approveToken,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovalConfirming,
    isSuccess: isApprovalSuccess,
    refetchAllowance,
  } = useTokenApproval(delusion.tokenAddress);

  const isDoingApproval = isApproving || isApprovalConfirming;
  const isQuickTipping = isQuickTipPending || isConfirmingQuickTip || isDoingApproval;

  const tokenSymbol = getTokenSymbol(delusion.tokenAddress);
  const defaultTipAmount = getDefaultTipAmount(delusion.tokenAddress);

  const [autoTipAfterApproval, setAutoTipAfterApproval] = useState(false);
  const pendingTipAmountRef = useRef<number>(defaultTipAmount);
  const [tipAmount, setTipAmount] = useState(defaultTipAmount);

  const [showTipSuccess, setShowTipSuccess] = useState(false);
  useEffect(() => {
    if (!isQuickTipSuccess) return;
    refetchDeluluData(apolloClient, delusion.onChainId ?? delusion.id);
    setShowTipSuccess(true);
    setTipAmount(defaultTipAmount);
    const t = setTimeout(() => setShowTipSuccess(false), 2500);
    return () => clearTimeout(t);
  }, [isQuickTipSuccess, apolloClient, delusion.onChainId, delusion.id, defaultTipAmount]);

  // Refetch allowance once the approval tx is confirmed on-chain
  useEffect(() => {
    if (isApprovalSuccess) refetchAllowance();
  }, [isApprovalSuccess, refetchAllowance]);

  // Auto-fire the tip once allowance is sufficient after approval
  useEffect(() => {
    if (!autoTipAfterApproval || isDoingApproval) return;
    const amount = pendingTipAmountRef.current;
    if (needsApproval(amount)) return;
    setAutoTipAfterApproval(false);
    try {
      const amountWei = parseTokenAmount(amount, delusion.tokenAddress);
      writeQuickTip({
        address: getDeluluContractAddress(chainId),
        abi: DELULU_ABI,
        functionName: "tipMilestone",
        args: [BigInt(delusion.onChainId ?? delusion.id), 0n, amountWei],
      });
    } catch {
      // silent — tip flow stays quiet on errors
    }
  }, [autoTipAfterApproval, isDoingApproval, needsApproval, writeQuickTip, chainId, delusion.onChainId, delusion.id, delusion.tokenAddress]);

  useEffect(() => {
    setTipAmount(getDefaultTipAmount(delusion.tokenAddress));
  }, [delusion.tokenAddress]);

  const { formatted: gBalanceFormatted, isLoading: isLoadingGBalance } =
    useTokenBalance(delusion.tokenAddress);
  const gBalanceNum = Number(gBalanceFormatted ?? "0");
  const hasEnoughForTip =
    isLoadingGBalance ||
    (Number.isFinite(gBalanceNum) && gBalanceNum >= tipAmount);
  const userKey = address?.toLowerCase() ?? null;

  const [localNow, setLocalNow] = useState(() => Date.now());
  useEffect(() => {
    if (typeof nowMs === "number") return;
    const id = setInterval(() => setLocalNow(Date.now()), 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") setLocalNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [nowMs]);
  const now = typeof nowMs === "number" ? nowMs : localNow;

  const isHash = (str: string) => {
    return (
      str.startsWith("Qm") || (str.length > 40 && /^[a-f0-9]+$/i.test(str))
    );
  };

  const headlineRaw =
    delusion.content && !isHash(delusion.content) ? delusion.content : "";
  const headline = headlineRaw.trim() || "YOUR DELULU HEADLINE";

  const tvl = tvlValue;
  const formattedGAmount = formatGAmount(tvl);

  const { totalCount, verifiedCount } = useMemo(() => {
    if (
      effectiveMilestonesLoading ||
      !effectiveMilestones ||
      effectiveMilestones.length === 0
    ) {
      return { totalCount: 0, verifiedCount: 0 };
    }

    const sorted = [...effectiveMilestones].sort(
      (a, b) => Number(a.milestoneId) - Number(b.milestoneId),
    );
    const total = totalMilestoneCount ?? sorted.length;
    const verifiedCount = effectiveMilestones.filter((m) => m.isVerified).length;

    return { totalCount: total, verifiedCount };
  }, [effectiveMilestones, effectiveMilestonesLoading, totalMilestoneCount]);

  const supportersCount = delusion.totalSupporters ?? 0;

  const handleMouseEnter = () => {
    if (!href) return;
    router.prefetch(href);
    // Warm detail-page GraphQL + IPFS so first navigation feels instant.
    apolloClient
      .query({
        query: GET_DELULU_BY_ID,
        variables: { id: String(delusion.id) },
        fetchPolicy: "cache-first",
      })
      .catch(() => {});
    if (delusion.contentHash) {
      resolveIPFSContent(delusion.contentHash).catch(() => {});
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  const resolutionMs = delusion.resolutionDeadline.getTime();
  const isEnded = resolutionMs > 0 && resolutionMs <= now;
  const timeRemaining = !isEnded ? formatTimeLeftDayHour(now, resolutionMs) : null;

  const showSupportButton =
    authenticated &&
    !isEnded &&
    !isCreator &&
    shouldShowBuyButton(effectiveMilestones, now, {
      createdAt: delusion.createdAt,
      stakingDeadline: delusion.stakingDeadline,
    });

  const tipDisabled = isEnded || isCreator;
  const canQuickTip = showSupportButton && !tipDisabled;
  const showTipCta = !!delusion.tokenAddress && !tipDisabled && !isCreator;

  const handleQuickTip = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (tipDisabled) return;
    if (isQuickTipping || isCheckingWhitelist) return;
    if (!authenticated) {
      redirectToSignIn(`/delulu/${delusion.id}`);
      return;
    }
    if (!showSupportButton) {
      router.push(`/delulu/${delusion.id}?milestones=1`);
      return;
    }
    if (!hasEnoughForTip) {
      router.push(`/delulu/${delusion.id}?milestones=1`);
      return;
    }
    const allowed = await ensureWhitelisted("tip", delusion.tokenAddress);
    if (!allowed) return;

    pendingTipAmountRef.current = tipAmount;
    if (needsApproval(tipAmount)) {
      setAutoTipAfterApproval(true);
      approveToken(tipAmount).catch(() => setAutoTipAfterApproval(false));
      return;
    }
    try {
      const amountWei = parseTokenAmount(tipAmount, delusion.tokenAddress);
      writeQuickTip({
        address: getDeluluContractAddress(chainId),
        abi: DELULU_ABI,
        functionName: "tipMilestone",
        args: [BigInt(delusion.onChainId ?? delusion.id), 0n, amountWei],
      });
    } catch {
      // silent — quick action stays quiet on bad input
    }
  };

  const addrHex = delusion.creator.replace("0x", "").toLowerCase();
  const h1 = parseInt(addrHex.slice(0, 6), 16) % 360;
  const h2 = (h1 + 55) % 360;
  const cardGradient = `linear-gradient(140deg, hsl(${h1},50%,20%) 0%, hsl(${h2},55%,12%) 100%)`;

  const milestoneProgressPct =
    totalCount > 0
      ? Math.min(100, Math.round((verifiedCount / totalCount) * 100))
      : 0;

  const isForYouVariant = variant === "feed-for-you";

  const tipButtonEl =
    showTipCta || isQuickTipping || showTipSuccess ? (
      <div className={cn(isForYouVariant ? "shrink-0" : "absolute bottom-3 right-3 z-10")}>
        {showTipSuccess ? (
          <span
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-white",
              isForYouVariant
                ? "bg-delulu-blue shadow-sm"
                : "bg-black shadow-[0_4px_14px_rgba(0,0,0,0.45)]",
            )}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            Tipped!
          </span>
        ) : (
          <button
            type="button"
            onClick={handleQuickTip}
            disabled={isQuickTipping || isCheckingWhitelist}
            className={cn(
              "inline-flex h-9 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-white transition-all duration-150 active:scale-[0.97]",
              isForYouVariant
                ? "bg-delulu-blue shadow-sm hover:bg-delulu-blue/90"
                : [
                    "bg-black shadow-[0_4px_14px_rgba(0,0,0,0.45)]",
                    "hover:shadow-[0_6px_18px_rgba(0,0,0,0.55)] hover:-translate-y-0.5 hover:bg-black/90",
                    "active:shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
                  ],
              isQuickTipping && "cursor-wait",
            )}
          >
            {isQuickTipping ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="sr-only">
                  {isDoingApproval ? "Approving" : "Tipping"}
                </span>
              </>
            ) : !authenticated ? (
              SIGN_IN_BUTTON_LABEL
            ) : canQuickTip && hasEnoughForTip ? (
              <>
                <DollarSign className="h-3.5 w-3.5" strokeWidth={2.5} />
                {`Tip ${tipAmount} ${tokenSymbol}`}
              </>
            ) : (
              <>
                <DollarSign className="h-3.5 w-3.5" strokeWidth={2.5} />
                Tip
              </>
            )}
          </button>
        )}
      </div>
    ) : null;

  const forYouCardContent = (
    <div
      onClick={href ? undefined : handleCardClick}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "relative aspect-[5/4] w-full overflow-hidden transition-all duration-200",
        "rounded-3xl border-0",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.07)]",
        "hover:-translate-y-1 hover:shadow-[0_4px_8px_rgba(0,0,0,0.06),0_12px_32px_rgba(0,0,0,0.1)]",
        href && "cursor-pointer active:scale-[0.99]",
      )}
      style={{ background: cardGradient }}
      aria-label={`${headline} by ${creatorLabel}`}
    >
      {delusion.bgImageUrl ? (
        <img
          src={delusion.bgImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      {totalCount > 0 ? (
        <div
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 shadow-sm backdrop-blur-md"
          aria-label={`${verifiedCount} of ${totalCount} milestones`}
        >
          <svg className="absolute inset-0 h-9 w-9 -rotate-90" viewBox="0 0 36 36" aria-hidden>
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="2.5"
            />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 14}
              strokeDashoffset={2 * Math.PI * 14 * (1 - milestoneProgressPct / 100)}
            />
          </svg>
          <span className="relative text-[8px] font-black tabular-nums text-white">
            {verifiedCount}/{totalCount}
          </span>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 px-3 pb-3 pt-10">
        <h3 className="line-clamp-2 text-sm font-black leading-snug tracking-tight text-white drop-shadow-md sm:text-[15px]">
          {headline}
        </h3>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-white/50">
            <UserAvatar
              address={delusion.creator}
              username={displayUsername}
              pfpUrl={resolvedPfpUrl}
              size={32}
            />
          </div>
          <p className="min-w-0 truncate text-xs font-semibold text-white/95 drop-shadow-sm">
            {creatorLabel}
          </p>
        </div>
      </div>
    </div>
  );

  const cardContent = isForYouVariant ? (
    forYouCardContent
  ) : (
    <div
      onClick={href ? undefined : handleCardClick}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "flex flex-col overflow-hidden bg-card transition-all duration-200",
        variant === "grid"
          ? "min-h-0 rounded-2xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
          : variant === "feed"
            ? [
                "min-h-[380px] rounded-3xl border-0",
                "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.07)]",
                "hover:shadow-[0_4px_8px_rgba(0,0,0,0.06),0_12px_32px_rgba(0,0,0,0.1)]",
                "hover:-translate-y-1",
              ]
            : [
                "min-h-[380px] rounded-2xl border border-border shadow-sm",
                "hover:shadow-md hover:-translate-y-0.5",
              ],
        href && "cursor-pointer active:scale-[0.99]",
      )}
    >
      {/* 1. Image */}
      <div
        className={cn(
          "relative w-full shrink-0 overflow-hidden",
          variant === "grid"
            ? "aspect-[4/3]"
            : "aspect-[5/4] sm:min-h-[200px]",
          variant === "feed" && "sm:min-h-[220px]",
        )}
        style={{ background: cardGradient }}
      >
        {delusion.bgImageUrl ? (
          <img
            src={delusion.bgImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
        {timeRemaining ? (
          <span className="absolute right-3 top-3 z-10 rounded-full border border-white/25 bg-black/40 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            {timeRemaining}
          </span>
        ) : null}

        {tipButtonEl}
      </div>

      {/* 2–4. Title, milestone progress, tipped */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <h3 className="line-clamp-3 text-lg font-black leading-snug tracking-tight text-foreground sm:text-xl">
          {headline}
        </h3>

        {totalCount > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-muted-foreground">
                Milestones
              </span>
              <span className="font-black tabular-nums text-foreground">
                {verifiedCount}/{totalCount}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={milestoneProgressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${verifiedCount} of ${totalCount} milestones completed`}
            >
              <div
                className="h-full rounded-full bg-delulu-blue transition-all duration-500"
                style={{
                  width: `${milestoneProgressPct > 0 ? Math.max(milestoneProgressPct, 4) : 0}%`,
                }}
              />
            </div>
          </div>
        ) : effectiveMilestonesLoading ? (
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
          </div>
        ) : null}

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-muted-foreground">
            Tipped so far
          </span>
          <span className="text-right text-base font-black tabular-nums text-foreground">
            {formattedGAmount}
            {delusion.tokenAddress ? (
              <span className="ml-1 text-sm font-semibold text-muted-foreground">
                {tokenSymbol}
              </span>
            ) : null}
          </span>
        </div>

        <div className="flex items-center gap-2.5 border-t border-border/50 pt-4">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-border">
            <UserAvatar
              address={delusion.creator}
              username={displayUsername}
              pfpUrl={resolvedPfpUrl}
              size={36}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">
              {creatorLabel}
            </p>
            {supportersCount > 0 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {supportersCount}{" "}
                {supportersCount === 1 ? "supporter" : "supporters"}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(className, "block h-auto mb-4")}
        onMouseEnter={handleMouseEnter}
        onTouchStart={handleMouseEnter}
        prefetch={true}
        scroll={true}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      className={cn(className, "block h-auto mb-4")}
      onClick={onClick || undefined}
    >
      {cardContent}
    </div>
  );
}
