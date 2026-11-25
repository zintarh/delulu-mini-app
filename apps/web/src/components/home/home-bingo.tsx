"use client";

import Link from "next/link";
import { BingoBannerCard } from "@/components/bingo/bingo-tile";
import { useBingoList } from "@/hooks/use-bingo";
import type { BingoView } from "@/lib/bingo/view";
import { FIRST_WEEK_SLUG } from "@/lib/bingo/first-week";
import { seededShuffle, shuffleWindow } from "@/lib/shuffle";
import { useAuth } from "@/hooks/use-auth";

const playing = (b: BingoView) => !!b.me && b.me.status === "active" && !b.me.missedDay && b.me.phase !== "ended";

/**
 * Home's Bingo section: the cards you're playing first (next photo one tap
 * away), then Bingos open to join — the big-cashback 7-day ones, with at most
 * one small 3-day Bingo. First Week has its own offer at the top of Home
 * (HomeFirstWeek), so it is never repeated here.
 */
const MORE_TO_PLAY = 4;
const SHUFFLE_HOURS = 6;
/** A Bingo "worth it" on Home pays at least this much cashback at its top stake (the 7-day ones). */
const BIG_CASHBACK = 1_000;
const maxCashback = (b: BingoView) => Math.max(0, ...b.tiers.map((t) => (typeof t.completionReward === "number" ? t.completionReward : 0)));

export function HomeBingo({ newcomer = false, exclude = null }: { newcomer?: boolean; exclude?: string | null }) {
  const { bingos: all } = useBingoList();
  const { address } = useAuth();
  // The Bingo "Your next step" is about isn't shown twice; First Week has its own card at the top of Home.
  const bingos = all?.filter((b) => b.slug !== exclude && b.slug !== FIRST_WEEK_SLUG) ?? null;
  if (!bingos || bingos.length === 0) return null;

  const mine = bingos.filter(playing);
  // Open to join, or announced and starting soon.
  const open = bingos.filter((b) => !playing(b) && (b.joinable || b.cycle?.phase === "upcoming"));
  // Lead with the juicy ones (7-day, big cashback); at most one small 3-day Bingo, last.
  // Reshuffled every few hours (stable in between, so the page doesn't jump) — Explore has them all.
  const seed = `${address ?? "guest"}:${shuffleWindow(SHUFFLE_HOURS)}`;
  const big = seededShuffle(open.filter((b) => maxCashback(b) >= BIG_CASHBACK), seed);
  const small = seededShuffle(open.filter((b) => maxCashback(b) < BIG_CASHBACK), seed);
  const slots = Math.max(0, MORE_TO_PLAY - mine.length);
  const picks = [...big.slice(0, Math.max(0, slots - (small.length ? 1 : 0))), ...small.slice(0, 1)];
  // Not enough big ones: fill with whatever's left.
  const list = [...mine, ...picks, ...[...big, ...small].filter((b) => !picks.includes(b))].slice(0, MORE_TO_PLAY);
  if (list.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-extrabold uppercase">{newcomer ? "Bingo" : "Bingos"}</h2>
        <Link href="/explore" className="label-mono text-[11px] text-muted-foreground no-underline">
          See all →
        </Link>
      </div>
      {/* One swipeable row instead of a tall grid — Home stays short; Explore has them all. */}
      <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide lg:mx-0 lg:px-0">
        {list.map((b) => (
          <div key={b.id} className="w-[46%] max-w-[220px] shrink-0 snap-start">
            <BingoBannerCard bingo={b} pin="aspect-[3/4]" />
          </div>
        ))}
      </div>
    </section>
  );
}

