"use client";

import Link from "next/link";
import { usePublicRewards } from "@/hooks/use-public-rewards";
import { ChevronRight, Send } from "lucide-react";
import { WatchHowItWorks } from "@/components/how-it-works-video";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { Chest, Coin, Lulu, ShieldBadge, Trophy, gameButtonClass } from "@/components/ds";
import { compactCount } from "@/lib/rewards/public-stats";
import { NAIRA_CASHOUT_MIN_G, NAIRA_CASHOUT_TELEGRAM_URL } from "@/lib/rewards/cash-out";
import { cn } from "@/lib/utils";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { ngnWorthShowing } from "@/lib/earn/format";
import { PRIZE } from "@/lib/leaderboard/windows";
import { ACTIVE_POT } from "@/lib/pool/tickets";
import { BEST_CARD_PRIZE_G } from "@/lib/bingo/cheers";
import { referralRoundForCopy, roundFirstPayment } from "@/lib/referral/campaign";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const compactG = (n: number) => (n >= 1000 && n % 1000 === 0 ? `${n / 1000}K` : fmt(n));

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
  // Earnings read in naira when the amount is worth showing; otherwise G$.
  const ngn = (g: number) => (facts ? ngnWorthShowing(g * facts.gdUsd * facts.ngnPerUsd) : null);
  const money = (g: number) => ngn(g) ?? `${compactG(g)} G$`;
  const round = referralRoundForCopy();
  const referralTotal = round.reward;
  const referralFirst = roundFirstPayment(round);
  const stats = data?.stats;

  return (
    <MainPage>
      <PageBackHeader title="How to earn on Delulu" eyebrow="Real money for showing up" />
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 pb-12 pt-4">
        {/* Proof we pay — live from payout records */}
        {isLoading ? (
          <div className="h-[132px] animate-pulse rounded-[24px] bg-ink/10" />
        ) : stats ? (
          <div className="relative animate-rise overflow-hidden rounded-[24px] bg-ink px-4 pb-4 pt-5 text-white shadow-edge-ink">
            <span className="absolute -right-4 -top-5 rotate-12 opacity-20" aria-hidden>
              <Coin size={110} />
            </span>
            <div className="relative flex gap-2">
              <Stat value={compactCount(stats.totalG)} label="G$ paid out" sub={ngn(stats.totalG) ? `≈ ${ngn(stats.totalG)}` : null} />
              <Stat value={fmt(stats.people)} label="People rewarded" />
              <Stat value={compactCount(stats.biggestG)} label="Biggest payout" sub={ngn(stats.biggestG) ? `G$ ≈ ${ngn(stats.biggestG)}` : "G$"} />
            </div>
            <p className="label-mono relative m-0 mt-4 text-center text-[9px] text-white/50">Live from our payout records</p>
          </div>
        ) : null}

        <div className="flex animate-rise items-center gap-3 rounded-[20px] border-2 border-line bg-white px-3.5 py-3 text-ink shadow-edge">
          <Lulu size={36} animated={false} />
          <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-muted-foreground">A short video of joining, points, and the share. It stays in the app.</span>
          <WatchHowItWorks className="shrink-0 text-[13px]" />
        </div>

        {/* Ways to earn — how Delulu pays now; amounts live, ≈ ₦ at today's G$ rate. */}
        <section>
          <h2 className="m-0 mb-3 text-[20px] font-extrabold tracking-[-0.015em]">Ways to earn</h2>
          <div className="flex flex-col gap-2.5">
            {/* The two rewards everything else hangs off: the weekly pot and 10% cashback. */}
            <WayToEarn
              art={<span className="text-[30px] leading-none">🏆</span>}
              title="Weekly pot"
              sub="Show up all 7 days on a staked card · new players are in just for showing up · stake more for a bigger share"
              badge={`${compactG(ACTIVE_POT.weeklyG)} G$`}
              href="/home"
            />
            <WayToEarn
              art={<Trophy size={38} />}
              title="10% cashback"
              sub="On every stake: a little each day you keep, the rest when you finish · plus your stake back"
              badge="10%"
              href="/explore"
            />
            <WayToEarn art={<Chest size={40} />} title="Free daily money" sub="Claim every day with GoodDollar, then stake it" badge="Free" href="/daily-claim" />
            {facts?.firstWeek ? (
              <WayToEarn
                art={<Lulu size={40} mood="kept" animated={false} />}
                title="Your first week"
                sub={facts.firstWeek.stake ? `Stake ${facts.firstWeek.stake.toLocaleString("en-US")} G$ · 7 days · new players` : "7 days in a row · new players"}
                badge={`up to ${compactG(facts.firstWeek.entry.g)} G$`}
                href="/bingo/first-week"
              />
            ) : null}
            <WayToEarn
              art={<span className="text-[30px] leading-none">🔥</span>}
              title="Cheers on your card"
              sub="People cheer your card · the best card each week wins"
              badge={money(BEST_CARD_PRIZE_G)}
              href="/explore"
            />
            <WayToEarn
              art={<span className="text-[30px] leading-none">🤝</span>}
              title="Invite friends"
              sub={referralFirst < referralTotal ? `+${compactG(referralFirst)} when they start · +${compactG(referralTotal - referralFirst)} at day 3` : "Paid once they verify, stake G$ and earn 1,000 points"}
              badge={money(referralTotal)}
              href="/referrals"
            />
            <WayToEarn
              art={<Trophy size={38} />}
              title="Leaderboard prize"
              sub={`Top ${PRIZE.winners} share it every 2 weeks · bigger stake, higher rank`}
              badge={money(PRIZE.poolG)}
              href="/leaderboard"
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
              <h2 className="m-0 text-[18px] font-extrabold leading-tight">Turn G$ into naira</h2>
              <p className="label-mono m-0 mt-1 text-[10px] text-green-edge">
                From {fmt(NAIRA_CASHOUT_MIN_G)} G${ngn(NAIRA_CASHOUT_MIN_G) ? ` (≈ ${ngn(NAIRA_CASHOUT_MIN_G)})` : ""}
              </p>
            </div>
          </div>
          <p className="m-0 mt-3 text-sm leading-snug text-ink/80">
            Message us on Telegram and we&apos;ll convert it for you.
          </p>
          {NAIRA_CASHOUT_TELEGRAM_URL ? (
            <a
              href={NAIRA_CASHOUT_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(gameButtonClass({ variant: "green", full: true }), "mt-3 no-underline")}
            >
              <Send className="h-4 w-4" strokeWidth={2.4} /> Message us on Telegram
            </a>
          ) : null}
        </section>

        <Link href="/explore" className={cn(gameButtonClass({ full: true }), "no-underline")}>
          Pick a Bingo
        </Link>
      </div>
    </MainPage>
  );
}
