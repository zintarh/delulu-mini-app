"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Link2 } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { Lulu, gameButtonClass } from "@/components/ds";
import { ACTIVE_POT, TICKETS } from "@/lib/pool/tickets";
import { NAIRA_CASHOUT_MIN_G } from "@/lib/rewards/cash-out";
import { LOW_STAKE_POINTS, POINTS_PER_STAKE_DIVISOR, REGULAR_MIN_STAKE } from "@/lib/season/rules";
import { STARTER_STAKE } from "@/lib/bingo/starter";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("en-US");

const CHAPTERS = [
  {
    n: "01",
    title: "GoodDollar is the money",
    body: "G$ is GoodDollar, a digital currency on Celo. One face check shows you are a real person, and then you can claim some G$ free every day. That G$ is what you stake on a habit, and what Delulu pays you when you keep it.",
  },
  {
    n: "02",
    title: "Staking is how you play",
    body: `You put G$ on a 7-day Bingo and post one photo a day. Keep every day and your stake comes back, plus 10%: a little on each day you keep, the rest when you finish. Miss a day and that stake goes to the pool. You can start with ${fmt(STARTER_STAKE)} G$ on one of the four first cards.`,
  },
  {
    n: "03",
    title: "Points are for showing up",
    body: `Each kept day is one proof. Points for that proof are your stake divided by ${POINTS_PER_STAKE_DIVISOR}: a ${fmt(REGULAR_MIN_STAKE)} G$ stake is ${fmt(REGULAR_MIN_STAKE / POINTS_PER_STAKE_DIVISOR)} points that day. A stake under ${fmt(REGULAR_MIN_STAKE)} G$, including the ${fmt(STARTER_STAKE)} G$ start, is ${LOW_STAKE_POINTS} points a day. Points place you on the season board. They are not the cash prize.`,
  },
  {
    n: "04",
    title: "The weekly pool is shared by tickets",
    body: `$${ACTIVE_POT.weeklyUsd} (${fmt(ACTIVE_POT.weeklyG)} G$) is shared each week by everyone who shows up all 7 days on a staked card. Your share is your tickets divided by every ticket that week. In your first ${ACTIVE_POT.newcomerDays} days you get ${ACTIVE_POT.newcomerTickets} tickets just for showing up, and more if your stake earns more. After that you need at least ${fmt(TICKETS[0][0])} G$ staked to be in.`,
  },
] as const;

export default function HowItWorksPage() {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  const share = async () => {
    const url = `${window.location.origin}/how-it-works`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 2500);
  };

  return (
    <MainPage>
      <PageBackHeader
        title="How Delulu works"
        eyebrow="Show up. Stake. Get paid."
        right={
          <button type="button" onClick={() => void share()} className="press-edge inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-line bg-white px-3 text-[12px] font-extrabold text-ink shadow-edge-sm">
            {copied === "copied" ? <Check className="h-4 w-4" strokeWidth={3} /> : <Link2 className="h-4 w-4" />}
            {copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy link"}
          </button>
        }
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 pb-14 pt-4">
        <section className="relative overflow-hidden rounded-[24px] border-2 border-ink bg-ink px-5 py-6 text-white shadow-[0_5px_0_#000]">
          <span className="pointer-events-none absolute -right-6 -top-8 opacity-90" aria-hidden>
            <Lulu size={120} mood="kept" />
          </span>
          <p className="label-mono relative m-0 text-[10px] text-yellow">The whole thing, on one page</p>
          <h2 className="relative m-0 mt-2 max-w-[16rem] font-display text-[34px] font-extrabold uppercase leading-[0.9]">
            A habit with money on it
          </h2>
          <p className="relative m-0 mt-3 max-w-[20rem] text-[14px] font-semibold leading-snug text-white/80">
            Pick a card. Stake G$. Show up every day. Your stake comes back with 10% on top, and a full week puts you in the ${ACTIVE_POT.weeklyUsd} pool ({fmt(ACTIVE_POT.weeklyG)} G$).
          </p>
        </section>

        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {CHAPTERS.map((c) => (
            <li key={c.n} className="rounded-[22px] border-2 border-line bg-white p-4 shadow-edge">
              <p className="label-mono m-0 text-[11px] text-yellow">{c.n}</p>
              <h3 className="m-0 mt-1 text-[18px] font-extrabold leading-tight">{c.title}</h3>
              <p className="m-0 mt-2 text-[14px] font-semibold leading-snug text-ink/75">{c.body}</p>
            </li>
          ))}
        </ol>

        <section className="rounded-[22px] border-2 border-line bg-white p-4 shadow-edge">
          <h3 className="m-0 text-[18px] font-extrabold">Tickets after your first {ACTIVE_POT.newcomerDays} days</h3>
          <p className="m-0 mt-1 text-[13px] font-semibold leading-snug text-muted-foreground">
            Below {fmt(TICKETS[0][0])} G$ you are not in the pool. These are the rungs once you are.
          </p>
          <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
            {TICKETS.map(([stake, tickets]) => (
              <li key={stake} className="flex items-center justify-between rounded-xl bg-wash px-3 py-2 text-[14px] font-extrabold">
                <span>{fmt(stake)} G$ staked</span>
                <span className="text-green-edge">{tickets} tickets</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[22px] border-2 border-green-line bg-green-soft p-4 shadow-edge-green-line">
          <h3 className="m-0 text-[18px] font-extrabold">Cash G$ to Naira</h3>
          <p className="m-0 mt-2 text-[14px] font-semibold leading-snug text-ink/80">
            Cash your G$ to a Naira bank account on the app, from {fmt(NAIRA_CASHOUT_MIN_G)} G$. The naira amount moves with the G$ price.
          </p>
        </section>

        <Link href="/explore" className={cn(gameButtonClass({ full: true }), "no-underline")}>
          Pick a Bingo
        </Link>
      </div>
    </MainPage>
  );
}
