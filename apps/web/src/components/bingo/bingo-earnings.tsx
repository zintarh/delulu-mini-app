"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BingoView } from "@/lib/bingo/view";
import { cn } from "@/lib/utils";

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : n.toLocaleString("en-US"));

function useMath(bingo: BingoView) {
  const days = bingo.missions.filter((m) => !m.bonus).length || bingo.durationDays;
  const perDay = bingo.rewards.perProof;
  // In-app amounts are G$ (25 Nov 2026), not naira.
  const money = (g: number) => `${k(g)} G$`;
  const rows = bingo.tiers
    .filter((t) => t.stake > 0)
    .map((t) => {
      const day = typeof t.rewardPerSquare === "number" ? t.rewardPerSquare : perDay;
      // First Week: up to the stake from the pot of those who missed.
      const back = t.potShare ? t.stake : typeof t.completionReward === "number" ? t.completionReward : bingo.rewards.completion;
      return { key: t.key, stake: t.stake, back, day, total: day * days + back };
    })
    .sort((a, b) => a.stake - b.stake);
  return { days, perDay, money, rows };
}

/**
 * Before joining: one number (the most this Bingo pays), one line on how, and
 * every stake level behind a tap — not a table of figures up front.
 */
export function BingoEarnings({ bingo, className }: { bingo: BingoView; className?: string }) {
  const { days, perDay, money, rows } = useMath(bingo);
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  const top = rows[rows.length - 1];
  return (
    <section className={cn("rounded-[22px] border-2 border-ink bg-white p-3.5 text-ink shadow-[0_3px_0_#000]", className)}>
      <p className="label-mono m-0 text-[10px] text-muted-foreground">Finish and take home</p>
      <p className="m-0 mt-0.5 font-display text-[30px] font-extrabold leading-none text-green-edge">
        {rows.length > 1 ? <span className="mr-1.5 text-[15px] text-ink">up to</span> : null}
        {money(top.total)}
      </p>
      <p className="m-0 mt-1.5 text-[12px] font-semibold text-muted-foreground">
        {rows.every((r) => bingo.tiers.find((t) => t.key === r.key)?.potShare)
          ? `${rows[0].day} G$ a photo for ${days} days · finishers split what others lose · your stake back`
          : rows.every((r) => bingo.tiers.find((t) => t.key === r.key)?.rewardPerSquare != null)
            ? "10% of your stake back: a little each day, the rest when you finish, plus your stake."
            : `${perDay} G$ a photo for ${days} days, cashback at the end, and your stake back.`}
      </p>
      {rows.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-extrabold text-ink"
          >
            {open ? "Hide" : "See"} every stake <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
          {open ? (
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-[12px]">
                  <span className="font-bold">Stake {k(r.stake)} G$</span>
                  <span className="font-extrabold text-green-edge">+{money(r.total)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** After joining: one line for your own stake. */
export function BingoEarningsLine({ bingo, stake, className }: { bingo: BingoView; stake: number; className?: string }) {
  const { money, rows } = useMath(bingo);
  const mine = rows.find((r) => r.stake === stake);
  if (!mine) return null;
  return (
    <p className={cn("m-0 rounded-2xl bg-green-soft px-3 py-2 text-[12px] font-bold text-green-edge", className)}>
      Finish to take home +{money(mine.total)} · plus your stake back
    </p>
  );
}
