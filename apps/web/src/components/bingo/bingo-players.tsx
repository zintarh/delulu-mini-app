"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { Lulu } from "@/components/ds";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { LeaderboardPagination } from "@/components/leaderboard-pagination";
import { BingoCollage } from "@/components/bingo/bingo-collage";
import { CheerPanel } from "@/components/bingo/cheers";
import type { CheerContest } from "@/lib/bingo/cheers-server";
import { flexStatus } from "@/components/bingo/bingo-flex-card";
import type { BoardCard } from "@/hooks/use-bingo";
import { cn } from "@/lib/utils";

const MEDAL = ["🥇", "🥈", "🥉"];
/** Top 10 first; the rest a page at a time. */
const PAGE_SIZE = 10;

/**
 * Players as a plain leaderboard — most days kept first — and a tap opens
 * that player's collage card. Cards are for looking at one at a time; the
 * list is for seeing where you stand.
 */
export function BingoPlayers({
  cards,
  required,
  bingoTitle,
  myAttemptId,
  slug,
  contest,
}: {
  cards: BoardCard[];
  required: number;
  bingoTitle: string;
  myAttemptId: string | null;
  slug: string;
  /** This week's "Best card" contest: rank by cheers once anyone's been cheered. */
  contest?: CheerContest;
}) {
  const [open, setOpen] = useState<BoardCard | null>(null);
  const [page, setPage] = useState(0);
  const scores = useMemo(() => contest?.scores ?? {}, [contest?.scores]);
  const byCheers = Object.keys(scores).length > 0;
  // Most cheers (the contest), then most days kept, then whoever got there first.
  const ranked = useMemo(
    () =>
      [...cards].sort(
        (a, b) =>
          (byCheers ? (scores[b.attemptId]?.score ?? 0) - (scores[a.attemptId]?.score ?? 0) : 0) ||
          b.requiredFilled - a.requiredFilled ||
          Date.parse(a.lastFilledAt ?? a.startedAt) - Date.parse(b.lastFilledAt ?? b.startedAt),
      ),
    [cards, scores, byCheers],
  );

  const pages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const from = current * PAGE_SIZE;
  const shown = ranked.slice(from, from + PAGE_SIZE);
  // Your card isn't on this page: pin it at the bottom, with its real rank.
  const myIndex = myAttemptId ? ranked.findIndex((c) => c.attemptId === myAttemptId) : -1;
  const pinned = myIndex >= 0 && (myIndex < from || myIndex >= from + PAGE_SIZE) ? { card: ranked[myIndex], i: myIndex } : null;
  const rows = [...shown.map((card, k) => ({ card, i: from + k })), ...(pinned ? [pinned] : [])];
  const go = (p: number) => {
    setPage(p);
    document.getElementById("players-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <ol className="flex flex-col gap-1.5">
        {rows.map(({ card, i }) => {
          const mine = card.attemptId === myAttemptId;
          const status = flexStatus(card, required);
          const photos = card.squares.filter((s) => !s.bonus && s.state === "filled" && s.photoUrl).slice(-3).reverse();
          const name = mine ? "You" : card.username ? `@${card.username}` : `${card.wallet.slice(0, 6)}…`;
          return (
            <li key={card.attemptId}>
              <button
                type="button"
                onClick={() => setOpen(card)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition-colors",
                  mine ? "border-ink bg-yellow-soft" : "border-line bg-white hover:bg-paper",
                )}
              >
                <span className="w-7 shrink-0 text-center font-display text-[18px] font-extrabold tabular-nums">
                  {i < 3 && card.requiredFilled > 0 ? MEDAL[i] : i + 1}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-line bg-white">
                  {card.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Lulu size={30} animated={false} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-extrabold">{name}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-line">
                      <span
                        className={cn("block h-full rounded-full", status.done ? "bg-green-edge" : "bg-ink")}
                        style={{ width: `${Math.min(100, (card.requiredFilled / required) * 100)}%` }}
                      />
                    </span>
                    <span className="truncate text-[11px] font-semibold text-muted-foreground">{status.label}</span>
                  </span>
                </span>
                {/* Their latest photos, stacked like a mini pinboard */}
                {photos.length ? (
                  <span className="flex shrink-0 -space-x-3">
                    {photos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.index} src={p.photoUrl!} alt="" loading="lazy" className="h-9 w-9 rounded-lg border-2 border-white object-cover shadow-sm" />
                    ))}
                  </span>
                ) : card.photosPrivate && !mine && card.requiredFilled > 0 ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-line text-muted-foreground" title="Photos are private">
                    <Lock className="h-4 w-4" />
                  </span>
                ) : null}
                {scores[card.attemptId] ? (
                  <span className="shrink-0 rounded-full bg-orange-soft px-2 py-0.5 text-[11px] font-extrabold text-orange">🔥{scores[card.attemptId].score}</span>
                ) : null}
                <span className="w-9 shrink-0 text-right font-display text-[16px] font-extrabold tabular-nums">
                  {card.requiredFilled}/{required}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ol>
      {pages > 1 ? (
        <LeaderboardPagination
          page={current}
          rangeStart={from + 1}
          rangeEnd={from + shown.length}
          total={ranked.length}
          hasNextPage={current < pages - 1}
          onPrev={() => go(Math.max(0, current - 1))}
          onNext={() => go(current + 1)}
        />
      ) : null}

      <ResponsiveSheet
        open={open != null}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? `${open.username ? `@${open.username}` : "Player"}'s card` : "Card"}
        sheetClassName="rounded-t-3xl pb-10"
        modalClassName="max-w-md"
      >
        {open ? (
          <div className="px-4 pb-2 pt-1">
            <BingoCollage card={open} bingoTitle={bingoTitle} required={required} mine={open.attemptId === myAttemptId} />
            {/* Every card is one tap from a cheer — the vote in this week's Best card contest. */}
            {/* Private cards can't be seen, so they sit out the cheer contest. */}
            {open.photosPrivate ? null : (
            <CheerPanel
              slug={slug}
              attemptId={open.attemptId}
              ownerWallet={open.wallet}
              ownerName={open.username ? `@${open.username}` : "this player"}
              contest={contest}
            />
            )}
          </div>
        ) : null}
      </ResponsiveSheet>
    </>
  );
}
