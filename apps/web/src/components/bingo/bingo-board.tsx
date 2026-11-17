"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Lock } from "lucide-react";
import { CheckDot, Lulu, Stamp } from "@/components/ds";
import type { BingoSquareView } from "@/lib/bingo/view";
import { squareTilt, squareTint } from "@/lib/bingo/mission-art";
import { MissionSticker } from "@/components/bingo/mission-stickers";
import { cn } from "@/lib/utils";

export type SquareAvailability = "open" | "locked" | "none";

/**
 * The Bingo card as a sticker board: each mission is a tinted tile with its
 * own Delulu sticker; approved photos land on it as taped-on polaroids. Today's square
 * wiggles for a tap, a full card gets the BINGO stamp. Same component for the
 * hero card and the tiny player boards ("mini").
 */
export function BingoBoard({
  squares,
  availability,
  onPick,
  size = "hero",
  complete = false,
  reward,
  className,
}: {
  squares: BingoSquareView[];
  /** Whether each square can be tapped right now (own live card only). */
  availability?: (square: BingoSquareView) => SquareAvailability;
  onPick?: (square: BingoSquareView) => void;
  size?: "hero" | "mini";
  /** Every required square filled — stamp it. */
  complete?: boolean;
  /** Shown on squares still to fill: what each daily square pays. */
  reward?: BoardReward;
  className?: string;
}) {
  // Remember what was filled on first render so only new fills animate.
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(() => {
    const filledNow = new Set(squares.filter((s) => s.state === "filled").map((s) => s.index));
    if (seen.current === null) {
      seen.current = filledNow;
      return;
    }
    const added = [...filledNow].filter((i) => !seen.current!.has(i));
    seen.current = filledNow;
    if (added.length) {
      setFresh(new Set(added));
      const t = window.setTimeout(() => setFresh(new Set()), 1400);
      return () => window.clearTimeout(t);
    }
  }, [squares]);

  if (size === "mini") return <MiniBoard squares={squares} className={className} />;

  return (
    <div
      className={cn(
        "relative rounded-[28px] border-2 border-ink bg-white p-3 shadow-[0_6px_0_#161615]",
        // Faint dot grid: a board you stick things on.
        "bg-[radial-gradient(#e6e6e0_1.2px,transparent_1.2px)] [background-size:14px_14px]",
        className,
      )}
    >
      <div className="grid grid-cols-3 gap-2.5">
        {squares.map((s) => {
          const avail = availability?.(s) ?? "none";
          const tappable = !!onPick && (avail === "open" || s.state === "confirming");
          return (
            <Square
              key={s.index}
              square={s}
              avail={avail}
              fresh={fresh.has(s.index)}
              onClick={tappable ? () => onPick?.(s) : undefined}
              reward={reward}
            />
          );
        })}
      </div>

      {complete ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Stamp tone="kept" big slam className="rotate-[-10deg] bg-white/95 text-[30px]">
            Bingo!
          </Stamp>
          <Lulu size={64} mood="kept" className="absolute -bottom-5 -right-3" />
        </div>
      ) : null}
    </div>
  );
}

/** On-chain points a bonus square's free campaign awards (CommunityMarketV1.REDUCED_PROOF_POINTS). */
const BONUS_POINTS = 100;

function RewardChip({ square: s, reward }: { square: BingoSquareView; reward?: BoardReward }) {
  if (!reward) return null;
  const text = s.bonus ? `+${BONUS_POINTS} pts` : reward.perSquare > 0 ? `+${reward.perSquare.toLocaleString()} G$` : null;
  if (!text) return null;
  return (
    <span
      className={cn(
        "absolute left-1.5 top-1.5 z-[1] rounded-full px-1.5 py-[2px] text-[9px] font-extrabold leading-none shadow-[0_1.5px_0_rgba(22,22,21,.25)]",
        s.bonus ? "bg-yellow text-ink" : "bg-green-strong text-white",
      )}
    >
      {text}
    </span>
  );
}

export type BoardReward = { perSquare: number };

/**
 * One square, edge to edge: the player's own photo fills it once submitted;
 * until then it's our sticker on the square's tint.
 */
function Square({
  square: s,
  avail,
  fresh,
  onClick,
  reward,
}: {
  square: BingoSquareView;
  avail: SquareAvailability;
  fresh: boolean;
  onClick?: () => void;
  reward?: BoardReward;
}) {
  const tint = squareTint(s.index);
  const Tag = onClick ? "button" : "div";
  const photo = s.photoUrl && (s.state === "filled" || s.state === "confirming");
  const open = avail === "open" && s.state === "empty";
  const missed = s.state === "missed";

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      aria-label={`${s.title}${s.state === "filled" ? " — done" : open ? " — add a photo" : ""}`}
      style={{ transform: `rotate(${squareTilt(s.index) * 0.6}deg)`, background: photo || missed ? undefined : tint.bg, borderColor: open || photo ? undefined : missed ? undefined : tint.edge }}
      className={cn(
        "relative aspect-square overflow-hidden rounded-2xl border-2 text-left transition-transform duration-200",
        photo && "border-ink bg-ink",
        missed && "border-line bg-[#ecece7]",
        open && "border-ink shadow-[0_3px_0_#161615]",
        onClick && "active:scale-95",
        fresh && "animate-[bingo-fill_.7s_cubic-bezier(.34,1.56,.64,1)_both]",
      )}
    >
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.photoUrl!}
            alt=""
            loading="lazy"
            className={cn("absolute inset-0 h-full w-full object-cover", s.state === "confirming" && "opacity-50")}
          />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4">
            <span className="line-clamp-1 text-[9.5px] font-extrabold leading-tight text-white">{s.title}</span>
          </span>
          {s.state === "filled" ? (
            <CheckDot size={20} className={cn("absolute right-1 top-1", fresh && "animate-stamp-slam")} />
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="label-mono text-[8.5px]">Confirming</span>
            </span>
          )}
        </>
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1.5 pb-2 pt-3 text-center">
          <RewardChip square={s} reward={missed ? undefined : reward} />
          <MissionSticker title={s.title} size={38} muted={missed} className={cn(open && "animate-wiggle")} />
          <span
            className={cn("line-clamp-2 text-[10.5px] font-extrabold leading-[1.1]", missed && "text-faint line-through")}
            style={missed ? undefined : { color: tint.ink }}
          >
            {s.title}
          </span>
          {s.bonus ? (
            <span className="absolute right-1 top-1 flex h-5 w-5 rotate-12 items-center justify-center rounded-full bg-yellow text-[11px] shadow-[0_1.5px_0_#c99a0a]" aria-label="Bonus">
              ★
            </span>
          ) : null}
          {open ? (
            <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white shadow-[0_2px_0_#000]">
              <Camera className="h-3 w-3" />
            </span>
          ) : avail === "locked" && s.state === "empty" ? (
            <Lock className="absolute bottom-1.5 right-1.5 h-3 w-3 text-faint" />
          ) : null}
        </span>
      )}
    </Tag>
  );
}

/** One cell of the small boards: the photo edge to edge, else the sticker on its tint. */
function Cell({ square: s, sticker, className }: { square: BingoSquareView; sticker: number; className?: string }) {
  const photo = s.state === "filled" && s.photoUrl;
  const missed = s.state === "missed";
  return (
    <span
      className={cn("relative flex aspect-square items-center justify-center overflow-hidden", missed && "bg-[#ecece7]", className)}
      style={photo || missed ? undefined : { background: squareTint(s.index).bg }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.photoUrl!} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <MissionSticker title={s.title} size={sticker} muted={missed} />
      )}
    </span>
  );
}

/** Tiny board for player cards and lists. */
function MiniBoard({ squares, className }: { squares: BingoSquareView[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-3 gap-1 rounded-xl bg-white p-1 ring-2 ring-line", className)}>
      {squares.map((s) => (
        <Cell key={s.index} square={s} sticker={18} className="rounded-[7px]" />
      ))}
    </div>
  );
}

/**
 * The board as a card background (Explore): squares edge to edge, filling
 * with the player's own photos as they play, our stickers until then.
 */
export function BingoBoardBackground({
  squares,
  className,
  sticker,
  stack = false,
}: {
  squares: BingoSquareView[];
  className?: string;
  /** Sticker size override (small thumbnails). */
  sticker?: number;
  /** 3-square cards: stack the squares top to bottom (narrow thumbnails) instead of side by side. */
  stack?: boolean;
}) {
  // A 3-square card (My First 3) fills the box with its 3 squares; 7-day cards are a 3×3.
  const row = squares.length <= 3;
  const layout = !row ? "grid-cols-3 grid-rows-3" : stack ? "grid-cols-1 grid-rows-3" : "grid-cols-3 grid-rows-1";
  return (
    <div className={cn("grid gap-[3px] bg-ink", layout, className)} aria-hidden>
      {squares.slice(0, 9).map((s) => (
        <Cell key={s.index} square={s} sticker={sticker ?? (row ? 64 : 44)} className="aspect-auto h-full min-h-0" />
      ))}
    </div>
  );
}
