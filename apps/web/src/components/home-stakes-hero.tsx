"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { Flame, TriangleAlert } from "lucide-react";
import {
  useCreatorForfeits,
  hasConfirmedForfeitState,
  isActiveForfeit,
  type ForfeitFeedItem,
} from "@/hooks/use-creator-forfeits";
import { usePendingForfeitSync } from "@/lib/forfeit/use-pending-forfeit-sync";
import { getTokenDecimals, getTokenSymbol } from "@/lib/token-amounts";
import { cn, formatGAmount } from "@/lib/utils";
import { FEED_CARD_EYEBROW_CLASS, FEED_CARD_SUBTITLE_CLASS } from "@/components/feed-card-layout";

type TokenGroup = {
  token: string;
  symbol: string;
  totalAmount: number;
};

type ActiveStakesSummary = {
  groups: TokenGroup[];
  soonestDeadlineSec: number | null;
  activeCount: number;
};

/**
 * Sums currently-at-risk stake per token across a creator's active forfeits,
 * and finds the soonest upcoming deadline among them. Reuses the same
 * unit-conversion helpers (getTokenDecimals/getTokenSymbol) forfeit-day-card
 * already uses per-item — this just aggregates across items.
 */
function aggregateActiveStakes(items: ForfeitFeedItem[]): ActiveStakesSummary {
  const byToken = new Map<string, { totalRaw: bigint; decimals: number }>();
  let soonestDeadlineSec: number | null = null;
  let activeCount = 0;

  for (const item of items) {
    if (!hasConfirmedForfeitState(item) || !isActiveForfeit(item)) continue;
    const chain = item.onChain;
    if (!chain?.active || !chain.stakeAmount || !chain.token) continue;

    let raw: bigint;
    try {
      raw = BigInt(chain.stakeAmount);
    } catch {
      continue;
    }
    if (raw <= 0n) continue;

    activeCount += 1;

    const tokenKey = chain.token.toLowerCase();
    const existing = byToken.get(tokenKey);
    if (existing) {
      existing.totalRaw += raw;
    } else {
      byToken.set(tokenKey, { totalRaw: raw, decimals: getTokenDecimals(chain.token) });
    }

    const deadlineSec = Number(chain.currentPeriodDeadline ?? 0);
    if (deadlineSec > 0 && (soonestDeadlineSec == null || deadlineSec < soonestDeadlineSec)) {
      soonestDeadlineSec = deadlineSec;
    }
  }

  const groups: TokenGroup[] = Array.from(byToken.entries())
    .map(([token, { totalRaw, decimals }]) => ({
      token,
      symbol: getTokenSymbol(token),
      totalAmount: parseFloat(formatUnits(totalRaw, decimals)),
    }))
    // "Largest-value" without a real cross-token USD conversion would need a
    // new price feed — out of scope for v1. G$ is the app's default/near-
    // universal stake token in practice, so ranking by raw summed amount is
    // a reasonable stand-in: pick whichever group is largest in its own units.
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return { groups, soonestDeadlineSec, activeCount };
}

/**
 * Shared source of truth for "does this user currently have anything at
 * stake" — used by HomeStakesHero itself, and by home-dashboard.tsx to
 * decide whether the onboarding feature carousel still earns its space.
 * `hasActiveStakes` defaults to true while loading so nothing gets
 * prematurely suppressed before we actually know the answer.
 */
export function useActiveForfeitStakes(address: string | undefined) {
  const { data, isLoading } = useCreatorForfeits(address);
  const { optimisticItem } = usePendingForfeitSync(address);

  const summary = useMemo(() => {
    const items = data ?? [];
    // A just-staked forfeit can lag Supabase indexing by up to ~2-3 minutes
    // (see ensurePendingForfeitConfirmed's backoff). Without merging in the
    // optimistic item here, a second forfeit created right after the first
    // is invisible to this hero's "soonest deadline" countdown until that
    // sync completes — the badge would keep showing only the first forfeit's
    // deadline as if the second didn't exist. ForfeitDayCard already does
    // this same merge for its own item list.
    const alreadyIndexed = optimisticItem
      ? items.some(
          (c) =>
            c.title === optimisticItem.title &&
            c.onChain?.stakeAmount === optimisticItem.onChain?.stakeAmount,
        )
      : false;
    const merged =
      optimisticItem && !alreadyIndexed ? [...items, optimisticItem] : items;
    return aggregateActiveStakes(merged);
  }, [data, optimisticItem]);

  return {
    ...summary,
    isLoading,
    hasActiveStakes: isLoading || summary.activeCount > 0,
  };
}

function formatCountdown(remainingSec: number): { label: string; overdue: boolean } {
  if (remainingSec <= 0) return { label: "Overdue", overdue: true };
  const totalMinutes = Math.floor(remainingSec / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return { label: `${days}d ${hours}h`, overdue: false };
  return { label: `${hours}h ${minutes}m`, overdue: false };
}

/**
 * The loss-aversion hero: total G$ currently at risk + a live countdown to
 * the soonest deadline, visible the instant the app opens — no tapping into
 * a goal required. Tapping the whole block jumps straight to the forfeit
 * detail card lower on this same page (there's no dedicated, URL-addressable
 * "forfeit tab" route to link out to — /profile's tabs are local component
 * state, not URL-driven — so an in-page anchor is the honest destination).
 *
 * The eyebrow spells out "N active" deliberately — this figure is a *total*
 * across every active forfeit, while the detail card below shows one
 * specific item's amount. Without that label the two numbers just look like
 * the same fact repeated twice.
 */
export function HomeStakesHero({ address }: { address: string }) {
  const { groups, soonestDeadlineSec, activeCount, isLoading } = useActiveForfeitStakes(address);

  // Ticks the countdown forward once a minute — a home-screen digit clock
  // doesn't need per-second precision, and 60s keeps this cheap.
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (soonestDeadlineSec == null) return;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60_000);
    return () => clearInterval(id);
  }, [soonestDeadlineSec]);

  if (isLoading) {
    return (
      <div className="mx-4 mb-6 animate-pulse rounded-3xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="mt-2 h-9 w-40 rounded bg-muted" />
        <div className="mt-2 h-4 w-24 rounded bg-muted" />
      </div>
    );
  }

  // Nothing at stake — stay out of the way entirely. ForfeitDayCard right
  // below already owns "put something at stake" as its empty-state CTA;
  // this banner only earns its place once there's a real number to show.
  if (groups.length === 0 || soonestDeadlineSec == null) {
    return null;
  }

  const dominant = groups[0]!;
  const otherGroupsCount = groups.length - 1;
  const remainingSec = soonestDeadlineSec - nowSec;
  const countdown = formatCountdown(remainingSec);

  return (
    <Link href="#forfeit-day-card" className="mx-4 mb-6 block">
      <div
        className={cn(
          "rounded-3xl border p-4 shadow-sm transition-opacity active:opacity-90",
          countdown.overdue
            ? "border-red-500/30 bg-red-500/10"
            : "border-red-500/20 bg-gradient-to-b from-red-500/10 to-transparent",
        )}
      >
        <div className="flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-500" strokeWidth={2.5} />
          <p className={cn(FEED_CARD_EYEBROW_CLASS, "text-red-600 dark:text-red-500")}>
            At risk · {activeCount} active
          </p>
        </div>

        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[34px] font-black leading-none tabular-nums text-red-600 dark:text-red-500">
            {formatGAmount(dominant.totalAmount)}
          </span>
          <span className="text-lg font-bold text-red-600/80 dark:text-red-500/80">
            {dominant.symbol}
          </span>
          {otherGroupsCount > 0 ? (
            <span className="text-xs font-semibold text-muted-foreground">
              +{otherGroupsCount} more
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <Flame
            className={cn("h-4 w-4", countdown.overdue ? "text-red-600" : "text-amber-600")}
          />
          <span className="text-base font-bold tabular-nums text-foreground">
            {countdown.label}
          </span>
        </div>

        <p className={cn("mt-1.5", FEED_CARD_SUBTITLE_CLASS)}>or you forfeit it</p>
      </div>
    </Link>
  );
}
