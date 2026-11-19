"use client";

import Link from "next/link";
import { ChevronRight, Clock, Grid3x3, Users } from "lucide-react";
import { BingoBoardBackground } from "@/components/bingo/bingo-board";
import { buildSquares, type BingoView } from "@/lib/bingo/view";
import { fmtDay, fmtG, fmtRange, fmtUntil } from "@/lib/bingo/format";
import { cn } from "@/lib/utils";

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
export function BingoBannerCard({ bingo, className, pin }: { bingo: BingoView; className?: string; /** Board card: compact, height from this aspect class. */ pin?: string }) {
  const status = bingoStatus(bingo);
  const squares = bingo.me ? bingo.me.squares : buildSquares(bingo.missions, [], false);
  return (
    <Link
      href={`/bingo/${bingo.slug}`}
      className={cn(
        "group relative block min-w-0 animate-rise overflow-hidden bg-ink text-white no-underline",
        pin ? `${pin} w-full rounded-[22px]` : "aspect-[16/11] min-h-[264px] rounded-[32px]",
        "shadow-[0_14px_30px_-12px_rgba(22,22,21,0.45)] transition-transform active:scale-[0.98]",
        className,
      )}
    >
      {/* The board is the card — photos as they come in, stickers until then — with the words on a gradient over it. */}
      <BingoBoardBackground squares={squares} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" aria-hidden />

      <div className={cn("absolute flex flex-wrap items-center", pin ? "inset-x-2.5 top-2.5 gap-1" : "inset-x-5 top-5 gap-2")}>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-yellow font-extrabold uppercase tracking-wide text-ink", pin ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[12px]")}>
          <Grid3x3 className="h-3.5 w-3.5" strokeWidth={2.6} /> Bingo
        </span>
        {/* Only while you're playing ("Day 2 of 7") — the squares already say 3 or 7 days. */}
        {status.live ? (
          <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-white font-extrabold text-ink", pin ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[12px]")}>
            <Clock className="h-3.5 w-3.5" strokeWidth={2.6} />
            {status.text}
          </span>
        ) : null}
      </div>

      <div className={cn("absolute", pin ? "inset-x-3 bottom-3" : "inset-x-5 bottom-5")}>
        <h3 className={cn("m-0 line-clamp-2 font-extrabold leading-[1.15] tracking-[-0.01em] text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.45)] [text-wrap:balance]", pin ? "text-[15px]" : "text-[22px]")}>
          {bingo.title}
        </h3>
        <p className={cn("m-0 mt-1 truncate font-semibold text-white/80", pin ? "text-[11px]" : "text-[13px]")}>
          {bingoCta(bingo)}
        </p>
        {bingo.players > 0 ? (
          <p className={cn("m-0 inline-flex items-center gap-1.5 font-bold text-white/90", pin ? "mt-1.5 text-[11px]" : "mt-2 text-[12px]")}>
            <Users className="h-3.5 w-3.5" /> {bingo.players.toLocaleString()} playing
          </p>
        ) : null}
      </div>
    </Link>
  );
}
