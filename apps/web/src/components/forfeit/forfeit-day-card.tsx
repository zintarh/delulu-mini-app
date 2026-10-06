"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits } from "viem";
import {
  Calendar,
  Camera,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { Bolt, CheckDot, GameButton, HabitTile, Lulu, ProgressBar, Stamp, gameButtonClass, type HabitTint } from "@/components/ds";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { SubmitProofModal } from "@/components/submit-proof-modal";
import {
  forfeitFeedKeys,
  hasConfirmedForfeitState,
  useCreatorForfeits,
  useDestinationForfeits,
  useVerifierForfeits,
  type ForfeitFeedItem,
  type ForfeitPeriodSnapshot,
} from "@/hooks/use-creator-forfeits";
import {
  ForfeitCadence,
  ForfeitDestinationType,
  useCancelForfeitCommitment,
  useResolveForfeitCommitmentSuccess,
  useSubmitForfeitProof,
} from "@/hooks/use-create-forfeit-commitment";
import { submitForfeitProofWithWallet } from "@/lib/forfeit/submit-forfeit-proof-client";
import { usePendingForfeitSync } from "@/lib/forfeit/use-pending-forfeit-sync";
import { useFastResolveForfeit } from "@/lib/forfeit/use-fast-resolve-forfeit";
import { proofErrorMessage } from "@/lib/community/format-proof-error";
import { buildSignInUrl, persistSignInRedirect } from "@/lib/auth-redirect";
import { useUserStore } from "@/stores/useUserStore";
import { getTokenDecimals, getTokenSymbol } from "@/lib/token-amounts";
import { FORFEIT_CREATION_ENABLED } from "@/lib/constant";
import { cn } from "@/lib/utils";
import {
  buildForfeitCalendarSlots,
  dayKey,
  resolvePeriodOutcome,
  startOfDay,
  type PeriodOutcome,
} from "@/lib/forfeit/forfeit-schedule";
import {
  FEED_CARD_CTA_CLASS,
  FEED_CARD_EYEBROW_CLASS,
  FEED_CARD_META_CLASS,
  FEED_CARD_SUBTITLE_CLASS,
  FEED_CARD_TITLE_CLASS,
} from "@/components/feed-card-layout";

type PeriodStatus = "past" | "current" | "upcoming";

type DayItem = {
  key: string;
  role: "creator" | "verifier" | "destination";
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
  role: "creator" | "verifier" | "destination",
): DayItem[] {
  const currentIdx = forfeit.onChain?.currentPeriodIndex ?? 0;
  const total = Math.max(1, forfeit.onChain?.totalPeriods ?? 1);
  const isRepeating = isRepeatingForfeit(forfeit);
  const slots = buildForfeitCalendarSlots({
    createdAt: forfeit.createdAt || new Date(),
    totalPeriods: total,
    currentPeriodIndex: currentIdx,
    currentPeriodDeadlineSec: Number(
      forfeit.onChain?.currentPeriodDeadline ?? 0,
    ),
    periodSeconds: periodSecondsFor(forfeit),
    isRepeating,
    // Once confirmed inactive (resolved early, forfeited, or cancelled via
    // Discontinue), buildForfeitCalendarSlots itself caps slot generation at
    // the period the commitment actually stopped on — a repeating forfeit
    // cancelled on day 3 of 365 must not keep surfacing days 4 through 365
    // as if still live, no matter how much later this is viewed.
    commitmentActiveOnChain: forfeit.onChain?.active,
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
        const prevHasProof = Boolean(prev.period?.proofUrl);
        const itemHasProof = Boolean(item.period?.proofUrl);
        if (itemHasProof && !prevHasProof) {
          existing.items[prevIdx] = item;
        } else if (
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

const ROLE_HEADINGS: Record<DayItem["role"], string> = {
  creator: "Today's forfeit",
  verifier: "Verifying",
  destination: "Tagged forfeit",
};

/**
 * Splits one day's items by role so mixed days (e.g. your own forfeit plus one
 * you're verifying) get a short heading instead of dumping every card together.
 * A single-role day renders no heading at all — see the roleGroups.length check
 * at the call site.
 */
function groupDaysByRole(
  days: DayItem[],
): Array<{ role: DayItem["role"]; heading: string; items: DayItem[] }> {
  const order: DayItem["role"][] = ["creator", "verifier", "destination"];
  return order
    .map((role) => ({
      role,
      heading: ROLE_HEADINGS[role],
      items: days.filter((d) => d.role === role),
    }))
    .filter((group) => group.items.length > 0);
}

export function formatStakeAmount(item: ForfeitFeedItem): string | null {
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

export function destinationLabel(item: ForfeitFeedItem): string | null {
  const type =
    item.onChain?.destinationType != null
      ? Number(item.onChain.destinationType)
      : null;

  // Charity vs Delulu both settle to CommunityPool on-chain — intent wins.
  if (item.isCharityIntent || type === ForfeitDestinationType.Charity) {
    return "Charity";
  }
  if (type === ForfeitDestinationType.CommunityPool) {
    return "the pool";
  }
  if (type === ForfeitDestinationType.SelfReturn) {
    return "you";
  }
  if (type === ForfeitDestinationType.Friend) {
    const username = item.destinationFriendUsername?.trim();
    if (username) {
      return `your friend ${username.startsWith("@") ? username : `@${username}`}`;
    }
    const email = item.destinationFriendEmail?.trim();
    if (email && !email.endsWith("@wallet.local"))
      return `your friend ${email}`;
    // Prefer never showing a raw address when we know it's a friend destination.
    return "a friend";
  }
  // Snapshot lag: still show Delulu/Charity from intent alone.
  if (type == null && !item.isCharityIntent) return null;
  return null;
}

/** Resolve whether this calendar day already settled as a win, a confirmed
 * on-chain miss, is merely overdue-but-unresolved, or still open. */
function periodOutcome(day: DayItem): PeriodOutcome {
  return resolvePeriodOutcome({
    periodIndex: day.periodIndex,
    currentPeriodIndex: day.forfeit.onChain?.currentPeriodIndex ?? 0,
    periodStatus: day.periodStatus,
    commitmentActiveOnChain: day.forfeit.onChain?.active,
    period: day.period,
  });
}

/** How many periods this forfeit has actually had a successful proof resolved
 * for — the real "how far along" number, not just the elapsed calendar day. */
function countCompletedPeriods(item: ForfeitFeedItem): number {
  return (item.periods ?? []).filter((p) => {
    if (p.verifierAction === "rejected" || p.verifierAction === "timed_out")
      return false;
    if (p.verifierAction === "approved" && p.resolvedAt) return true;
    return Boolean(p.resolvedAt && p.proofUrl);
  }).length;
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
  const isPendingSync = item.id.startsWith("pending:");

  const proofUrl = day.period?.proofUrl ?? null;
  const proofSubmitted = Boolean(proofUrl);
  const resolved = !!day.period?.resolvedAt;
  const isFriendVerified = item.verificationMethod === "friend";
  const canSubmit = day.periodStatus === "current" && !isPendingSync;
  const outcome = periodOutcome(day);

  const action = (() => {
    // A confirmed win gets its own status pill (below) instead of the
    // generic "View proof" link, so a completed day is visually unmistakable
    // from an in-progress one rather than looking identical minus the color
    // of one line of text.
    if (outcome === "won") return null;

    if (isPendingSync) {
      return (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/70 px-3.5 py-1.5 text-muted-foreground",
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
              "max-w-[9.5rem] shrink-0 rounded-full bg-muted/60 px-3 py-1.5 text-right text-muted-foreground",
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
              "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/70 px-3.5 py-1.5 text-foreground transition-opacity hover:opacity-80",
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
      return null;
    }

    if (day.periodStatus === "upcoming") {
      return (
        <span
          className={cn(
            "shrink-0 rounded-full bg-muted/60 px-3.5 py-1.5 text-muted-foreground",
            FEED_CARD_META_CLASS,
          )}
        >
          Up next
        </span>
      );
    }

    if (canSubmit) {
      return (
        <GameButton size="sm" onClick={onSubmitProof} disabled={proofBusy}>
          {proofBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Prove
        </GameButton>
      );
    }

    return null;
  })();

  // Fills the trailing slot when there's no proof-review action to show —
  // "past, nothing submitted" otherwise renders nothing on the right at all.
  // "won" is clickable (links to the submitted proof) when one exists, so
  // completing a day doesn't lose the ability to look back at what you sent.
  const statusPill =
    outcome === "won" ? (
      proofUrl ? (
        <a href={proofUrl} target="_blank" rel="noopener noreferrer" aria-label="Kept — view proof" className="shrink-0">
          <CheckDot />
        </a>
      ) : (
        <span className="shrink-0" aria-label="Kept">
          <CheckDot />
        </span>
      )
    ) : outcome === "overdue" ? (
      <span className="shrink-0 rounded-full bg-orange-soft px-3 py-1 text-xs font-bold text-orange">Overdue</span>
    ) : outcome === "failed" ? (
      <Stamp tone="lost" className="shrink-0 text-[10px]">Missed</Stamp>
    ) : null;
  const totalPeriods = item.onChain?.totalPeriods ?? 1;
  // Always show which day this was once it's settled (won/failed) — even a
  // one-off forfeit benefits from "Day 1 of 1" context distinguishing a
  // finished item from one still in progress, not just repeating plans.
  const showProgress = isRepeatingForfeit(item) || outcome === "won" || outcome === "failed";

  const isDue = canSubmit && !proofSubmitted;
  const tile = evidenceTile(item.evidenceType);
  const dayLabel = `Day ${day.calendarPeriodIndex + 1}/${totalPeriods}`;
  const timeLabel = (() => {
    const at = outcome === "won" && day.period?.resolvedAt ? new Date(day.period.resolvedAt) : day.periodDeadline;
    return at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  })();
  const href = item.onChainCommitmentId != null ? `/forfeit/${item.onChainCommitmentId}` : null;

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-[20px] border-2 bg-white p-3",
        isDue ? "border-yellow-line shadow-edge-yellow-line" : "border-line shadow-edge",
      )}
    >
      <HabitTile icon={tile.icon} tint={tile.tint} />
      <div className="min-w-0 flex-1">
        {href ? (
          <Link
            href={href}
            className="block truncate text-base font-bold text-ink no-underline after:absolute after:inset-0 after:rounded-[18px] after:content-['']"
          >
            {item.title || "Untitled contract"}
          </Link>
        ) : (
          <p className="truncate text-base font-bold text-ink">{item.title || "Untitled contract"}</p>
        )}
        {outcome === "won" ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Bolt size={14} />
            <span className="label-mono text-[10px] text-blue">{dayLabel}</span>
            <span className="label-mono text-[10px] text-muted-foreground">· {timeLabel}</span>
          </div>
        ) : (
          <div className="mt-[7px] flex items-center gap-2">
            {showProgress || isDue ? (
              <ProgressBar
                thin
                tone={outcome === "failed" || outcome === "overdue" ? "grey" : "yellow"}
                value={(day.calendarPeriodIndex + 1) / totalPeriods}
                className="w-16"
                label={`Day ${day.calendarPeriodIndex + 1} of ${totalPeriods}`}
              />
            ) : null}
            <span className="label-mono text-[10px] text-muted-foreground">
              {dayLabel} · {timeLabel}
            </span>
          </div>
        )}
      </div>
      <div className="relative z-10 shrink-0">{action ?? statusPill}</div>
    </div>
  );
}

/** Habit tile icon/color by how the proof is captured. */
function evidenceTile(evidenceType: string): { icon: typeof Camera; tint: HabitTint } {
  if (evidenceType === "camera") return { icon: Camera, tint: "pink" };
  if (evidenceType === "gps-checkin") return { icon: MapPin, tint: "green" };
  return { icon: ImageIcon, tint: "blue" };
}

function creatorDisplayName(item: ForfeitFeedItem): string {
  const username = item.otherPartyUsername?.trim();
  if (username) return username.startsWith("@") ? username : `@${username}`;
  if (item.creatorWallet) return formatAddressShort(item.creatorWallet);
  return "A friend";
}

function formatAddressShort(wallet: string): string {
  if (wallet.length < 10) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function ForfeitVerifyCard({ day }: { day: DayItem }) {
  const item = day.forfeit;
  const amount = formatStakeAmount(item);
  const symbol = item.onChain?.token
    ? getTokenSymbol(item.onChain.token)
    : "G$";
  const hasProof = !!day.period?.proofUrl;
  const creatorName = creatorDisplayName(item);

  // The creator not submitting is exactly the case a verifier most needs to
  // see reflected here — otherwise this card just says "Verifying" forever,
  // even once it's actually overdue or already forfeited.
  const outcome = periodOutcome(day);
  const label =
    outcome === "won"
      ? "Completed"
      : outcome === "failed"
        ? "Forfeited"
        : outcome === "overdue"
          ? "Overdue"
          : "Verifying";
  const labelColor =
    outcome === "won"
      ? "text-green-edge"
      : outcome === "failed"
        ? "text-orange"
        : outcome === "overdue"
          ? "text-orange"
          : "text-ink";

  return (
    <div className="rounded-3xl bg-white dark:bg-card p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <UserAvatar
            address={item.creatorWallet}
            username={item.otherPartyUsername}
            pfpUrl={item.otherPartyPfpUrl}
            size={38}
          />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue text-white ring-2 ring-white">
            <ShieldCheck className="h-2.5 w-2.5" strokeWidth={2.5} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className={cn("text-[10px] font-extrabold uppercase tracking-wide", labelColor)}>
            {label}
          </p>
          <p className="mt-0.5 text-sm font-extrabold leading-snug text-foreground">
            {item.title || "Untitled forfeit"}
          </p>
        </div>
      </div>

      <div className="mt-1.5 flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm text-muted-foreground">
          {amount ? (
            <>
              <span className="font-bold text-foreground">
                {amount} {symbol}
              </span>{" "}
              · {creatorName}
            </>
          ) : (
            creatorName
          )}
        </p>
        <Link
          href={`/forfeit/verify/${item.onChainCommitmentId ?? ""}`}
          className="ml-auto w-fit shrink-0 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {outcome === "pending" && hasProof ? "Review" : "View"}
        </Link>
      </div>
    </div>
  );
}

/**
 * Informational only — you're not the creator or verifier here, just the friend
 * a stake would land with if they miss it. No action to take, so it's a single
 * compact row with no CTA.
 */
/** Compact ring showing how far the friend is through their forfeit — same
 * visual language as the mission-card progress ring, sized down for a row. */
function FriendProgressRing({
  index,
  count,
}: {
  index: number;
  count: number;
}) {
  const size = 32;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = count > 0 ? Math.min(1, Math.max(0, index / count)) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-delulu-blue transition-all duration-500 ease-out"
        />
      </svg>
      <span className="absolute text-[10px] font-extrabold leading-none text-foreground">
        {index}
      </span>
    </div>
  );
}

function ForfeitDestinationCard({ day }: { day: DayItem }) {
  const item = day.forfeit;
  const amount = formatStakeAmount(item);
  const symbol = item.onChain?.token
    ? getTokenSymbol(item.onChain.token)
    : "G$";
  const totalPeriods = item.onChain?.totalPeriods ?? 1;
  const completedPeriods = countCompletedPeriods(item);
  const creatorName = creatorDisplayName(item);

  return (
    <div className="rounded-3xl bg-white dark:bg-card p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <UserAvatar
          address={item.creatorWallet}
          username={item.otherPartyUsername}
          pfpUrl={item.otherPartyPfpUrl}
          size={38}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-blue">
            If they miss it
          </p>
          <p className="mt-0.5 text-sm font-extrabold leading-snug text-foreground">
            {item.title || "Untitled forfeit"}
          </p>
        </div>
        <FriendProgressRing index={completedPeriods} count={totalPeriods} />
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {amount ? (
          <>
            <span className="font-bold text-foreground">
              {amount} {symbol}
            </span>{" "}
            to you ·{" "}
          </>
        ) : null}
        {creatorName}
      </p>
    </div>
  );
}

/** Single empty CTA — no promo banner above it. Guests see the same empty
 * state as signed-in users with nothing yet; tapping create just routes them
 * through sign-in first instead of the button being hidden or disabled. */
function ForfeitEmptyState({ authenticated }: { authenticated: boolean }) {
  const router = useRouter();
  const cta = "inline-flex";

  return (
    <div className="flex flex-col items-center rounded-[20px] border-2 border-line bg-white px-5 py-9 text-center shadow-edge">
      <span className="animate-bob">
        <Lulu size={72} />
      </span>
      <p className="mt-3 text-lg font-extrabold">No quests yet</p>
      <p className="mt-1 max-w-[16rem] text-sm text-muted-foreground">
        Make your first habit contract. Your word or a little money on the line.
      </p>
      {!FORFEIT_CREATION_ENABLED ? (
        <GameButton className="mt-5" disabled title="Creating contracts is temporarily paused">
          <Plus className="h-4 w-4" strokeWidth={2.6} />
          New contract
        </GameButton>
      ) : authenticated ? (
        <Link href="/forfeit" className={gameButtonClass({ className: `mt-5 ${cta}` })}>
          <Plus className="h-4 w-4" strokeWidth={2.6} />
          New contract
        </Link>
      ) : (
        <GameButton
          className="mt-5"
          onClick={() => {
            persistSignInRedirect("/forfeit");
            router.push(buildSignInUrl("/forfeit"));
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} />
          Get started
        </GameButton>
      )}
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
  address: string | undefined;
  className?: string;
  showCreateWhenEmpty?: boolean;
}) {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const { data: creatorData, isLoading: creatorLoading } =
    useCreatorForfeits(address);
  const { data: verifierData, isLoading: verifierLoading } =
    useVerifierForfeits(address);
  const { data: destinationData, isLoading: destinationLoading } =
    useDestinationForfeits(address);
  const { optimisticItem, justSynced } = usePendingForfeitSync(address);
  const isLoading = creatorLoading || verifierLoading || destinationLoading;

  useFastResolveForfeit(creatorData ?? [], () => {
    if (!address) return;
    void queryClient.invalidateQueries({ queryKey: forfeitFeedKeys.creator(address) });
  });

  const { submitProofAndWait } = useSubmitForfeitProof();
  const { resolveCommitmentSuccessAndWait } =
    useResolveForfeitCommitmentSuccess();
  const { cancelCommitmentAndWait } = useCancelForfeitCommitment();

  useEffect(() => {
    if (!justSynced || !address) return;
    void queryClient.invalidateQueries({
      queryKey: forfeitFeedKeys.creator(address),
    });
  }, [justSynced, address, queryClient]);

  const items = useMemo<DayItem[]>(() => {
    const creatorForfeits = (creatorData ?? []).filter(hasConfirmedForfeitState);
    const verifierForfeits = (verifierData ?? []).filter(hasConfirmedForfeitState);
    const destinationForfeits = (destinationData ?? []).filter(hasConfirmedForfeitState);

    const creatorDays = creatorForfeits.flatMap((f) =>
      expandForfeitDays(f, "creator"),
    );
    const verifierDays = verifierForfeits.flatMap((f) =>
      expandForfeitDays(f, "verifier"),
    );
    const destinationDays = destinationForfeits.flatMap((f) =>
      expandForfeitDays(f, "destination"),
    );

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

    return [
      ...optimisticDays,
      ...creatorDays,
      ...verifierDays,
      ...destinationDays,
    ];
  }, [creatorData, verifierData, destinationData, optimisticItem]);

  const dayBuckets = useMemo(() => groupIntoDayBuckets(items), [items]);

  // Navigation is over the calendar itself, not just days that have a
  // forfeit — the arrows can land on an empty day and just show that state.
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    startOfDay(new Date()),
  );
  const bucketsKey = dayBuckets.map((b) => b.key).join("|");

  // Land on today (or nearest day with forfeits) when the calendar shape changes.
  useEffect(() => {
    if (dayBuckets.length === 0) return;
    const todayKey = dayKey(new Date());
    const todayBucket = dayBuckets.find((b) => b.key === todayKey);
    if (todayBucket) {
      setSelectedDate(todayBucket.dayDate);
      return;
    }
    // Only ever jump forward to the soonest upcoming day — never default
    // backward into a past day. A forfeit that's already over must not make
    // the dashboard look stuck in the past when reopened today.
    const upcoming = dayBuckets.find(
      (b) => b.dayDate.getTime() > startOfDay(new Date()).getTime(),
    );
    setSelectedDate(upcoming ? upcoming.dayDate : startOfDay(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when keys change
  }, [bucketsKey]);

  const currentBucket =
    dayBuckets.find((b) => b.key === dayKey(selectedDate)) ?? null;
  const currentDays = currentBucket?.items ?? [];
  const roleGroups = groupDaysByRole(currentDays);

  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [proofStep, setProofStep] = useState<
    "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming"
  >("idle");
  const [activeProofItem, setActiveProofItem] =
    useState<ForfeitFeedItem | null>(null);

  // Deep link from the contract detail page: /home?prove=<onChainCommitmentId>
  // opens today's proof flow for that contract once the feed has loaded.
  const proveHandled = useRef(false);
  useEffect(() => {
    if (proveHandled.current || isLoading) return;
    const id = new URLSearchParams(window.location.search).get("prove");
    if (!id) return;
    proveHandled.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    const day = items.find(
      (d) =>
        d.role === "creator" &&
        d.periodStatus === "current" &&
        String(d.forfeit.onChainCommitmentId) === id,
    );
    if (!day) return;
    setActiveProofItem(day.forfeit);
    setProofSuccess(false);
    setProofError(null);
    setProofStep("idle");
    setProofOpen(true);
  }, [isLoading, items]);

  const [discontinueItem, setDiscontinueItem] =
    useState<ForfeitFeedItem | null>(null);

  // Deep link from the contract detail page: /home?discontinue=<onChainCommitmentId>
  const discontinueHandled = useRef(false);
  useEffect(() => {
    if (discontinueHandled.current || isLoading) return;
    const id = new URLSearchParams(window.location.search).get("discontinue");
    if (!id) return;
    discontinueHandled.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    const match = (creatorData ?? []).find((f) => String(f.onChainCommitmentId) === id);
    if (match) setDiscontinueItem(match);
  }, [isLoading, creatorData]);
  const [discontinueBusy, setDiscontinueBusy] = useState(false);
  const [discontinueError, setDiscontinueError] = useState<string | null>(null);


  const invalidate = () => {
    if (!address) return;
    void queryClient.invalidateQueries({
      queryKey: forfeitFeedKeys.creator(address),
    });
    void queryClient.invalidateQueries({
      queryKey: forfeitFeedKeys.verifier(address),
    });
  };

  const handleProofSubmit = async (proofUrls: string[]) => {
    if (!address || activeProofItem?.onChainCommitmentId == null) {
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

  const handleDiscontinue = async () => {
    if (discontinueItem?.onChainCommitmentId == null) return;
    setDiscontinueBusy(true);
    setDiscontinueError(null);
    try {
      const txHash = await cancelCommitmentAndWait(
        discontinueItem.onChainCommitmentId,
      );
      await fetch("/api/forfeit/confirm-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, walletAddress: address }),
      }).catch(() => {});
      setDiscontinueItem(null);
      invalidate();
    } catch (err) {
      setDiscontinueError(
        err instanceof Error
          ? err.message
          : "Failed to discontinue this forfeit",
      );
    } finally {
      setDiscontinueBusy(false);
    }
  };

  if (isLoading) {
    return (
      <section
        className={cn(className)}
        role="status"
        aria-label="Loading forfeit"
      >
        <div className="mb-7 flex animate-pulse items-center justify-between gap-2">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-8 w-8 rounded-full bg-muted" />
        </div>
        <div className="animate-pulse rounded-[20px] border-2 border-line bg-white p-4 shadow-edge">
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="h-3.5 w-28 rounded bg-muted" />
            <div className="h-6 w-20 rounded-full bg-muted" />
          </div>
        </div>
      </section>
    );
  }

  // No forfeits anywhere, ever — nothing to browse, so skip the date chrome
  // entirely and just show the create CTA.
  if (dayBuckets.length === 0) {
    return (
      <section className={cn(className)}>
        {showCreateWhenEmpty ? (
          <ForfeitEmptyState authenticated={!!address} />
        ) : (
          <div className="flex flex-col items-center rounded-[20px] border-2 border-line bg-white px-5 py-10 text-center shadow-edge">
            <Calendar
              className="h-12 w-12 text-muted-foreground/50"
              strokeWidth={1.5}
            />
            <p className={cn("mt-4", FEED_CARD_TITLE_CLASS)}>No forfeit</p>
          </div>
        )}
      </section>
    );
  }

  const label = selectedDate;
  const isLiveCamera = activeProofItem?.evidenceType === "camera";

  return (
    <section className={cn(className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="label-mono text-muted-foreground">
          {dayKey(selectedDate) === dayKey(new Date()) ? "Today's quests" : formatForfeitDayLabel(label)}
        </span>
      </div>

      {currentDays.length === 0 ? (
        <div className="flex flex-col items-center rounded-[20px] border-2 border-line bg-white px-5 py-10 text-center shadow-edge">
          <Calendar
            className="h-10 w-10 text-muted-foreground/50"
            strokeWidth={1.5}
          />
          <p className={cn("mt-3", FEED_CARD_TITLE_CLASS)}>
            {dayKey(selectedDate) === dayKey(new Date())
              ? "No forfeit for today"
              : "No forfeit"}
          </p>
          {dayKey(selectedDate) === dayKey(new Date()) ? (
            <p className={cn("mt-1.5 max-w-[16rem]", FEED_CARD_SUBTITLE_CLASS)}>
              Your contract history lives on each contract&apos;s page
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {roleGroups.map(({ role, items, heading }) => (
            <div key={role} className="space-y-2.5">
              {roleGroups.length > 1 ? (
                <p className={cn("px-1", FEED_CARD_EYEBROW_CLASS)}>{heading}</p>
              ) : null}
              {items.map((day) =>
                day.role === "verifier" ? (
                  <ForfeitVerifyCard key={day.key} day={day} />
                ) : day.role === "destination" ? (
                  <ForfeitDestinationCard key={day.key} day={day} />
                ) : (
                  <ForfeitTaskCard
                    key={day.key}
                    item={day.forfeit}
                    day={day}
                    proofBusy={
                      proofBusy && activeProofItem?.id === day.forfeit.id
                    }
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
            </div>
          ))}
        </div>
      )}

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

      <ResponsiveSheet
        open={!!discontinueItem}
        onOpenChange={(open) => {
          if (!open && !discontinueBusy) {
            setDiscontinueItem(null);
            setDiscontinueError(null);
          }
        }}
        title="Discontinue this forfeit?"
      >
        <div className="space-y-4 px-1 pb-1">
          <p className={FEED_CARD_SUBTITLE_CLASS}>
            Your stake will be forfeited to{" "}
            <span className="font-semibold text-foreground">
              {discontinueItem
                ? (destinationLabel(discontinueItem) ?? "its destination")
                : "its destination"}
            </span>{" "}
            — same as if you&apos;d missed the deadline. This can&apos;t be
            undone.
          </p>
          {discontinueError ? (
            <p className="text-xs font-semibold text-orange">
              {discontinueError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={discontinueBusy}
              onClick={() => setDiscontinueItem(null)}
              className="flex-1 rounded-full border border-border/60 py-3 text-sm font-bold text-foreground disabled:opacity-60"
            >
              Keep it
            </button>
            <button
              type="button"
              disabled={discontinueBusy}
              onClick={() => void handleDiscontinue()}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-orange py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {discontinueBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Discontinue
            </button>
          </div>
        </div>
      </ResponsiveSheet>
    </section>
  );
}
