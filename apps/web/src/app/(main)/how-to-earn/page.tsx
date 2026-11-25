"use client";

import Link from "next/link";
import { usePublicRewards } from "@/hooks/use-public-rewards";
import { ChevronRight } from "lucide-react";
import { WatchHowItWorks } from "@/components/how-it-works-video";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { Coin, Lulu, ShieldBadge, Trophy, gameButtonClass } from "@/components/ds";
import { compactCount } from "@/lib/rewards/public-stats";
import { NAIRA_CASHOUT_MIN_G } from "@/lib/rewards/cash-out";
import { cn } from "@/lib/utils";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { ngnWorthShowing } from "@/lib/earn/format";
import { ACTIVE_POT } from "@/lib/pool/tickets";
import { TicketLadder } from "@/components/pot/stake-tickets";
import { useStakeRules } from "@/hooks/use-stake-rules";
import { useAuth } from "@/hooks/use-auth";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function Stat({ value, label, sub }: { value: string; label: string; sub?: string | null }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <div className="truncate font-display text-[28px] font-extrabold uppercase leading-none text-yellow tabular-nums">{value}</div>
      <div className="label-mono mt-1.5 truncate text-[9px] text-white/70">{label}</div>
      {sub ? <div className="mt-0.5 truncate text-[11px] font-semibold text-white/50">{sub}</div> : null}
    </div>
  );
}

function WayToEarn({
  art,
  title,
  sub,
  badge,
  href,
}: {
  art: React.ReactNode;
  title: string;
  sub: string;
  badge: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center">{art}</span>
      <div className="min-w-0 flex-1">
        <div className="font-extrabold leading-tight">{title}</div>
        <div className="mt-0.5 text-[12px] font-semibold leading-snug text-muted-foreground">{sub}</div>
      </div>
      <span className="shrink-0 rounded-full bg-green-soft px-2.5 py-1 text-[12px] font-extrabold text-green-edge">{badge}</span>
      {href ? <ChevronRight className="-mr-1 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
    </>
  );
  const cls = "flex animate-rise items-center gap-3 rounded-[20px] border-2 border-line bg-white px-3.5 py-3 text-ink no-underline shadow-edge";
  return href ? (
    <Link href={href} className={cn(cls, "press-edge")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** How to earn on Delulu — every way to earn, with live amounts and real payout numbers. */
export default function HowToEarnPage() {
  const { data, isLoading } = usePublicRewards();
  const facts = useEarnFacts();
  const ngn = (g: number) => (facts ? ngnWorthShowing(g * facts.gdUsd * facts.ngnPerUsd) : null);
  const pot = ACTIVE_POT.weeklyG;
  const stats = data?.stats;
  const { address } = useAuth();
  const { rules: stakeRules } = useStakeRules(address);
  const newcomer = stakeRules.tier === "newcomer";
  // Worked example: if this many tickets qualify, one ticket is worth pot / tickets.
  const EXAMPLE_TICKETS = 1_000;
  const perTicket = Math.floor(pot / EXAMPLE_TICKETS);

  return (
    <MainPage>
      <PageBackHeader title="How to earn on Delulu" eyebrow="Real money for showing up" />
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 pb-12 pt-4">
        {/* Proof we pay — live from payout records */}
        <div className="relative animate-rise overflow-hidden rounded-[24px] bg-ink px-4 pb-4 pt-5 text-white shadow-edge-ink">
            <span className="absolute -right-4 -top-5 rotate-12 opacity-20" aria-hidden>
              <Coin size={110} />
            </span>
            <div className="relative text-center">
              <p className="label-mono m-0 text-[10px] text-white/60">Shared every week</p>
              <p className="m-0 mt-1 font-display text-[34px] font-extrabold leading-none tracking-tight text-yellow tabular-nums">${ACTIVE_POT.weeklyUsd}</p>
              <p className="m-0 mt-1 text-[15px] font-extrabold text-white/80">{fmt(pot)} G$</p>
              <p className="m-0 mx-auto mt-2 max-w-[280px] text-[13px] font-semibold leading-snug text-white/80">
                This will be shared by everyone who shows up all 7 days. New players are in just for showing up.
              </p>
              <p className="m-0 mx-auto mt-2 max-w-[280px] text-[13px] font-semibold leading-snug text-white/80">
                Cash your G$ to a Naira bank account on the app.
              </p>
            </div>
            {isLoading ? (
              <div className="relative mt-4 h-14 animate-pulse rounded-xl bg-white/10" />
            ) : stats ? (
              <div className="relative mt-4 flex gap-2 border-t border-white/10 pt-3">
                <Stat value={compactCount(stats.totalG)} label="Already paid out" sub={ngn(stats.totalG) ? `≈ ${ngn(stats.totalG)}` : null} />
                <Stat value={fmt(stats.people)} label="People rewarded" />
              </div>
            ) : null}
          </div>

        <div className="flex animate-rise items-center gap-3 rounded-[20px] border-2 border-line bg-white px-3.5 py-3 text-ink shadow-edge">
          <Lulu size={36} animated={false} />
          <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-muted-foreground">What GoodDollar is, how staking works, how points are earned, and how the weekly pool is shared.</span>
          <Link href="/how-it-works" className="shrink-0 text-[13px] font-extrabold text-ink underline decoration-2 underline-offset-2">
            Read it
          </Link>
        </div>

        <div className="flex animate-rise items-center gap-3 rounded-[20px] border-2 border-line bg-white px-3.5 py-3 text-ink shadow-edge">
          <Lulu size={36} animated={false} />
          <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-muted-foreground">A short video of joining, points, and the share. It stays in the app.</span>
          <WatchHowItWorks className="shrink-0 text-[13px]" />
        </div>

        {/* Tickets: how the weekly pool is split — the higher the stake, the bigger the share. */}
        <section id="tickets" className="scroll-mt-20">
          <h2 className="m-0 mb-1 text-[20px] font-extrabold tracking-[-0.015em]">How tickets work</h2>
          <p className="m-0 mb-3 text-[13px] font-semibold leading-snug text-muted-foreground">
            Everyone who shows up all 7 days gets paid. Tickets decide how big your slice is: higher stake, more tickets, bigger share.
          </p>
          <div className="rounded-[20px] border-2 border-ink bg-white p-3.5 shadow-[0_3px_0_#000]">
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] font-extrabold">
              <li>1. Stake on a Bingo or goal</li>
              <li>2. Keep a photo every day, Monday to Sunday</li>
              <li>3. Your stake sets your tickets</li>
            </ol>
            <TicketLadder newcomer={newcomer} className="mt-3" />
            <div className="mt-3 rounded-xl bg-green-soft px-3 py-2.5 text-[12px] font-bold leading-snug text-green-edge">
              Example: if {fmt(EXAMPLE_TICKETS)} tickets qualify, each ticket is worth {fmt(perTicket)} G$. 5 tickets = {fmt(5 * perTicket)} G$ · 25 tickets = {fmt(25 * perTicket)} G$ · 40 tickets = {fmt(40 * perTicket)} G$.
            </div>
            <p className="m-0 mt-2 text-[11px] font-semibold text-muted-foreground">
              Returning players need at least 1,000 G$ staked. New players get {ACTIVE_POT.newcomerTickets} tickets in their first 2 weeks, whatever they stake.
            </p>
          </div>
        </section>

        {/* Ways to earn — how Delulu pays now; amounts live, ≈ ₦ at today's G$ rate. */}
        <section>
          <h2 className="m-0 mb-3 text-[20px] font-extrabold tracking-[-0.015em]">Ways to earn</h2>
          <div className="flex flex-col gap-2.5">
            {/* The two rewards everything else hangs off: the weekly pot and 10% cashback. */}
            <WayToEarn
              art={<span className="text-[30px] leading-none">🏆</span>}
              title="Weekly pool"
              sub="Show up all 7 days and you share it. A bigger stake is a bigger share."
              badge={`$${ACTIVE_POT.weeklyUsd}`}
              href="/home"
            />
            <WayToEarn
              art={<Trophy size={38} />}
              title="10% cashback"
              sub="On every stake: a little each day you keep, the rest when you finish, plus your stake back."
              badge="10%"
              href="/explore"
            />
          </div>
          <p className="m-0 mt-2 text-center text-[11px] font-semibold text-muted-foreground">G$ is a token — its price moves, so ₦ amounts are at today&apos;s rate.</p>

          <div className="mt-3 flex animate-rise items-center gap-3 rounded-[20px] border-2 border-yellow-line bg-yellow-soft px-3.5 py-3 shadow-edge-yellow-line">
            <ShieldBadge size={34} />
            <p className="m-0 flex-1 text-sm font-semibold leading-snug">One quick face check unlocks G$ rewards</p>
          </div>
        </section>

        {/* Cash out */}
        <section className="animate-rise rounded-[24px] border-2 border-green-line bg-green-soft p-4 shadow-edge-green-line">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl" aria-hidden>
              ₦
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-[18px] font-extrabold leading-tight">Cash your G$ to Naira</h2>
              <p className="label-mono m-0 mt-1 text-[10px] text-green-edge">
                To a Nigerian bank account on the app · from {fmt(NAIRA_CASHOUT_MIN_G)} G$
              </p>
            </div>
          </div>
          <p className="m-0 mt-3 text-sm leading-snug text-ink/80">
            Cash your rewards to a Naira bank account on the app.
          </p>
        </section>

        <Link href="/explore" className={cn(gameButtonClass({ full: true }), "no-underline")}>
          Pick a Bingo
        </Link>
      </div>
    </MainPage>
  );
}
