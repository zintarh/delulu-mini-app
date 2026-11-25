"use client";

import Link from "next/link";
import { Ticket } from "lucide-react";
import { ACTIVE_POT, TICKETS, ticketsFor } from "@/lib/pool/tickets";
import { cn } from "@/lib/utils";

/**
 * Weekly Active Pot tickets, shown wherever a stake is picked: the higher the
 * stake, the more tickets, the bigger the share of the pot. Same rules as the
 * payout (lib/pool/tickets.ts) — never a separate copy of the numbers.
 */

const k = (n: number) => (n >= 1000 ? `${n % 1000 ? (n / 1000).toFixed(1) : n / 1000}k` : String(n));

/** "15 tickets" for a stake (new players get at least ACTIVE_POT.newcomerTickets). */
export function ticketsLabel(stake: number, newcomer: boolean): string {
  const t = ticketsFor(stake, newcomer);
  return t > 0 ? `${t} ticket${t === 1 ? "" : "s"}` : "No tickets";
}

/** Small chip for a stake option: "🎟 15 tickets". */
export function TicketChip({ stake, newcomer, selected, className }: { stake: number; newcomer: boolean; selected?: boolean; className?: string }) {
  const t = ticketsFor(stake, newcomer);
  if (t <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none",
        selected ? "bg-yellow text-ink" : "bg-yellow-soft text-[#8a6a00]",
        className,
      )}
    >
      <Ticket className="h-3 w-3" strokeWidth={2.6} aria-hidden /> {t}
    </span>
  );
}

/** One line under a stake picker: higher stake → more tickets in the Weekly Pot. */
export function StakeTicketsHint({ stake, newcomer, className }: { stake?: number; newcomer: boolean; className?: string }) {
  const t = stake ? ticketsFor(stake, newcomer) : 0;
  const next = stake ? TICKETS.find(([min]) => min > stake) : undefined;
  return (
    <Link
      href="/how-to-earn#tickets"
      className={cn("flex items-center gap-2 rounded-xl bg-yellow-soft px-3 py-2 text-[12px] font-bold leading-snug text-ink no-underline", className)}
    >
      <Ticket className="h-4 w-4 shrink-0 text-[#8a6a00]" strokeWidth={2.4} aria-hidden />
      <span className="min-w-0 flex-1">
        {t > 0 ? <>This stake = <b>{t} tickets</b> in the Weekly Pot. </> : null}
        {next ? <>Stake {k(next[0])} for <b>{next[1]}</b>. </> : null}
        Higher stake, bigger share.
      </span>
    </Link>
  );
}

/** The whole ladder: 1k → 5 … 100k → 40, with the player's current rung marked. */
export function TicketLadder({ stake, newcomer, className, dark }: { stake?: number; newcomer: boolean; className?: string; dark?: boolean }) {
  const current = stake ? [...TICKETS].reverse().find(([min]) => stake >= min)?.[0] : undefined;
  return (
    <div className={className}>
      <div className="grid grid-cols-5 gap-1.5">
        {TICKETS.map(([min, n]) => (
          <div
            key={min}
            className={cn(
              "flex flex-col items-center rounded-xl px-1 py-1.5",
              min === current ? "bg-ink text-white" : dark ? "bg-white/70 text-ink" : "bg-yellow-soft text-ink",
            )}
          >
            <span className="text-[10px] font-extrabold opacity-80">{k(min)}</span>
            <span className="font-display text-[18px] font-extrabold leading-none">{n}</span>
            <span className="text-[9px] font-bold opacity-70">tickets</span>
          </div>
        ))}
      </div>
      {newcomer ? (
        <p className="m-0 mt-1.5 text-[11px] font-bold opacity-80">New here: {ACTIVE_POT.newcomerTickets} tickets just for showing up all 7 days.</p>
      ) : null}
    </div>
  );
}
