"use client";

import Link from "next/link";
import { usePublicRewards } from "@/hooks/use-public-rewards";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Play, Send } from "lucide-react";
import { AppIntroView } from "@/components/app-intro";
import { useAuth } from "@/hooks/use-auth";
import { buildSignInUrl, persistSignInRedirect } from "@/lib/auth-redirect";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { Bolt, CheckDot, Chest, Coin, Lulu, ShieldBadge, Trophy, gameButtonClass } from "@/components/ds";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { compactCount } from "@/lib/rewards/public-stats";
import { formatUsdFromG } from "@/lib/rewards/summary";
import { NAIRA_CASHOUT_MIN_G, NAIRA_CASHOUT_TELEGRAM_URL } from "@/lib/rewards/cash-out";
import { cn } from "@/lib/utils";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { useBingoList } from "@/hooks/use-bingo";
import { fmtNgn } from "@/lib/earn/format";
import { BEST_CARD_PRIZE_G } from "@/lib/bingo/cheers";
import { REFERRAL_ROUNDS, roundFirstPayment } from "@/lib/referral/campaign";

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
        <div className="label-mono mt-1 text-[10px] text-muted-foreground">{sub}</div>
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
  const { usd: usdPerG } = useGoodDollarPrice();
  const facts = useEarnFacts();
  const ngn = (g: number) => (facts ? fmtNgn(g * facts.gdUsd * facts.ngnPerUsd) : null);
  const { bingos } = useBingoList();
  // Cashback ladder from the live Bingos: one row per stake (3-day and 7-day), smallest first.
  const ladder = useMemo(() => {
    const rows = new Map<string, { days: number; stake: number; back: number }>();
    for (const b of bingos ?? []) {
      for (const t of b.tiers) {
        if (typeof t.completionReward !== "number" || t.completionReward <= 0 || b.slug === "first-week") continue;
        rows.set(`${b.durationDays}-${t.stake}`, { days: b.durationDays, stake: t.stake, back: t.completionReward });
      }
    }
    return [...rows.values()].sort((a, b) => a.stake - b.stake || a.days - b.days);
  }, [bingos]);
  const maxBack = ladder.reduce((m, r) => Math.max(m, r.back), 0);
  const round = REFERRAL_ROUNDS[0];
  const referralTotal = round.reward;
  const referralFirst = roundFirstPayment(round);
  const c = data?.config;
  const stats = data?.stats;
  const minCashoutUsd = formatUsdFromG(NAIRA_CASHOUT_MIN_G, usdPerG);
  const [introOpen, setIntroOpen] = useState(false);
  const { authenticated } = useAuth();
  const router = useRouter();

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
              <Stat value={compactCount(stats.totalG)} label="G$ paid out" sub={formatUsdFromG(stats.totalG, usdPerG) ? `≈ ${formatUsdFromG(stats.totalG, usdPerG)}` : null} />
              <Stat value={fmt(stats.people)} label="People rewarded" />
              <Stat value={compactCount(stats.biggestG)} label="Biggest payout" sub="G$" />
            </div>
            <p className="label-mono relative m-0 mt-4 text-center text-[9px] text-white/50">Live from our payout records</p>
          </div>
        ) : null}

        {/* How it works: replays the first-run intro instead of repeating it here. */}
        <button
          type="button"
          onClick={() => setIntroOpen(true)}
          className="press-edge flex animate-rise items-center gap-3 rounded-[20px] border-2 border-line bg-white px-3.5 py-3 text-left text-ink shadow-edge"
        >
          <Lulu size={36} animated={false} />
          <span className="min-w-0 flex-1 font-extrabold leading-tight">How Delulu works</span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow shadow-edge-yellow">
            <Play className="h-4 w-4 translate-x-[1px] fill-current" strokeWidth={2.4} />
          </span>
        </button>

        {/* Ways to earn — how Delulu pays now; amounts live, ≈ ₦ at today's G$ rate. */}
        <section>
          <h2 className="m-0 mb-3 text-[20px] font-extrabold tracking-[-0.015em]">Ways to earn</h2>
          <div className="flex flex-col gap-2.5">
            <WayToEarn art={<Chest size={40} />} title="Free daily money" sub="Claim every day with GoodDollar" badge="Free" href="/daily-claim" />
            {facts?.firstWeek ? (
              <WayToEarn
                art={<Lulu size={40} mood="kept" animated={false} />}
                title="Your first week"
                sub={`7 days in a row · new players · ≈ ${fmtNgn(facts.firstWeek.entry.ngn)}`}
                badge={`+${compactG(facts.firstWeek.entry.g)} G$`}
                href="/bingo/first-week"
              />
            ) : null}
            {c?.categoryEnabled.daily_proof ? (
              <WayToEarn
                art={<CheckDot size={34} />}
                title="Every photo pays"
                sub={c.categoryEnabled.weekly_consistency ? `+${fmt(c.weeklyAmount)} G$ for ${c.weeklyMinProofs} days in a row` : "Each day you post on a Bingo"}
                badge={`+${fmt(c.dailyAmount)} G$`}
              />
            ) : null}
            <WayToEarn
              art={<Trophy size={38} />}
              title="Finish a Bingo"
              sub="Your stake back + cashback · bigger stake, more back"
              badge={maxBack ? `Up to +${compactG(maxBack)} G$` : "Cashback"}
              href="/explore"
            />
            {/* The ladder, so "stake more, get more" is obvious */}
            {ladder.length ? (
              <div className="-mt-1 grid grid-cols-2 gap-1.5 rounded-[18px] bg-paper p-2 sm:grid-cols-3">
                {ladder.map((r) => (
                  <div key={`${r.days}-${r.stake}`} className="rounded-xl bg-white px-2.5 py-2 text-[12px] font-bold shadow-edge-sm">
                    <span className="text-muted-foreground">{r.days}d · </span>
                    {compactG(r.stake)} → <span className="text-green-edge">+{fmt(r.back)}</span>
                    {ngn(r.back) ? <span className="block text-[10px] font-semibold text-muted-foreground">≈ {ngn(r.back)}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <WayToEarn
              art={<span className="text-[30px] leading-none">🔥</span>}
              title="Cheers on your card"
              sub={`People send you G$ · best card each week wins ${compactG(BEST_CARD_PRIZE_G)}`}
              badge={`${compactG(BEST_CARD_PRIZE_G)} G$`}
              href="/explore"
            />
            <WayToEarn
              art={<span className="text-[30px] leading-none">🤝</span>}
              title="Invite friends"
              sub={`+${compactG(referralFirst)} when they start · +${compactG(referralTotal - referralFirst)} at day 3`}
              badge={`${compactG(referralTotal)} G$`}
              href="/referrals"
            />
            <WayToEarn
              art={<Bolt size={36} />}
              title="Season points"
              sub="Bigger stake, more points a day · climb the board"
              badge="Season 2"
              href="/leaderboard"
            />
            <WayToEarn
              art={<Trophy size={38} />}
              title="Monthly top performers"
              sub="Top and most consistent each month"
              badge="Monthly"
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
                From {fmt(NAIRA_CASHOUT_MIN_G)} G${minCashoutUsd ? ` (≈ ${minCashoutUsd})` : ""}
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

      {introOpen ? (
        <AppIntroView
          guest={!authenticated}
          onDone={() => setIntroOpen(false)}
          onStart={() => {
            setIntroOpen(false);
            persistSignInRedirect("/how-to-earn");
            router.push(buildSignInUrl("/how-to-earn"));
          }}
        />
      ) : null}
    </MainPage>
  );
}
