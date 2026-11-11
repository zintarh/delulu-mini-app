"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronRight, Send } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { Bolt, CheckDot, Chest, Coin, Flame, Lulu, ShieldBadge, Trophy, gameButtonClass } from "@/components/ds";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import type { PublicRewardsDto } from "@/app/api/rewards/public/route";
import { compactCount } from "@/lib/rewards/public-stats";
import { formatUsdFromG } from "@/lib/rewards/summary";
import { NAIRA_CASHOUT_MIN_G, NAIRA_CASHOUT_TELEGRAM_URL } from "@/lib/rewards/cash-out";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const compactG = (n: number) => (n >= 1000 && n % 1000 === 0 ? `${n / 1000}K` : fmt(n));

function usePublicRewards() {
  return useQuery<PublicRewardsDto>({
    queryKey: ["rewards-public"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch("/api/rewards/public");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });
}

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

const STEPS = [
  { art: <Lulu size={44} animated={false} />, title: "Say it", sub: "One small daily habit" },
  { art: <Coin size={36} />, title: "Stake it", sub: "Your word or a little money" },
  {
    art: (
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-soft">
        <Camera className="h-5 w-5 text-blue" strokeWidth={2.2} />
      </span>
    ),
    title: "Prove it",
    sub: "A photo a day, checked by AI",
  },
];

/** How to earn on Delulu — every way to earn, with live amounts and real payout numbers. */
export default function HowToEarnPage() {
  const { data, isLoading } = usePublicRewards();
  const { usd: usdPerG } = useGoodDollarPrice();
  const c = data?.config;
  const stats = data?.stats;
  const on = c?.categoryEnabled;
  const tiers = c ? [...c.campaignTiers].sort((a, b) => a.minDays - b.minDays) : [];
  const minCashoutUsd = formatUsdFromG(NAIRA_CASHOUT_MIN_G, usdPerG);

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

        {/* How it works */}
        <section>
          <h2 className="m-0 mb-3 text-[20px] font-extrabold tracking-[-0.015em]">How it works</h2>
          <div className="grid grid-cols-3 gap-2">
            {STEPS.map((s, i) => (
              <div key={s.title} className="flex animate-rise flex-col items-center rounded-[20px] border-2 border-line bg-white px-2 py-3 text-center shadow-edge" style={{ animationDelay: `${i * 0.06}s` }}>
                <span className="flex h-12 items-center justify-center">{s.art}</span>
                <span className="mt-1.5 font-display text-[18px] font-extrabold uppercase leading-none">{s.title}</span>
                <span className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.sub}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Ways to earn */}
        <section>
          <h2 className="m-0 mb-3 text-[20px] font-extrabold tracking-[-0.015em]">Ways to earn</h2>
          <div className="flex flex-col gap-2.5">
            <WayToEarn art={<Chest size={40} />} title="Free daily money" sub="Claim every day with GoodDollar" badge="Free" href="/daily-claim" />
            {!c ? (
              [0, 1, 2].map((i) => <div key={i} className="h-[70px] animate-pulse rounded-[20px] bg-line" />)
            ) : (
              <>
                {on?.daily_proof ? (
                  <WayToEarn
                    art={<CheckDot size={34} />}
                    title="Approved proof"
                    sub={`Up to ${c.maxEligibleGoals} goals a day`}
                    badge={`+${fmt(c.dailyAmount)} G$`}
                  />
                ) : null}
                {on?.weekly_consistency ? (
                  <WayToEarn
                    art={<Flame size={36} />}
                    title="Weekly streak"
                    sub={`${c.weeklyMinProofs} proofs in a week`}
                    badge={`+${fmt(c.weeklyAmount)} G$`}
                  />
                ) : null}
                {(on?.campaign_completion || on?.goal_completion) && tiers.length > 0 ? (
                  <WayToEarn
                    art={<Trophy size={38} />}
                    title="Finish a campaign or goal"
                    sub={tiers.map((t) => `${t.minDays} days · ${compactG(t.amount)}`).join("  ·  ")}
                    badge={`Up to ${compactG(Math.max(...tiers.map((t) => t.amount)))} G$`}
                  />
                ) : null}
              </>
            )}
            <WayToEarn
              art={<Trophy size={38} />}
              title="Monthly top performers"
              sub="Top and most consistent each month"
              badge="Monthly"
              href="/leaderboard"
            />
            <WayToEarn art={<Coin size={36} />} title="Campaign prizes" sub="Prize pools for top finishers" badge="Prizes" href="/explore" />
            {c ? (
              <WayToEarn
                art={<Bolt size={36} />}
                title="Points every proof"
                sub={`${fmt(c.proofPoints.free)} pts free · climb the leaderboard`}
                badge={`${fmt(c.proofPoints.staked)} pts staked`}
              />
            ) : null}
          </div>

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

        <Link href="/forfeit" className={cn(gameButtonClass({ full: true }), "no-underline")}>
          Start your first delulu
        </Link>
      </div>
    </MainPage>
  );
}
