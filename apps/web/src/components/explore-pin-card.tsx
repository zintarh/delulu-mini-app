"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBalance, useChainId, useWaitForTransactionReceipt } from "wagmi";
import { DollarSign } from "lucide-react";
import type { FormattedDelulu } from "@/lib/types";
import type { FeedMilestone } from "@/hooks/graph/useAllDelulus";
import { normalizeDeluluImageSrc } from "@/lib/normalize-image-src";
import { cn, formatGAmount } from "@/lib/utils";
import {
  formatUsdEquivalent,
  getDefaultTipAmount,
  getTokenSymbol,
  parseTokenAmount,
} from "@/lib/token-amounts";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getPinCardAspectClassFromId } from "@/lib/pin-card-aspect";
import { useAuth } from "@/hooks/use-auth";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { useRequireGoodDollarWhitelist } from "@/hooks/use-require-gooddollar-whitelist";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useApolloClient } from "@apollo/client/react";
import { isDeluluCreator } from "@/lib/delulu-utils";
import { DELULU_ABI } from "@/lib/abi";
import { getDeluluContractAddress } from "@/lib/constant";
import { refetchDeluluData } from "@/lib/graph/refetch-utils";
import { DeluluTipModal } from "@/components/delulu-detail/delulu-tip-modal";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDurationMs(ms: number): string {
  if (ms <= 0) return "";
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (totalHours > 0) return `${totalHours}h`;
  const mins = Math.max(1, Math.floor(ms / (1000 * 60)));
  return `${mins}m`;
}

function isContentHash(str: string): boolean {
  return (
    str.startsWith("Qm") || (str.length > 40 && /^[a-f0-9]+$/i.test(str))
  );
}

function resolveHeadline(content: string | undefined): {
  text: string;
  pending: boolean;
} {
  const raw = content?.trim() ?? "";
  if (!raw || isContentHash(raw)) {
    return { text: "", pending: true };
  }
  return { text: raw, pending: false };
}

export interface ExplorePinCardProps {
  delusion: FormattedDelulu;
  href: string;
  className?: string;
  nowMs?: number;
  creatorPfpUrl?: string | null | undefined;
  imagePriority?: boolean;
  feedMilestones?: FeedMilestone[];
  totalMilestoneCount?: number;
}

export function ExplorePinCard({
  delusion,
  href,
  className,
  nowMs,
  creatorPfpUrl,
  imagePriority = false,
  feedMilestones,
  totalMilestoneCount,
}: ExplorePinCardProps) {
  const router = useRouter();
  const apolloClient = useApolloClient();
  const { address, authenticated } = useAuth();
  const { redirectToSignIn } = useRedirectToSignIn();
  const { ensureWhitelisted, isChecking: isCheckingWhitelist } =
    useRequireGoodDollarWhitelist();
  const isCreator = isDeluluCreator(address, delusion);
  const chainId = useChainId();
  const legacyStakeTotal = delusion.totalBelieverStake + delusion.totalDoubterStake;
  const totalReceived = delusion.totalSupportCollected ?? 0;
  const fallbackReceived = (delusion.creatorStake ?? 0) + legacyStakeTotal;
  const tvlValue = totalReceived > 0 ? totalReceived : fallbackReceived;
  const tokenSymbol = getTokenSymbol(delusion.tokenAddress);
  const displayUsername = delusion.username ?? null;
  const creatorLabel = displayUsername
    ? `@${displayUsername}`
    : formatAddress(delusion.creator);
  const resolvedPfpUrl = creatorPfpUrl !== undefined ? creatorPfpUrl : (delusion.pfpUrl ?? null);

  const [localNow, setLocalNow] = useState(() => Date.now());
  useEffect(() => {
    if (typeof nowMs === "number") return;
    const id = setInterval(() => setLocalNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [nowMs]);
  const now = typeof nowMs === "number" ? nowMs : localNow;

  const { text: headline, pending: headlinePending } = resolveHeadline(
    delusion.content,
  );
  const { usd: gDollarUsdPrice } = useGoodDollarPrice();
  const formattedGAmount = formatGAmount(tvlValue);
  const supportUsdLabel = formatUsdEquivalent(
    tvlValue,
    delusion.tokenAddress,
    gDollarUsdPrice,
  );
  const supportersCount = delusion.totalSupporters ?? 0;

  const resolutionMs = delusion.resolutionDeadline.getTime();
  const isEnded = resolutionMs > 0 && resolutionMs <= now;
  const endedDurationLabel = useMemo(() => {
    if (!isEnded) return null;
    const startMs = delusion.createdAt?.getTime() ?? 0;
    if (startMs <= 0 || resolutionMs <= startMs) return null;
    return formatDurationMs(resolutionMs - startMs);
  }, [isEnded, delusion.createdAt, resolutionMs]);
  const coverImageSrc = normalizeDeluluImageSrc(delusion.bgImageUrl);
  const coverSizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";
  const coverLoadProps = imagePriority
    ? { priority: true as const }
    : { loading: "lazy" as const };

  const pinAspectClass = useMemo(
    () => getPinCardAspectClassFromId(delusion.onChainId, delusion.id),
    [delusion.onChainId, delusion.id],
  );

  const addrHex = delusion.creator.replace("0x", "").toLowerCase();
  const h1 = parseInt(addrHex.slice(0, 6), 16) % 360;
  const h2 = (h1 + 55) % 360;
  const cardGradient = `linear-gradient(140deg, hsl(${h1},50%,20%) 0%, hsl(${h2},55%,12%) 100%)`;

  const handleWarm = () => {
    router.prefetch(href);
  };

  const totalCount = totalMilestoneCount ?? feedMilestones?.length ?? 0;
  const verifiedCount = feedMilestones?.filter((m) => m.isVerified).length ?? 0;
  const milestoneProgressPct =
    totalCount > 0 ? Math.min(100, Math.round((verifiedCount / totalCount) * 100)) : 0;

  const showTipButton = !isEnded && !isCreator;
  const effectiveTokenAddress = delusion.tokenAddress;

  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmountInput, setTipAmountInput] = useState(() =>
    String(getDefaultTipAmount(effectiveTokenAddress)),
  );
  const [tipError, setTipError] = useState<string | null>(null);

  const {
    writeContract: writeTipMilestone,
    data: tipHash,
    isPending: isTippingMilestone,
  } = useUnifiedWriteContract();
  const { isLoading: isConfirmingTipMilestone, isSuccess: isTipSuccess } =
    useWaitForTransactionReceipt({ hash: tipHash });

  const { formatted: gBalanceFormatted, isLoading: isLoadingGBalance } =
    useTokenBalance(effectiveTokenAddress);
  const walletBalanceNum = Number(gBalanceFormatted ?? "0");
  const walletBalanceLabel = Number.isFinite(walletBalanceNum)
    ? walletBalanceNum.toFixed(2)
    : "0.00";

  const { data: celoBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    query: { enabled: !!address },
  });
  const celoBalanceNum = celoBalance ? Number(celoBalance.formatted) : null;
  const hasNoGas = celoBalanceNum !== null && celoBalanceNum < 0.001;

  const toUsd = (amount: number | null | undefined) =>
    formatUsdEquivalent(amount ?? 0, effectiveTokenAddress, gDollarUsdPrice);

  useEffect(() => {
    if (!isTipSuccess) return;
    setShowTipModal(false);
    refetchDeluluData(apolloClient, delusion.onChainId ?? delusion.id);
    if (address && delusion.creator) {
      fetch("/api/notifications/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipperAddress: address,
          creatorAddress: delusion.creator,
          deluluId: delusion.id,
          amount: tipAmountInput || null,
          tokenSymbol,
        }),
      }).catch(() => {});
    }
    setTipAmountInput(String(getDefaultTipAmount(effectiveTokenAddress)));
    setTipError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTipSuccess]);

  const handleOpenTip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!authenticated) {
      redirectToSignIn(href);
      return;
    }
    setTipAmountInput(String(getDefaultTipAmount(effectiveTokenAddress)));
    setTipError(null);
    setShowTipModal(true);
  };

  const handleSubmitTip = async () => {
    const allowed = await ensureWhitelisted("tip", effectiveTokenAddress);
    if (!allowed) return;

    const amountNum = Number(tipAmountInput);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setTipError("Enter a valid tip amount greater than 0.");
      return;
    }
    if (amountNum > walletBalanceNum) {
      setTipError(
        `Insufficient balance. You have ${walletBalanceLabel} ${tokenSymbol} available.`,
      );
      return;
    }
    let amountWei: bigint;
    try {
      amountWei = parseTokenAmount(tipAmountInput, effectiveTokenAddress);
    } catch {
      setTipError("Tip amount format is invalid.");
      return;
    }
    if (amountWei <= 0n) {
      setTipError("Enter a valid tip amount greater than 0.");
      return;
    }
    setTipError(null);
    writeTipMilestone({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "tipMilestone",
      args: [BigInt(delusion.onChainId ?? delusion.id), 0n, amountWei],
    });
  };

  return (
    <article className={cn("group/pin mb-10 break-inside-avoid", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[20px] bg-muted",
          pinAspectClass,
        )}
        style={{ background: cardGradient }}
      >
        <Link
          href={href}
          onMouseEnter={handleWarm}
          onTouchStart={handleWarm}
          className="absolute inset-0 z-0 block"
          prefetch
          aria-label={
            headlinePending
              ? `Delulu by ${creatorLabel}`
              : `${headline} by ${creatorLabel}`
          }
        />

        {coverImageSrc ? (
          <Image
            src={coverImageSrc}
            alt=""
            fill
            sizes={coverSizes}
            className="object-cover transition-transform duration-500 ease-out group-hover/pin:scale-[1.03]"
            {...coverLoadProps}
            unoptimized={coverImageSrc.startsWith("data:")}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/45" />

        {endedDurationLabel ? (
          <span className="pointer-events-none absolute left-3 top-3 z-[2] rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/90 backdrop-blur-md">
            {endedDurationLabel}
          </span>
        ) : null}

        {tvlValue > 0 ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[2] max-w-[calc(100%-1.5rem)]">
            <span className="inline-block rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tabular-nums text-delulu-charcoal shadow-sm backdrop-blur-sm">
              {supportUsdLabel
                ? `≈ $${supportUsdLabel}`
                : `${formattedGAmount} ${tokenSymbol}`}
            </span>
          </div>
        ) : null}
      </div>

      <div className="px-0.5 pt-2.5">
        <Link
          href={href}
          onMouseEnter={handleWarm}
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-delulu-blue/40"
        >
          {headlinePending ? (
            <div className="space-y-1.5" aria-hidden>
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <h3
              className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-foreground transition-colors group-hover/pin:text-delulu-charcoal/80 sm:text-lg"
            >
              {headline}
            </h3>
          )}
        </Link>

        {totalCount > 0 ? (
          <div className="mt-3 space-y-1.5">
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
        ) : null}

        <div className="mt-3 flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-border/50">
            <UserAvatar
              address={delusion.creator}
              username={displayUsername}
              pfpUrl={resolvedPfpUrl}
              size={32}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground/90">
              {creatorLabel}
            </p>
            {supportersCount > 0 ? (
              <p className="truncate text-xs text-muted-foreground">
                {supportersCount}{" "}
                {supportersCount === 1 ? "supporter" : "supporters"}
              </p>
            ) : tvlValue > 0 ? (
              <p className="truncate text-xs text-muted-foreground">
                {supportUsdLabel
                  ? `${formattedGAmount} ${tokenSymbol} tipped`
                  : "Be the first to tip"}
              </p>
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                New delulu
              </p>
            )}
          </div>
          {showTipButton ? (
            <button
              type="button"
              onClick={handleOpenTip}
              disabled={isCheckingWhitelist}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-delulu-blue px-3 text-xs font-bold text-white transition-colors hover:bg-delulu-blue/90 active:scale-[0.97] disabled:opacity-60"
            >
              <DollarSign className="h-3.5 w-3.5" strokeWidth={2.5} />
              Tip
            </button>
          ) : null}
        </div>
      </div>

      <DeluluTipModal
        open={showTipModal}
        onOpenChange={(open) => {
          setShowTipModal(open);
          if (open) {
            setTipAmountInput(String(getDefaultTipAmount(effectiveTokenAddress)));
          }
          if (!open) setTipError(null);
        }}
        tokenSymbol={tokenSymbol}
        tipAmountInput={tipAmountInput}
        onTipAmountChange={(value) => {
          setTipAmountInput(value);
          if (tipError) setTipError(null);
        }}
        walletBalanceNum={walletBalanceNum}
        walletBalanceLabel={walletBalanceLabel}
        isLoadingBalance={isLoadingGBalance}
        toUsd={toUsd}
        marketToken={effectiveTokenAddress}
        hasNoGas={hasNoGas}
        tipError={tipError}
        isTipping={isTippingMilestone}
        isConfirming={isConfirmingTipMilestone}
        onMax={() => {
          setTipAmountInput(String(Math.max(0, walletBalanceNum)));
          if (tipError) setTipError(null);
        }}
        onQuickTip={(amount) => setTipAmountInput(String(amount))}
        onSubmit={handleSubmitTip}
      />
    </article>
  );
}
