"use client";

import { Lulu } from "@/components/ds";
import { MissionSticker } from "@/components/bingo/mission-stickers";
import { squareTint } from "@/lib/bingo/mission-art";
import type { BingoCardView, BingoSquareView } from "@/lib/bingo/view";
import { cn } from "@/lib/utils";

/**
 * The Bingo card as a collectible — the thing people screenshot and share.
 * Themed by stake (Starter sunny, Pro hot pink, Elite ink + gold) so a bigger
 * stake looks like a bigger flex; the player's photos are the art; progress
 * is a big score; a finished card gets the BINGO stamp. Same card on Home,
 * the player boards (size "sm") and the share image.
 */
export type FlexTheme = { bg: string; fg: string; sub: string; accent: string; frame: string; chipBg: string; chipFg: string };

// White text needs ≥ 4.5:1 on the card: Pro and Entry/First Week use deeper shades than the brand pink/green.
export const FLEX_THEMES: Record<string, FlexTheme> = {
  starter: { bg: "#F6C324", fg: "#161615", sub: "#5c4a0a", accent: "#161615", frame: "#161615", chipBg: "#161615", chipFg: "#F6C324" },
  pro: { bg: "#C93A6C", fg: "#ffffff", sub: "#ffe3ee", accent: "#ffffff", frame: "#161615", chipBg: "#ffffff", chipFg: "#C23E6E" },
  elite: { bg: "#161615", fg: "#ffffff", sub: "#bdbdb5", accent: "#F6C324", frame: "#F6C324", chipBg: "#F6C324", chipFg: "#161615" },
  entry: { bg: "#15784A", fg: "#ffffff", sub: "#dff7e9", accent: "#ffffff", frame: "#161615", chipBg: "#ffffff", chipFg: "#157041" },
};
export const flexTheme = (tierKey: string) => FLEX_THEMES[tierKey] ?? FLEX_THEMES.starter;

const DAY_MS = 86_400_000;

export function flexStatus(card: Pick<BingoCardView, "requiredFilled" | "startedAt" | "endsAt" | "status">, required: number, nowMs = Date.now()) {
  if (card.requiredFilled >= required) return { label: "BINGO! 🎉", done: true };
  const running = card.status === "active" && nowMs < Date.parse(card.endsAt);
  if (!running) return { label: `${card.requiredFilled}/${required} squares`, done: false };
  const day = Math.min(required, Math.floor((nowMs - Date.parse(card.startedAt)) / DAY_MS) + 1);
  const hot = card.requiredFilled >= 3 && card.requiredFilled >= day - 1;
  return { label: `Day ${day} of ${required}${hot ? " · on fire 🔥" : ""}`, done: false };
}

const MEDAL = ["🥇", "🥈", "🥉"];

export function BingoFlexCard({
  card,
  bingoTitle,
  required,
  size = "md",
  rank,
  mine = false,
  className,
}: {
  card: BingoCardView;
  bingoTitle: string;
  required: number;
  size?: "sm" | "md";
  /** Leaderboard position (medals for the top three). */
  rank?: number;
  mine?: boolean;
  className?: string;
}) {
  const t = flexTheme(card.tierKey);
  const sm = size === "sm";
  const status = flexStatus(card, required);
  const name = card.username ? `@${card.username}` : `${card.wallet.slice(0, 6)}…${card.wallet.slice(-4)}`;
  const squares = card.squares.filter((s) => !s.bonus).slice(0, 9);
  const cols = 3;

  return (
    <div
      className={cn("relative overflow-hidden border-[2.5px] text-left", sm ? "rounded-[18px] p-2" : "rounded-[26px] p-3.5", className)}
      style={{ background: t.bg, color: t.fg, borderColor: t.frame, boxShadow: `0 ${sm ? 3 : 5}px 0 ${t.frame}` }}
    >
      {/* Header: who, which tier */}
      <div className="flex items-center gap-2">
        <span
          className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-white", sm ? "h-6 w-6" : "h-9 w-9")}
          style={{ borderColor: t.frame }}
        >
          {card.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Lulu size={sm ? 20 : 30} animated={false} />
          )}
        </span>
        <span className={cn("min-w-0 flex-1 truncate font-extrabold", sm ? "text-[11px]" : "text-[14px]")}>{mine ? "You" : name}</span>
        {rank != null && rank <= 3 ? (
          <span className={sm ? "text-[15px]" : "text-[20px]"} aria-label={`Rank ${rank}`}>
            {MEDAL[rank - 1]}
          </span>
        ) : rank != null ? (
          <span className={cn("font-display font-extrabold opacity-80", sm ? "text-[12px]" : "text-[15px]")}>#{rank}</span>
        ) : null}
        {!sm ? (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide" style={{ background: t.chipBg, color: t.chipFg }}>
            {card.tierLabel}
          </span>
        ) : null}
      </div>

      {!sm ? <p className="m-0 mt-2 truncate font-display text-[20px] font-extrabold uppercase leading-none tracking-tight">{bingoTitle}</p> : null}

      {/* The art: their photos, our stickers where still empty */}
      <div
        className={cn("relative grid gap-1.5 rounded-[14px] border-2 bg-white p-1.5", sm ? "mt-1.5 gap-1 p-1" : "mt-2.5")}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, borderColor: t.frame }}
      >
        {squares.map((s) => (
          <FlexSquare key={s.index} square={s} sm={sm} />
        ))}
        {/* A 7-square card fills its 3×3: a Lulu badge and the live score take the last two spots. */}
        {squares.length === 7 ? (
          <>
            <span
              className={cn("flex aspect-square flex-col items-center justify-center", sm ? "rounded-[6px]" : "rounded-[10px]")}
              style={{ background: t.chipBg, color: t.chipFg }}
            >
              <Lulu size={sm ? 22 : 40} mood={status.done ? "kept" : "dream"} animated={false} />
              <span className={cn("font-display font-extrabold uppercase leading-none", sm ? "text-[8px]" : "text-[13px]")}>Bingo</span>
            </span>
            <span
              className={cn("flex aspect-square flex-col items-center justify-center", sm ? "rounded-[6px]" : "rounded-[10px]")}
              style={{ background: t.bg, color: t.accent, boxShadow: `inset 0 0 0 2px ${t.frame}` }}
            >
              <span className={cn("font-display font-extrabold leading-none tabular-nums", sm ? "text-[16px]" : "text-[30px]")}>
                {card.requiredFilled}/{required}
              </span>
              <span className={cn("font-bold uppercase leading-none opacity-70", sm ? "text-[7px]" : "text-[10px]")}>squares</span>
            </span>
          </>
        ) : null}
        {status.done ? (
          <span
            className={cn(
              "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[10deg] whitespace-nowrap rounded-xl border-[3px] border-green-edge bg-white/95 font-display font-extrabold uppercase text-green-edge shadow-[inset_0_0_0_2px_#fff]",
              sm ? "px-2 py-0.5 text-[14px]" : "px-4 py-1.5 text-[30px]",
            )}
          >
            Bingo!
          </span>
        ) : null}
      </div>

      {/* Score */}
      <div className={cn("flex items-end justify-between", sm ? "mt-1.5" : "mt-3")}>
        <div className="min-w-0">
          {squares.length !== 7 ? (
            <p className={cn("m-0 font-display font-extrabold leading-none tabular-nums", sm ? "text-[20px]" : "text-[40px]")} style={{ color: t.accent }}>
              {card.requiredFilled}
              <span className="opacity-60">/{required}</span>
            </p>
          ) : null}
          <p className={cn("m-0 truncate font-extrabold", sm ? "text-[10px]" : "text-[14px]")} style={{ color: squares.length === 7 ? t.fg : t.sub }}>
            {status.label}
          </p>
        </div>
        {!sm ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-extrabold opacity-90">
            <Lulu size={26} animated={false} /> staydelulu.xyz
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FlexSquare({ square: s, sm }: { square: BingoSquareView; sm: boolean }) {
  const photo = s.state === "filled" && s.photoUrl;
  const missed = s.state === "missed";
  return (
    <span
      className={cn("relative flex aspect-square items-center justify-center overflow-hidden", sm ? "rounded-[6px]" : "rounded-[10px]", missed && "bg-[#ecece7]")}
      style={photo || missed ? undefined : { background: squareTint(s.index).bg }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.photoUrl!} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <MissionSticker title={s.title} size={sm ? 18 : 30} muted={missed} />
      )}
    </span>
  );
}
