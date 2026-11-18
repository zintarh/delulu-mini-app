"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GameCard, gameButtonClass } from "@/components/ds";
import { BingoBoard } from "@/components/bingo/bingo-board";
import { BingoBannerCard } from "@/components/bingo/bingo-tile";
import { PinBoard, pinAspect } from "@/components/ui/pin-board";
import { useBingoList } from "@/hooks/use-bingo";
import { buildSquares, type BingoView } from "@/lib/bingo/view";
import { FIRST_WEEK_SLUG } from "@/lib/bingo/first-week";
import { fmtG } from "@/lib/bingo/format";

const playing = (b: BingoView) => !!b.me && b.me.status === "active" && !b.me.missedDay && b.me.phase !== "ended";

/**
 * Home's Bingo section: the cards you're playing first (next photo one tap
 * away), then Bingos open to join. New players get the one-time starter
 * Bingo up top as their way in. First Week has its own offer at the top of
 * Home (HomeFirstWeek), so it is never repeated here.
 */
export function HomeBingo({ newcomer = false, exclude = null }: { newcomer?: boolean; exclude?: string | null }) {
  const { bingos: all } = useBingoList();
  // The Bingo "Your next step" is about isn't shown twice.
  const bingos = all?.filter((b) => b.slug !== exclude && b.slug !== FIRST_WEEK_SLUG) ?? null;
  if (!bingos || bingos.length === 0) return null;

  const mine = bingos.filter(playing);
  // A one-time onboarding Bingo is the way in; replayable ones (Prayer Streak) sit in the list.
  const starter = bingos.find((b) => b.enrollment === "rolling" && b.recurrence === "one_time" && b.joinable);
  // Open to join, or announced and starting soon.
  const open = bingos.filter((b) => !playing(b) && b !== starter && (b.joinable || b.cycle?.phase === "upcoming"));
  const showStarter = starter && mine.length === 0 && newcomer;
  const list = [...mine, ...(showStarter ? [] : starter && mine.length === 0 ? [starter] : []), ...open].slice(0, 4);
  if (!showStarter && list.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-extrabold uppercase">{newcomer ? "Bingo" : "More to play"}</h2>
        <Link href="/explore" className="label-mono text-[11px] text-muted-foreground no-underline">
          All
        </Link>
      </div>
      {showStarter ? <StarterBingoCard bingo={starter} /> : null}
      {list.length ? (
        <PinBoard>
          {list.map((b, i) => (
            <BingoBannerCard key={b.id} bingo={b} pin={pinAspect(i + 1)} />
          ))}
        </PinBoard>
      ) : null}
    </section>
  );
}

/** The newcomer way in: the whole 3-day loop, shown as the card they'll fill. */
function StarterBingoCard({ bingo }: { bingo: BingoView }) {
  const stake = Math.min(...bingo.tiers.map((t) => t.stake));
  return (
    <GameCard className="animate-rise p-4">
      <p className="label-mono m-0 text-[10px] text-muted-foreground">New here · your first Bingo</p>
      <p className="m-0 mt-1 font-display text-[26px] font-extrabold uppercase leading-[0.95]">{bingo.title}</p>
      <BingoBoard squares={buildSquares(bingo.missions, [], false)} className="mt-3" />
      <p className="m-0 mt-3 text-[13px] font-semibold leading-snug">
        {bingo.durationDays} days, {bingo.durationDays} photos. Stake {fmtG(stake)} G$ and get it back when you finish
        {bingo.rewards.perProof > 0 ? ` — plus up to ${fmtG(bingo.rewards.perProof)} G$ a photo` : ""}.
      </p>
      <Link href={`/bingo/${bingo.slug}`} className={gameButtonClass({ variant: "ink", full: true, className: "mt-3" })}>
        Start my first Bingo <ArrowRight className="h-4 w-4" />
      </Link>
    </GameCard>
  );
}
