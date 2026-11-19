"use client";

import Link from "next/link";
import { ChevronRight, Clock, Grid3x3, Users } from "lucide-react";
import { BingoBoardBackground } from "@/components/bingo/bingo-board";
import { buildSquares, type BingoView } from "@/lib/bingo/view";
import { fmtDay, fmtG, fmtRange, fmtUntil } from "@/lib/bingo/format";
import { cn } from "@/lib/utils";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { fmtNgn } from "@/lib/earn/format";

/** "Day 3 of 7" / "Starts Wed 18 Nov" / "3 days · start anytime" — the same everywhere. */
export function bingoStatus(b: BingoView): { text: string; live: boolean } {
  const me = b.me;
  if (b.enrollment === "rolling") {
    if (me && me.phase === "live" && me.status === "active" && !me.missedDay) return { text: `Day ${(me.today ?? 0) + 1} of ${b.durationDays}`, live: true };
    return { text: `${b.durationDays} days · start anytime`, live: false };
  }
  const c = b.cycle;
  if (!c) return { text: "Coming soon", live: false };
  if (c.phase === "upcoming") return { text: `Starts ${fmtDay(c.startsAt)}`, live: false };
  if (c.phase === "ended") return { text: "Finished", live: false };
  return { text: `Day ${(c.today ?? 0) + 1} of ${b.durationDays}`, live: true };
}

function bingoCta(b: BingoView) {
  const me = b.me;
  const required = b.missions.filter((m) => !m.bonus).length;
  const minStake = Math.min(...b.tiers.map((t) => t.stake));
  if (me && me.requiredFilled >= required) return "Card complete 🎉";
  if (me && me.missedDay) return b.joinable ? "Start a fresh card" : "Card ended";
  if (me && me.status === "active" && me.phase !== "ended") {
    if (me.phase === "upcoming") return `Opens in ${fmtUntil(me.nextSquareAt ?? me.startedAt)}`;
    if (!me.todayUsed) return me.today === required - 1 ? "Last square today!" : "Add today's photo";
    return me.nextSquareAt ? `Done today · next in ${fmtUntil(me.nextSquareAt)}` : `${me.requiredFilled}/${required} squares`;
  }
  if (b.joinable) return b.enrollment === "rolling" ? `Start · ${fmtG(minStake)} G$` : `Join · from ${fmtG(minStake)} G$`;
  if (b.cycle?.phase === "upcoming") return `From ${fmtG(minStake)} G$ · joining opens soon`;
  return "See players";
}

/** Compact row (Bingo hub, Home): your card if you're in, else the empty card. */
export function BingoTile({ bingo, className }: { bingo: BingoView; className?: string }) {
  const c = bingo.cycle;
  const squares = bingo.me ? bingo.me.squares : buildSquares(bingo.missions, [], false);
  const status = bingoStatus(bingo);
  return (
    <Link
      href={`/bingo/${bingo.slug}`}
      className={cn("press-edge flex gap-3.5 rounded-[20px] border-2 border-line bg-white p-3 text-ink no-underline shadow-edge", className)}
    >
      {/* The card fills the thumbnail top to bottom: photos as they come in, our stickers until then. */}
      <span className="relative w-[92px] shrink-0 self-stretch overflow-hidden rounded-xl ring-2 ring-line">
        <BingoBoardBackground squares={squares} sticker={squares.length <= 3 ? 26 : 20} stack className="absolute inset-0 min-h-[96px] bg-white" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="label-mono text-[10px] text-muted-foreground">
          {bingo.durationDays}-day Bingo{c ? ` · ${fmtRange(c.startsAt, c.endsAt)}` : ""}
        </span>
        <span className="mt-0.5 font-display text-[19px] font-extrabold uppercase leading-[0.95]">{bingo.title}</span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          <span className={cn("rounded-full px-2 py-0.5", status.live ? "bg-green-soft text-green-edge" : "bg-yellow-soft text-[#8a6a00]")}>{status.text}</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" /> {bingo.players}
          </span>
        </span>
        <span className="mt-auto flex items-center justify-between pt-2 text-[13px] font-extrabold">
          {bingoCta(bingo)}
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

/**
 * Bingo in the campaign lists (Explore): same size and feel as a campaign
 * banner card, with a BINGO badge and a collage of players' real photos
 * (or the empty card until the first square fills).
 */
/**
 * What a Bingo pays, at a glance: G$ a day, the biggest cashback for finishing,
 * and the most you can take home over the whole card (≈ ₦ at today's rate).
 * Different Bingos pay differently — this is what makes the bigger one worth it.
 */
function useEarnInfo(bingo: BingoView) {
  const facts = useEarnFacts();
  const days = bingo.missions.filter((m) => !m.bonus).length || bingo.durationDays;
  const perDay = bingo.rewards.perProof;
  const back = Math.max(0, ...bingo.tiers.map((t) => (typeof t.completionReward === "number" ? t.completionReward : 0)));
  const total = perDay * days + back;
  const stake = Math.min(...bingo.tiers.map((t) => t.stake).filter((n) => n > 0));
  // The cashback for the stake the card shows, so the two always match.
  const atStake = bingo.tiers.find((t) => t.stake === stake);
  const backAtStake = typeof atStake?.completionReward === "number" ? atStake.completionReward : 0;
  const ngn = (g: number) => (facts ? fmtNgn(g * facts.gdUsd * facts.ngnPerUsd) : null);
  /** "₦1.7k" — short enough for a tiny pill. */
  const ngnShort = (g: number) => {
    if (!facts) return null;
    const n = g * facts.gdUsd * facts.ngnPerUsd;
    return n >= 1000 ? `₦${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `₦${Math.round(n)}`;
  };
  const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : String(n));
  return { days, perDay, back, backAtStake, total, stake, ngn, ngnShort, k };
}

export function BingoBannerCard({ bingo, className, pin }: { bingo: BingoView; className?: string; /** Board card: compact, height from this aspect class. */ pin?: string }) {
  const status = bingoStatus(bingo);
  const earn = useEarnInfo(bingo);
  const playing = !!bingo.me && bingo.me.status === "active" && bingo.me.phase !== "ended" && !bingo.me.missedDay;
  const squares = bingo.me ? bingo.me.squares : buildSquares(bingo.missions, [], false);
  // The card opens the Bingo; "View players" (a sibling link on top) jumps to its leaderboard.
  return (
    <div
      className={cn(
        "group relative block min-w-0 animate-rise overflow-hidden bg-ink text-white no-underline",
        pin ? `${pin} w-full rounded-[22px]` : "aspect-[16/11] min-h-[264px] rounded-[32px]",
        "shadow-[0_14px_30px_-12px_rgba(22,22,21,0.45)] transition-transform active:scale-[0.98]",
        className,
      )}
    >
      <Link href={`/bingo/${bingo.slug}`} aria-label={bingo.title} className="absolute inset-0 z-[1]" />
      {/* The board is the card — photos as they come in, stickers until then — with the words on a gradient over it. */}
      <BingoBoardBackground squares={squares} className="absolute inset-0" />
      {/* Only the bottom darkens, for the title — the stickers/photos above stay bright. */}
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/95 via-black/65 to-transparent" aria-hidden />

      <div className={cn("pointer-events-none absolute z-[2] flex flex-wrap items-center", pin ? "inset-x-2.5 top-2.5 gap-1" : "inset-x-5 top-5 gap-2")}>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-yellow font-extrabold uppercase tracking-wide text-ink", pin ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[12px]")}>
          <Grid3x3 className="h-3.5 w-3.5" strokeWidth={2.6} /> Bingo
        </span>
        {/* The cashback, loud: what finishing pays at the top level. */}
        {earn.backAtStake > 0 && !playing ? (
          <span className={cn("inline-flex items-center rounded-full bg-green-strong font-extrabold text-white", pin ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[11px]")}>
            Cashback +{earn.k(earn.backAtStake)}
          </span>
        ) : null}
        {/* Only while you're playing ("Day 2 of 7") — the squares already say 3 or 7 days. */}
        {status.live ? (
          <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-white font-extrabold text-ink", pin ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[12px]")}>
            <Clock className="h-3.5 w-3.5" strokeWidth={2.6} />
            {status.text}
          </span>
        ) : null}
      </div>

      <div className={cn("pointer-events-none absolute z-[2]", pin ? "inset-x-3 bottom-3" : "inset-x-5 bottom-5")}>
        <h3 className={cn("m-0 line-clamp-2 font-extrabold leading-[1.15] tracking-[-0.01em] text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.45)] [text-wrap:balance]", pin ? "text-[15px]" : "text-[22px]")}>
          {bingo.title}
        </h3>
        {/* One plain line: what you put in and for how long. The full breakdown is on the Bingo page. */}
        {!playing && bingo.joinable && Number.isFinite(earn.stake) ? (
          <p className={cn("m-0 mt-0.5 font-semibold text-white/85", pin ? "text-[11px]" : "text-[13px]")}>
            Stake {earn.k(earn.stake)} G$ · {earn.days} days
          </p>
        ) : (
          <p className={cn("m-0 mt-1 font-semibold text-white/85", pin ? "text-[11px] leading-snug" : "text-[13px]")}>{bingoCta(bingo)}</p>
        )}
        {bingo.players > 0 ? (
          <Link
            href={`/bingo/${bingo.slug}#players`}
            className={cn(
              "pointer-events-auto relative z-[2] inline-flex items-center gap-1.5 rounded-full bg-white/15 font-bold text-white no-underline backdrop-blur-sm hover:bg-white/25",
              pin ? "mt-1.5 px-2 py-0.5 text-[11px]" : "mt-2 px-2.5 py-1 text-[12px]",
            )}
          >
            <Users className="h-3.5 w-3.5" /> {bingo.players.toLocaleString()} playing · View
          </Link>
        ) : null}
      </div>
    </div>
  );
}
