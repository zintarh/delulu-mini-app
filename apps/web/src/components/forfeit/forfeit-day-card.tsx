"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits } from "viem";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { SubmitProofModal } from "@/components/submit-proof-modal";
import {
  forfeitFeedKeys,
  isActiveForfeit,
  useCreatorForfeits,
  useVerifierForfeits,
  type ForfeitFeedItem,
  type ForfeitPeriodSnapshot,
} from "@/hooks/use-creator-forfeits";
import {
  ForfeitCadence,
  ForfeitDestinationType,
  useResolveForfeitCommitmentSuccess,
  useSubmitForfeitProof,
} from "@/hooks/use-create-forfeit-commitment";
import { submitForfeitProofWithWallet } from "@/lib/forfeit/submit-forfeit-proof-client";
import { usePendingForfeitSync } from "@/lib/forfeit/use-pending-forfeit-sync";
import { proofErrorMessage } from "@/lib/community/format-proof-error";
import { useUserStore } from "@/stores/useUserStore";
import { TOKEN_LOGOS } from "@/lib/constant";
import { getTokenDecimals, getTokenSymbol } from "@/lib/token-amounts";
import { cn } from "@/lib/utils";
import {
  buildForfeitCalendarSlots,
  dayKey,
  startOfDay,
} from "@/lib/forfeit/forfeit-schedule";
import {
  FEED_CARD_CTA_CLASS,
  FEED_CARD_META_CLASS,
  FEED_CARD_SUBTITLE_CLASS,
  FEED_CARD_TITLE_CLASS,
} from "@/components/feed-card-layout";

type PeriodStatus = "past" | "current" | "upcoming";

type DayItem = {
  key: string;
  role: "creator" | "verifier";
  forfeit: ForfeitFeedItem;
  /** On-chain period used for proof submit / lookup. */
  periodIndex: number;
  /** 0-based day in the forfeit calendar (for "Day X of Y"). */
  calendarPeriodIndex: number;
  /** Calendar day this slot belongs to (local midnight). */
  dayDate: Date;
  periodDeadline: Date;
  period: ForfeitPeriodSnapshot | null;
  periodStatus: PeriodStatus;
};

type DayBucket = {
  key: string;
  dayDate: Date;
  items: DayItem[];
};

/** e.g. "Sunday, July 26" — no year */
function formatForfeitDayLabel(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function periodSecondsFor(item: ForfeitFeedItem): number {
  const raw = Number(item.onChain?.periodSeconds ?? 0);
  if (Number.isFinite(raw) && raw > 0) return raw;
  const cadence = Number(item.onChain?.cadence ?? 0);
  if (cadence === ForfeitCadence.Weekly) return 604_800;
  if (cadence === ForfeitCadence.Monthly) return 2_592_000;
  return 86_400;
}

function isRepeatingForfeit(item: ForfeitFeedItem): boolean {
  const total = item.onChain?.totalPeriods ?? 1;
  const cadence = Number(item.onChain?.cadence ?? 0);
  return cadence !== ForfeitCadence.Once && total > 1;
}

function formatForfeitDuration(item: ForfeitFeedItem): string {
  const total = item.onChain?.totalPeriods ?? 1;
  const cadence = Number(item.onChain?.cadence ?? 0);
  // totalPeriods comes from the user's duration end date at create time.
  if (!isRepeatingForfeit(item) || cadence === ForfeitCadence.Once) return "One time";
  if (cadence === ForfeitCadence.Daily) {
    return total === 1 ? "Every day" : `Every day · ${total} days`;
  }
  if (cadence === ForfeitCadence.Weekday) {
    return total === 1 ? "Every weekday" : `Every weekday · ${total} days`;
  }
  if (cadence === ForfeitCadence.Weekly) {
    return total === 1 ? "Every week" : `Every week · ${total} weeks`;
  }
  if (cadence === ForfeitCadence.Monthly) {
    return total === 1 ? "Every month" : `Every month · ${total} months`;
  }
  return "Repeating";
}

function formatPeriodProgress(item: ForfeitFeedItem, periodIndex: number): string | null {
  if (!isRepeatingForfeit(item)) return null;
  const total = item.onChain?.totalPeriods ?? 1;
  return `Day ${periodIndex + 1} of ${total}`;
}

function periodForIndex(
  item: ForfeitFeedItem,
  periodIndex: number,
): ForfeitPeriodSnapshot | null {
  const fromList = item.periods?.find((p) => p.periodIndex === periodIndex);
  if (fromList) return fromList;
  if (
    (item.onChain?.currentPeriodIndex ?? 0) === periodIndex &&
    item.currentPeriod
  ) {
    return { ...item.currentPeriod, periodIndex };
  }
  return null;
}

/**
 * Expand a forfeit onto consecutive calendar days starting from the create day.
 * Shared schedule math keeps create → on-chain → day card aligned.
 */
function expandForfeitDays(
  forfeit: ForfeitFeedItem,
  role: "creator" | "verifier",
): DayItem[] {
  const currentIdx = forfeit.onChain?.currentPeriodIndex ?? 0;
  const total = Math.max(1, forfeit.onChain?.totalPeriods ?? 1);
  const slots = buildForfeitCalendarSlots({
    createdAt: forfeit.createdAt || new Date(),
    totalPeriods: total,
    currentPeriodIndex: currentIdx,
    currentPeriodDeadlineSec: Number(forfeit.onChain?.currentPeriodDeadline ?? 0),
    periodSeconds: periodSecondsFor(forfeit),
    isRepeating: isRepeatingForfeit(forfeit),
  });

  return slots.map((slot) => ({
    key: `${role}:${forfeit.id}:${dayKey(slot.dayDate)}:${slot.calendarPeriodIndex}`,
    role,
    forfeit,
    periodIndex: slot.periodIndex,
    calendarPeriodIndex: slot.calendarPeriodIndex,
    dayDate: slot.dayDate,
    periodDeadline: new Date(slot.periodDeadlineSec * 1000),
    period: periodForIndex(forfeit, slot.periodIndex),
    periodStatus: slot.periodStatus,
  }));
}

function groupIntoDayBuckets(items: DayItem[]): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const item of items) {
    const key = dayKey(item.dayDate);
    const existing = map.get(key);
    if (existing) {
      // One row per forfeit per day (prefer the live/current slot if duplicated).
      const prevIdx = existing.items.findIndex(
        (x) => x.forfeit.id === item.forfeit.id && x.role === item.role,
      );
      if (prevIdx >= 0) {
        const prev = existing.items[prevIdx]!;
        if (
          item.periodStatus === "current" ||
          (item.periodStatus === prev.periodStatus &&
            item.periodIndex <= prev.periodIndex)
        ) {
          existing.items[prevIdx] = item;
        }
      } else {
        existing.items.push(item);
      }
    } else {
      map.set(key, { key, dayDate: item.dayDate, items: [item] });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => a.dayDate.getTime() - b.dayDate.getTime(),
  );
}

function formatStakeAmount(item: ForfeitFeedItem): string | null {
  const chain = item.onChain;
  if (!chain?.stakeAmount || !chain.token) return null;
  try {
    const decimals = getTokenDecimals(chain.token);
    const raw = formatUnits(BigInt(chain.stakeAmount), decimals);
    const n = Number(raw);
    if (!Number.isFinite(n)) return raw;
    return n >= 100
      ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return null;
  }
}

function destinationLabel(item: ForfeitFeedItem): string | null {
  const type = item.onChain?.destinationType;
  const addr = item.onChain?.destinationAddr;

  // Charity vs Delulu both settle to CommunityPool on-chain — intent wins.
  if (item.isCharityIntent || type === ForfeitDestinationType.Charity) {
    return "Charity";
  }
  if (type === ForfeitDestinationType.CommunityPool) {
    return "Delulu";
  }
  if (type === ForfeitDestinationType.SelfReturn) {
    return "you";
  }
  if (type === ForfeitDestinationType.Friend) {
    const username = item.destinationFriendUsername?.trim();
    if (username) return username.startsWith("@") ? username : `@${username}`;
    const email = item.destinationFriendEmail?.trim();
    if (email && !email.endsWith("@wallet.local")) return email;
    if (addr && addr.startsWith("0x") && addr.length >= 10) {
      return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
    }
    return "a friend";
  }
  // Snapshot lag: still show Delulu/Charity from intent alone.
  if (type == null && !item.isCharityIntent) return null;
  return null;
}

function TokenMark({
  tokenAddress,
  symbol,
}: {
  tokenAddress?: string | null;
  symbol: string;
}) {
  const logo = tokenAddress ? TOKEN_LOGOS[tokenAddress.toLowerCase()] : undefined;
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={symbol}
        className="h-6 w-6 shrink-0 rounded-full bg-muted object-cover ring-1 ring-border/50"
      />
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-black text-foreground ring-1 ring-border/50">
      {symbol.slice(0, 2)}
    </span>
  );
}

function ForfeitTaskCard({
  item,
  day,
  onSubmitProof,
  proofBusy,
}: {
  item: ForfeitFeedItem;
  day: DayItem;
  onSubmitProof: () => void;
  proofBusy: boolean;
}) {
  const amount = formatStakeAmount(item);
  const symbol = item.onChain?.token ? getTokenSymbol(item.onChain.token) : "G$";
  const tokenAddress = item.onChain?.token;
  const destination = destinationLabel(item);
  const isPendingSync = item.id.startsWith("pending:");
  const duration = formatForfeitDuration(item);
  const progress = formatPeriodProgress(item, day.calendarPeriodIndex);

  const proofUrl = day.period?.proofUrl ?? null;
  const proofSubmitted = Boolean(proofUrl);
  const resolved = !!day.period?.resolvedAt;
  const isFriendVerified = item.verificationMethod === "friend";
  const canSubmit = day.periodStatus === "current" && !isPendingSync;

  const action = (() => {
    if (isPendingSync) {
      return (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/70 px-3.5 py-2 text-muted-foreground",
            FEED_CARD_CTA_CLASS,
          )}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Setting up…
        </span>
      );
    }

    if (proofSubmitted) {
      if (day.periodStatus === "current" && !resolved && isFriendVerified) {
        return (
          <span
            className={cn(
              "max-w-[9.5rem] shrink-0 rounded-full bg-muted/60 px-3 py-2 text-right text-muted-foreground",
              FEED_CARD_META_CLASS,
            )}
          >
            {item.otherPartyUsername
              ? `Waiting for @${item.otherPartyUsername}`
              : "Waiting for verifier"}
          </span>
        );
      }
      if (day.periodStatus === "current" && !resolved) {
        return (
          <a
            href={proofUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/70 px-3.5 py-2 text-foreground transition-opacity hover:opacity-80",
              FEED_CARD_CTA_CLASS,
            )}
          >
            View proof
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        );
      }
      return (
        <a
          href={proofUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/70 px-3.5 py-2 text-foreground transition-opacity hover:opacity-80",
            FEED_CARD_CTA_CLASS,
          )}
        >
          View proof
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      );
    }

    if (day.periodStatus === "past") {
      return (
        <span
          className={cn(
            "shrink-0 rounded-full bg-amber-500/10 px-3.5 py-2 text-amber-700",
            FEED_CARD_META_CLASS,
          )}
        >
          No proof
        </span>
      );
    }

    if (day.periodStatus === "upcoming") {
      return (
        <span
          className={cn(
            "shrink-0 rounded-full bg-muted/60 px-3.5 py-2 text-muted-foreground",
            FEED_CARD_META_CLASS,
          )}
        >
          Up next
        </span>
      );
    }

    if (canSubmit) {
      return (
        <button
          type="button"
          onClick={onSubmitProof}
          disabled={proofBusy}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-delulu-charcoal px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:opacity-60",
            FEED_CARD_CTA_CLASS,
          )}
        >
          {proofBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Upload proof
        </button>
      );
    }

    return null;
  })();

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
      <p className={FEED_CARD_TITLE_CLASS}>
        {item.title || "Untitled forfeit"}
      </p>
      <p className={cn("mt-1", FEED_CARD_META_CLASS)}>
        {duration}
        {progress ? ` · ${progress}` : null}
      </p>

      <div className="mt-3 flex items-center gap-3">
        <TokenMark tokenAddress={tokenAddress} symbol={symbol} />
        <p className={cn("min-w-0 flex-1", FEED_CARD_SUBTITLE_CLASS)}>
          <span className="font-medium">Failed.</span>{" "}
          <span className="font-semibold text-foreground/80">Forfeit</span>
          {amount ? (
            <>
              {" "}
              <span className="font-bold tabular-nums text-foreground">
                {amount} {symbol}
              </span>
            </>
          ) : null}
          {destination ? (
            <>
              <span> to </span>
              <span className="font-semibold text-foreground">{destination}</span>
            </>
          ) : null}
        </p>
        {action}
      </div>
    </div>
  );
}

function ForfeitVerifyCard({ day }: { day: DayItem }) {
  const item = day.forfeit;
  const amount = formatStakeAmount(item);
  const symbol = item.onChain?.token ? getTokenSymbol(item.onChain.token) : "G$";
  const tokenAddress = item.onChain?.token;
  const hasProof = !!day.period?.proofUrl;
  const duration = formatForfeitDuration(item);
  const progress = formatPeriodProgress(item, day.calendarPeriodIndex);

  return (
    <div className="rounded-3xl border border-delulu-blue/30 bg-delulu-blue-light/30 p-5 shadow-sm">
      <div className={cn("mb-2.5 flex items-center gap-2 text-delulu-blue", FEED_CARD_META_CLASS)}>
        <ShieldCheck className="h-3.5 w-3.5" />
        <span className="font-bold uppercase tracking-wide">You&apos;re verifying</span>
      </div>

      <div className="flex items-center gap-2.5">
        <UserAvatar
          address={item.creatorWallet}
          username={item.otherPartyUsername}
          pfpUrl={item.otherPartyPfpUrl}
          size={28}
        />
        <p className={cn("truncate", FEED_CARD_SUBTITLE_CLASS, "font-semibold text-foreground")}>
          {item.otherPartyUsername ? `@${item.otherPartyUsername}` : "A friend"}
        </p>
      </div>

      <p className={cn("mt-2.5", FEED_CARD_TITLE_CLASS)}>
        {item.title || "Untitled forfeit"}
      </p>
      <p className={cn("mt-1", FEED_CARD_META_CLASS)}>
        {duration}
        {progress ? ` · ${progress}` : null}
      </p>

      {amount ? (
        <div className="mt-2.5 flex items-center gap-2">
          <TokenMark tokenAddress={tokenAddress} symbol={symbol} />
          <p className={FEED_CARD_SUBTITLE_CLASS}>
            <span className="font-medium">At stake</span>{" "}
            <span className="font-bold tabular-nums text-foreground">
              {amount} {symbol}
            </span>
          </p>
        </div>
      ) : null}

      <Link
        href={`/forfeit/verify/${item.onChainCommitmentId ?? ""}`}
        className={cn(
          "mt-4 flex w-full items-center justify-center gap-2 rounded-full py-2.5 transition-opacity",
          FEED_CARD_CTA_CLASS,
          hasProof
            ? "bg-delulu-charcoal text-white hover:opacity-90"
            : "border border-delulu-blue/40 bg-transparent text-delulu-blue",
        )}
      >
        {hasProof ? "Review proof" : "View forfeit"}
      </Link>
    </div>
  );
}

/** Single empty CTA — no promo banner above it. */
function ForfeitEmptyState() {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-border/60 bg-card px-5 py-10 text-center shadow-sm">
      <Calendar className="h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />
      <p className={cn("mt-4", FEED_CARD_TITLE_CLASS)}>No forfeit</p>
      <p className={cn("mt-1.5 max-w-[16rem]", FEED_CARD_SUBTITLE_CLASS)}>
        Stake on a goal. Miss it, and the stake goes where you choose.
      </p>
      <Link
        href="/forfeit"
        aria-label="Create a forfeit"
        className="mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </Link>
    </div>
  );
}

/**
 * Reusable forfeit spotlight: date between left/right arrows, then a card with
 * the day's forfeit — either your own (with a submit-proof action) or one
 * you're the named verifier for (with a link into the review page). Sorted by
 * due date, soonest first, so the arrows page through days rather than an
 * arbitrary list order. Used on home and the profile Forfeit tab.
 *
 * When empty, only the centered empty state is shown — no top promo / create banner.
 */
export function ForfeitDayCard({
  address,
  className,
  showCreateWhenEmpty = true,
}: {
  address: string;
  className?: string;
  showCreateWhenEmpty?: boolean;
}) {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const { data: creatorData, isLoading: creatorLoading } = useCreatorForfeits(address);
  const { data: verifierData, isLoading: verifierLoading } = useVerifierForfeits(address);
  const { optimisticItem, justSynced } = usePendingForfeitSync(address);
  const isLoading = creatorLoading || verifierLoading;

  const { submitProofAndWait } = useSubmitForfeitProof();
  const { resolveCommitmentSuccessAndWait } = useResolveForfeitCommitmentSuccess();

  useEffect(() => {
    if (!justSynced) return;
    void queryClient.invalidateQueries({ queryKey: forfeitFeedKeys.creator(address) });
  }, [justSynced, address, queryClient]);

  const items = useMemo<DayItem[]>(() => {
    const creatorForfeits = (creatorData ?? []).filter(isActiveForfeit);
    const verifierForfeits = (verifierData ?? []).filter(isActiveForfeit);

    const creatorDays = creatorForfeits.flatMap((f) => expandForfeitDays(f, "creator"));
    const verifierDays = verifierForfeits.flatMap((f) => expandForfeitDays(f, "verifier"));

    // Stake already locked but DB row not ready — keep the card visible so money never "vanishes".
    const alreadyIndexed = optimisticItem
      ? creatorForfeits.some(
          (c) =>
            c.title === optimisticItem.title &&
            c.onChain?.stakeAmount === optimisticItem.onChain?.stakeAmount,
        )
      : false;

    const optimisticDays =
      optimisticItem && !alreadyIndexed
        ? expandForfeitDays(optimisticItem, "creator")
        : [];

    return [...optimisticDays, ...creatorDays, ...verifierDays];
  }, [creatorData, verifierData, optimisticItem]);

  const dayBuckets = useMemo(() => groupIntoDayBuckets(items), [items]);

  const [dayIndex, setDayIndex] = useState(0);
  const bucketsKey = dayBuckets.map((b) => b.key).join("|");

  // Land on today (or nearest day with forfeits) when the calendar shape changes.
  useEffect(() => {
    if (dayBuckets.length === 0) {
      setDayIndex(0);
      return;
    }
    const todayKey = dayKey(new Date());
    const todayIdx = dayBuckets.findIndex((b) => b.key === todayKey);
    if (todayIdx >= 0) {
      setDayIndex(todayIdx);
      return;
    }
    // Prefer the soonest upcoming day, else the latest past day.
    const upcomingIdx = dayBuckets.findIndex(
      (b) => b.dayDate.getTime() > startOfDay(new Date()).getTime(),
    );
    setDayIndex(upcomingIdx >= 0 ? upcomingIdx : dayBuckets.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when keys change
  }, [bucketsKey]);

  const safeDayIndex =
    dayBuckets.length === 0 ? 0 : Math.min(dayIndex, dayBuckets.length - 1);
  const currentBucket = dayBuckets[safeDayIndex] ?? null;
  const currentDays = currentBucket?.items ?? [];

  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [proofStep, setProofStep] = useState<
    "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming"
  >("idle");
  const [activeProofItem, setActiveProofItem] = useState<ForfeitFeedItem | null>(null);

  const goPrev = () => setDayIndex((i) => Math.max(0, i - 1));
  const goNext = () => setDayIndex((i) => Math.min(dayBuckets.length - 1, i + 1));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: forfeitFeedKeys.creator(address) });
    void queryClient.invalidateQueries({ queryKey: forfeitFeedKeys.verifier(address) });
  };

  const handleProofSubmit = async (proofUrls: string[]) => {
    if (!activeProofItem?.onChainCommitmentId) {
      const msg =
        "This forfeit is still setting up. Wait a moment, then try uploading again.";
      setProofError(msg);
      throw new Error(msg);
    }
    setProofBusy(true);
    setProofError(null);
    setProofStep("ai-verifying");
    try {
      await submitForfeitProofWithWallet({
        onChainCommitmentId: activeProofItem.onChainCommitmentId,
        walletAddress: address,
        proofUrls,
        submitProofOnChain: submitProofAndWait,
        resolveSuccessOnChain: resolveCommitmentSuccessAndWait,
        onStepChange: setProofStep,
      });
      setProofSuccess(true);
      invalidate();
    } catch (err) {
      const msg = proofErrorMessage(err);
      setProofError(msg);
      setProofStep("idle");
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setProofBusy(false);
    }
  };

  if (isLoading) {
    return (
      <section className={cn(className)}>
        <div className="animate-pulse rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="h-5 w-3/4 rounded-lg bg-muted" />
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-full bg-muted" />
            <div className="h-4 w-48 rounded bg-muted" />
          </div>
        </div>
      </section>
    );
  }

  // Empty: one centered state only (no date chrome, no separate promo banner).
  if (!currentBucket || currentDays.length === 0) {
    return (
      <section className={cn(className)}>
        {showCreateWhenEmpty ? (
          <ForfeitEmptyState />
        ) : (
          <div className="flex flex-col items-center rounded-3xl border border-border/60 bg-card px-5 py-10 text-center shadow-sm">
            <Calendar className="h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />
            <p className={cn("mt-4", FEED_CARD_TITLE_CLASS)}>No forfeit</p>
          </div>
        )}
      </section>
    );
  }

  const label = currentBucket.dayDate;
  const isLiveCamera = activeProofItem?.evidenceType === "camera";

  return (
    <section className={cn(className)}>
      <div className="mb-6 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={safeDayIndex <= 0 || dayBuckets.length <= 1}
          aria-label="Previous day"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0d0d0d] text-white shadow-sm transition-colors hover:bg-black disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <p className={cn("min-w-0 flex-1 text-center font-semibold text-foreground", FEED_CARD_SUBTITLE_CLASS)}>
          {formatForfeitDayLabel(label)}
        </p>

        <button
          type="button"
          onClick={goNext}
          disabled={safeDayIndex >= dayBuckets.length - 1 || dayBuckets.length <= 1}
          aria-label="Next day"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0d0d0d] text-white shadow-sm transition-colors hover:bg-black disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-2">
        {currentDays.map((day) =>
          day.role === "verifier" ? (
            <ForfeitVerifyCard key={day.key} day={day} />
          ) : (
            <ForfeitTaskCard
              key={day.key}
              item={day.forfeit}
              day={day}
              proofBusy={proofBusy && activeProofItem?.id === day.forfeit.id}
              onSubmitProof={() => {
                if (day.periodStatus !== "current") return;
                setActiveProofItem(day.forfeit);
                setProofSuccess(false);
                setProofError(null);
                setProofStep("idle");
                setProofOpen(true);
              }}
            />
          ),
        )}
        {dayBuckets.length > 1 ? (
          <p className="text-center text-[11px] text-muted-foreground">
            Day {safeDayIndex + 1} of {dayBuckets.length}
          </p>
        ) : null}
      </div>

      <SubmitProofModal
        open={proofOpen}
        onOpenChange={setProofOpen}
        onSubmit={handleProofSubmit}
        proofType={isLiveCamera ? "live_camera" : undefined}
        isSubmitting={proofBusy}
        submitSuccess={proofSuccess}
        submitError={proofError ? new Error(proofError) : null}
        proofStep={proofStep}
        onDone={() => {
          setProofOpen(false);
          setProofSuccess(false);
          setActiveProofItem(null);
        }}
        isOnChain
        campaignTitle={activeProofItem?.title}
        myUsername={user?.username}
        myAvatar={user?.pfpUrl}
      />
    </section>
  );
}
