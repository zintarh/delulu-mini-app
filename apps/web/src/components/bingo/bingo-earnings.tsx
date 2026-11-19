"use client";

import { useEarnFacts } from "@/hooks/use-earn-facts";
import { fmtNgn } from "@/lib/earn/format";
import type { BingoView } from "@/lib/bingo/view";
import { cn } from "@/lib/utils";

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : n.toLocaleString("en-US"));

function useMath(bingo: BingoView) {
  const facts = useEarnFacts();
  const days = bingo.missions.filter((m) => !m.bonus).length || bingo.durationDays;
  const perDay = bingo.rewards.perProof;
  const ngn = (g: number) => (facts ? fmtNgn(g * facts.gdUsd * facts.ngnPerUsd) : null);
  const rows = bingo.tiers
    .filter((t) => t.stake > 0)
    .map((t) => {
      const back = typeof t.completionReward === "number" ? t.completionReward : bingo.rewards.completion;
      return { key: t.key, stake: t.stake, back, total: perDay * days + back };
    })
    .sort((a, b) => a.stake - b.stake);
  return { days, perDay, ngn, rows };
}

/**
 * Before joining: what this Bingo pays, per stake level — G$ a day, cashback
 * for finishing, and the most you take home (≈ ₦ at today's rate). One small
 * table instead of paragraphs.
 */
export function BingoEarnings({ bingo, className }: { bingo: BingoView; className?: string }) {
  const { days, perDay, ngn, rows } = useMath(bingo);
  if (!rows.length) return null;
  return (
    <section className={cn("rounded-[22px] border-2 border-ink bg-white p-3.5 shadow-[0_3px_0_#000]", className)}>
      <div className="flex items-baseline justify-between">
        <p className="m-0 text-[15px] font-extrabold">What you earn</p>
        <p className="label-mono m-0 text-[10px] text-muted-foreground">
          {perDay} G$ a photo · {days} days
        </p>
      </div>
      <div className="mt-2.5 grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1.5 text-[12px]">
        <span className="label-mono text-[9px] text-muted-foreground">Stake</span>
        <span className="label-mono text-[9px] text-muted-foreground">Cashback</span>
        <span className="label-mono text-right text-[9px] text-muted-foreground">You take home</span>
        {rows.map((r) => (
          <div key={r.key} className="contents">
            <span className="font-extrabold">{k(r.stake)} G$</span>
            <span className="font-extrabold text-green-edge">
              +{k(r.back)}
              {ngn(r.back) ? <span className="block text-[10px] font-semibold text-muted-foreground">≈ {ngn(r.back)}</span> : null}
            </span>
            <span className="text-right font-extrabold">
              +{k(r.total)} G$
              {ngn(r.total) ? <span className="block text-[10px] font-semibold text-muted-foreground">≈ {ngn(r.total)}</span> : null}
            </span>
          </div>
        ))}
      </div>
      <p className="m-0 mt-2.5 text-[11px] font-semibold text-muted-foreground">
        Plus your stake back when you finish. Miss a day and the card ends — you keep what you earned.
      </p>
    </section>
  );
}

/** After joining: one line for your own stake. */
export function BingoEarningsLine({ bingo, stake, className }: { bingo: BingoView; stake: number; className?: string }) {
  const { perDay, ngn, rows } = useMath(bingo);
  const mine = rows.find((r) => r.stake === stake);
  if (!mine) return null;
  return (
    <p className={cn("m-0 rounded-2xl bg-green-soft px-3 py-2 text-[12px] font-bold text-green-edge", className)}>
      {perDay} G$ a photo · finish +{k(mine.back)} cashback · up to +{k(mine.total)} G${ngn(mine.total) ? ` ≈ ${ngn(mine.total)}` : ""}
    </p>
  );
}
