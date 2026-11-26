"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BoostCard } from "@/components/bingo/boost-card";
import { MissionSticker } from "@/components/bingo/mission-stickers";
import { flexStatus, flexTheme } from "@/components/bingo/bingo-flex-card";
import { squareTint } from "@/lib/bingo/mission-art";
import type { BingoCardView, BingoView } from "@/lib/bingo/view";
import { cn } from "@/lib/utils";
import { ProofThumb } from "@/components/bingo/proof-thumb";

/**
 * Your running Bingo on Home, small: title, day, and the week as one row of
 * mini squares (your photos as they come in, stickers until then). The full
 * board lives on the Bingo page — Home has a lot else to show.
 */
export function HomeBingoMini({
  bingo,
  card,
  slug,
  title,
  today,
  onBoosted,
}: {
  bingo?: BingoView;
  card: BingoCardView;
  slug: string;
  title: string;
  /** Today's square, highlighted. */
  today?: number | null;
  onBoosted?: () => void | Promise<void>;
}) {
  const t = flexTheme(card.tierKey);
  const squares = card.squares.filter((s) => !s.bonus);
  const required = squares.length;
  const status = flexStatus(card, required);
  const href = `/bingo/${slug}`;
  return (
    <div
      className="rounded-[22px] border-2 p-3 shadow-[0_4px_0_#161615]"
      style={{ background: t.bg, color: t.fg, borderColor: t.frame }}
    >
      <div className="flex items-center gap-2">
        <Link href={href} className="min-w-0 flex-1 truncate font-display text-[18px] font-extrabold uppercase leading-none no-underline" style={{ color: t.fg }}>
          {title}
        </Link>
        {bingo ? (
          <BoostCard
            bingo={bingo}
            onBoosted={onBoosted ?? (() => undefined)}
            label="Top up"
            className="h-8 px-2.5 text-[11px] shadow-[0_2px_0_#161615]"
          />
        ) : null}
      </div>

      <Link
        href={href}
        aria-label={`Open ${title}`}
        className="mt-2.5 block no-underline transition-transform active:scale-[0.99]"
        style={{ color: t.fg }}
      >
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(3, required)}, minmax(0, 1fr))` }}>
        {squares.map((sq) => {
          const tint = squareTint(sq.index);
          const isToday = today === sq.index && sq.state === "empty";
          return (
            <span
              key={sq.index}
              className={cn("relative flex aspect-square items-center justify-center overflow-hidden rounded-xl", isToday && "ring-2 ring-offset-1")}
              style={{ background: tint.bg, ...(isToday ? { ["--tw-ring-color" as string]: t.fg, ["--tw-ring-offset-color" as string]: t.bg } : {}) }}
            >
              {sq.photoUrl && sq.state !== "missed" ? (
                <ProofThumb src={sq.photoUrl} px={200} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <MissionSticker title={sq.title} size={22} muted={sq.state === "missed"} className={cn(sq.state === "empty" && !isToday && "opacity-60")} />
              )}
            </span>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: `${t.fg}26` }}>
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (card.requiredFilled / Math.max(1, required)) * 100)}%`, background: t.fg }} />
        </span>
        <span className="font-display text-[14px] font-extrabold tabular-nums">
          {card.requiredFilled}/{required}
        </span>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase" style={{ background: t.chipBg, color: t.chipFg }}>
          {status.label}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
      </div>
      </Link>
    </div>
  );
}
