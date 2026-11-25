"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight } from "lucide-react";
import { Trophy } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { ticketsFor } from "@/lib/pool/tickets";
import { cn } from "@/lib/utils";

type Pot = {
  start: string;
  end: string;
  potG: number;
  splitsAt: string;
  playersOnTrack: number;
  perTicket: number;
  me: { days: string[]; onTrack: boolean; keptToday: boolean; newcomer: boolean | null; estimate: number; tickets: number; stake: number } | null;
};

const g = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("en-US"));
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The Weekly Active Pot on Home: how big it is, your 7 days, whether you're on
 * track, and what bigger stakes would do to your share. Shows up every visit
 * so "don't break the week" is always in view.
 */
export function HomePotCard({ className }: { className?: string }) {
  const { address } = useAuth();
  const { data: pot } = useQuery({
    queryKey: ["active-pot", address?.toLowerCase() ?? null],
    staleTime: 30_000,
    queryFn: async (): Promise<Pot | null> => {
      const r = await fetch(`/api/pot${address ? `?address=${address}` : ""}`);
      return r.ok ? r.json() : null;
    },
  });
  if (!pot) return null;

  const me = pot.me;
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${pot.start}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
  const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
  // The step up that matters most: from a small stake to 1,000 (5× the tickets).
  const upTickets = me ? ticketsFor(1_000, !!me.newcomer) : 0;
  const nudge = me && me.onTrack && me.stake < 1_000 && me.tickets > 0 ? `Stake 1,000 for ${upTickets} tickets (you have ${me.tickets})` : null;

  return (
    <Link
      href="/how-to-earn"
      className={cn("press-edge relative block overflow-hidden rounded-[22px] border-2 border-ink bg-yellow p-3.5 text-ink no-underline shadow-[0_4px_0_#000]", className)}
    >
      <span className="pointer-events-none absolute -right-2 -top-1 opacity-90" aria-hidden>
        <Trophy size={52} />
      </span>
      <p className="label-mono m-0 text-[10px] text-[#5c4a0a]">Weekly pot · show up 7 days</p>
      <p className="m-0 mt-0.5 font-display text-[30px] font-extrabold leading-none">{g(pot.potG)} G$</p>
      <p className="m-0 mt-1 text-[12px] font-bold text-[#5c4a0a]">
        {pot.playersOnTrack.toLocaleString("en-US")} on track · splits Sunday midnight
      </p>

      {me ? (
        <>
          <ol className="m-0 mt-3 flex list-none gap-1 p-0" aria-label="Your days this week">
            {weekDays.map((d, i) => {
              const kept = me.days.includes(d);
              return (
                <li
                  key={d}
                  className={cn(
                    "flex h-7 flex-1 items-center justify-center rounded-lg text-[11px] font-extrabold",
                    kept ? "bg-ink text-yellow" : d === today ? "bg-white ring-2 ring-ink" : d < today ? "bg-black/10 text-black/40" : "bg-white/60 text-black/40",
                  )}
                >
                  {kept ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : DAYS[i]}
                </li>
              );
            })}
          </ol>
          <p className="m-0 mt-2 flex items-center justify-between gap-2 text-[12px] font-extrabold">
            <span>
              {me.onTrack
                ? me.estimate > 0
                  ? `You're in ✓ · your share now ≈ ${g(me.estimate)} G$`
                  : me.keptToday
                    ? "You're in ✓"
                    : "Post on a staked card today to stay in"
                : "Missed a day · back in on Monday"}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </p>
          {nudge ? <p className="m-0 mt-1 text-[11px] font-bold text-[#5c4a0a]">{nudge}{me.newcomer ? " · new players get double" : ""}</p> : null}
        </>
      ) : (
        <p className="m-0 mt-2 text-[12px] font-extrabold">Stake, post a photo every day, share the pot →</p>
      )}
    </Link>
  );
}
