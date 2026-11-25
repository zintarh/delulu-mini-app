"use client";

import { Lock } from "lucide-react";
import { Lulu } from "@/components/ds";
import { MissionSticker } from "@/components/bingo/mission-stickers";
import { flexStatus, flexTheme } from "@/components/bingo/bingo-flex-card";
import { collageColumns, type CollageTile } from "@/lib/bingo/collage";
import { squareTint } from "@/lib/bingo/mission-art";
import type { BingoCardView } from "@/lib/bingo/view";
import { cn } from "@/lib/utils";
import { ProofThumb } from "@/components/bingo/proof-thumb";

/**
 * A player's Bingo card as a Pinterest-style collage: their photos are the
 * art, in two masonry columns, each tagged with its day; what's still to come
 * shows as small sticker tiles. Tier-themed, score at the bottom, a BINGO
 * stamp when it's done. Same layout as the share image (lib/bingo/collage).
 */
export function BingoCollage({
  card,
  bingoTitle,
  required,
  mine = false,
  canPick,
  onPick,
  className,
}: {
  card: BingoCardView;
  bingoTitle: string;
  required: number;
  mine?: boolean;
  /** Your own card: which empty squares can take a photo right now (e.g. today's). */
  canPick?: (squareIndex: number) => boolean;
  onPick?: (squareIndex: number) => void;
  className?: string;
}) {
  const t = flexTheme(card.tierKey);
  const status = flexStatus(card, required);
  const name = card.username ? `@${card.username}` : "Player";
  const squares = card.squares.filter((s) => !s.bonus);
  const bySquare = new Map(squares.map((s) => [s.index, s]));
  // gap-2 (8px) on a ~170px column ≈ 0.05.
  const columns = collageColumns(squares, { withScore: true, gapRatio: 0.05 });

  const Tile = ({ tile }: { tile: CollageTile }) => {
    const style = { aspectRatio: `1 / ${tile.h}` };
    if (tile.kind === "score") {
      return (
        <div
          className="relative flex flex-col items-center justify-center overflow-hidden rounded-[18px] shadow-[0_2px_10px_rgba(0,0,0,0.12)]"
          style={{ ...style, background: t.chipBg, color: t.chipFg }}
        >
          {/* A soft glow, and a ring that fills with every day kept. */}
          <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/25 blur-2xl" aria-hidden />
          <span className="pointer-events-none absolute -bottom-8 -left-6 h-20 w-20 rounded-full bg-white/15 blur-2xl" aria-hidden />
          <span className="relative flex h-[84px] w-[84px] items-center justify-center">
            <svg viewBox="0 0 84 84" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="42" cy="42" r="36" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="7" />
              <circle
                cx="42"
                cy="42"
                r="36"
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 36}
                strokeDashoffset={2 * Math.PI * 36 * (1 - Math.min(1, card.requiredFilled / Math.max(1, required)))}
                className="transition-[stroke-dashoffset] duration-700"
              />
            </svg>
            {status.done ? (
              <Lulu size={50} mood="kept" />
            ) : (
              <span className="font-display text-[26px] font-extrabold leading-none tabular-nums">
                {card.requiredFilled}/{required}
              </span>
            )}
          </span>
          <span className="relative mt-1.5 text-[10px] font-extrabold uppercase tracking-wider opacity-85">
            {status.done ? `${required}/${required} · Bingo!` : "days kept"}
          </span>
        </div>
      );
    }
    const sq = bySquare.get(tile.index)!;
    const day = `Day ${tile.index + 1}`;
    if (tile.kind === "photo" && sq.photoUrl) {
      return (
        <div className="relative overflow-hidden rounded-[18px] bg-[#e9e7df] shadow-[0_2px_10px_rgba(0,0,0,0.12)]" style={style}>
          <ProofThumb src={sq.photoUrl} px={560} alt={sq.title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-2.5 pb-2 pt-6">
            <p className="m-0 truncate text-[11px] font-extrabold leading-tight text-white">{sq.title}</p>
          </div>
          <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-extrabold text-ink shadow-sm">{day}</span>
          {sq.state === "confirming" ? (
            <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">saving…</span>
          ) : null}
        </div>
      );
    }
    // A private card's done day: kept, but the photo stays with its owner.
    if (tile.kind === "photo") {
      return (
        <div
          className="relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-[18px] bg-gradient-to-br from-[#d9d6cc] to-[#bdb9ad] text-[#3d3b35] shadow-[0_2px_10px_rgba(0,0,0,0.12)]"
          style={style}
          aria-label={`${day}: done, photo private`}
        >
          <Lock className="h-5 w-5" strokeWidth={2.4} />
          <p className="m-0 text-[10px] font-extrabold uppercase tracking-wide">{day} · done</p>
        </div>
      );
    }
    const missed = tile.kind === "missed";
    if (!missed && onPick && canPick?.(tile.index)) {
      return (
        <button
          type="button"
          onClick={() => onPick(tile.index)}
          aria-label={`Add photo for ${day}: ${sq.title}`}
          className="flex items-center gap-2 rounded-[18px] border-2 border-dashed border-current px-2.5 text-left"
          // Pastel tiles carry their own ink — the card's text colour can be white (Pro, Elite, First Week).
          style={{ ...style, background: squareTint(tile.index).bg, color: squareTint(tile.index).ink }}
        >
          <MissionSticker title={sq.title} size={26} />
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-extrabold uppercase tracking-wide">{day} · today</p>
            <p className="m-0 line-clamp-2 text-[11px] font-bold leading-tight">{sq.title}</p>
          </div>
        </button>
      );
    }
    return (
      <div
        className={cn("flex items-center gap-2 rounded-[18px] px-2.5", missed && "bg-[#ecece7] opacity-70")}
        style={missed ? { ...style, color: "#5f5f57" } : { ...style, background: squareTint(tile.index).bg, color: squareTint(tile.index).ink }}
      >
        <MissionSticker title={sq.title} size={26} muted={missed} />
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-extrabold uppercase tracking-wide opacity-60">{missed ? `${day} · missed` : day}</p>
          <p className="m-0 line-clamp-2 text-[11px] font-bold leading-tight">{sq.title}</p>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn("relative overflow-hidden rounded-[28px] border-[2.5px] p-3.5", className)}
      style={{ background: t.bg, color: t.fg, borderColor: t.frame, boxShadow: `0 5px 0 ${t.frame}` }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-white" style={{ borderColor: t.frame }}>
          {card.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Lulu size={30} animated={false} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold">{mine ? "My card" : name}</span>
        {card.photosPrivate ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide" title="Photos are private">
            <Lock className="h-3 w-3" /> Private
          </span>
        ) : null}
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide" style={{ background: t.chipBg, color: t.chipFg }}>
          {card.tierLabel} · {card.stake.toLocaleString("en-US")} G$
        </span>
      </div>
      <p className="m-0 mt-2 font-display text-[24px] font-extrabold uppercase leading-[0.95] tracking-tight">{bingoTitle}</p>

      {/* The pinboard */}
      <div className="relative mt-3 grid grid-cols-2 gap-2">
        {columns.map((col, c) => (
          <div key={c} className="flex flex-col gap-2">
            {col.map((tile, i) => (
              <Tile key={`${c}-${i}`} tile={tile} />
            ))}
          </div>
        ))}
        {status.done ? (
          <span className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -rotate-[10deg] whitespace-nowrap rounded-xl border-[3px] border-green-edge bg-white/95 px-4 py-1.5 font-display text-[34px] font-extrabold uppercase text-green-edge shadow-lg">
            Bingo!
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="m-0 truncate text-[13px] font-extrabold" style={{ color: t.sub }}>
          {status.label}
        </p>
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-extrabold opacity-90">
          <Lulu size={22} animated={false} /> staydelulu.xyz
        </span>
      </div>
    </div>
  );
}
