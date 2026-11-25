"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MissionSticker } from "@/components/bingo/mission-stickers";
import { flexStatus, flexTheme } from "@/components/bingo/bingo-flex-card";
import { squareTint } from "@/lib/bingo/mission-art";
import type { BingoCardView } from "@/lib/bingo/view";
import { cn } from "@/lib/utils";
import { ProofThumb } from "@/components/bingo/proof-thumb";

/**
 * Your running Bingo on Home, small: title, day, and the week as one row of
 * mini squares (your photos as they come in, stickers until then). The full
 * board lives on the Bingo page — Home has a lot else to show.
 */
export function HomeBingoMini({ card, slug, title, today }: { card: BingoCardView; slug: string; title: string; /** Today's square, highlighted. */ today?: number | null }) {
  const t = flexTheme(card.tierKey);
  const squares = card.squares.filter((s) => !s.bonus);
  const required = squares.length;
  const status = flexStatus(card, required);
  return (
    <Link
      href={`/bingo/${slug}`}
      aria-label={`Open ${title}`}
      className="block rounded-[22px] border-2 p-3 no-underline shadow-[0_4px_0_#161615] transition-transform active:scale-[0.99]"
      style={{ background: t.bg, color: t.fg, borderColor: t.frame }}
    >
      <div className="flex items-center gap-2">
        <p className="m-0 min-w-0 flex-1 truncate font-display text-[18px] font-extrabold uppercase leading-none">{title}</p>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase" style={{ background: t.chipBg, color: t.chipFg }}>
          {status.label}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
      </div>

      <div className="mt-2.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(3, required)}, minmax(0, 1fr))` }}>
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
      </div>
    </Link>
  );
}
