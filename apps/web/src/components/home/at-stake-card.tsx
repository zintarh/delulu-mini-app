"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Flame, Lock, Trophy } from "lucide-react";
import { useBingoList } from "@/hooks/use-bingo";
import { fmtMoney, fmtNgn, fmtUsd, type EarnFacts } from "@/lib/earn/format";
import { FIRST_WEEK_SLUG } from "@/lib/bingo/first-week";
import { cn } from "@/lib/utils";

function useEarnFacts() {
  return useQuery({
    queryKey: ["earn-facts"],
    staleTime: 15 * 60_000,
    queryFn: async (): Promise<EarnFacts> => {
      const res = await fetch("/api/earn/facts");
      if (!res.ok) throw new Error("earn facts unavailable");
      return res.json();
    },
  }).data;
}

const chip = "inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold";

/**
 * What's at stake, in money people feel: on a card → what tomorrow's missed
 * photo would cost; not playing → what 7 days earns (First Week for new and
 * invited players). Top earners underneath, in $ and ₦.
 */
export function AtStakeCard({ className }: { className?: string }) {
  const facts = useEarnFacts();
  const { bingos } = useBingoList();
  if (!facts || !bingos) return null;

  const playing = bingos.find((b) => b.enrollment === "rolling" && b.me && b.me.phase === "live" && !b.me.missedDay);
  const firstWeek = bingos.find((b) => b.slug === FIRST_WEEK_SLUG && !b.me && b.cycle === null);
  const bonusFor = (slug: string) =>
    slug === facts.firstWeek?.slug ? facts.firstWeek.entry : slug === facts.sevenDay?.slug ? facts.sevenDay.entry : null;
  const top = [...facts.topCampaign.slice(0, 1), ...facts.topReferrers.slice(0, 1)];

  let head: React.ReactNode = null;
  let href = "/explore";
  if (playing?.me) {
    const me = playing.me;
    const day = (me.today ?? 0) + 1;
    const bonus = bonusFor(playing.slug);
    href = `/bingo/${playing.slug}`;
    head = (
      <>
        <p className="m-0 text-[14px] font-extrabold leading-tight">
          {me.todayUsed ? `Day ${day} done ✓ — back tomorrow` : `Day ${day} is still open`}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={cn(chip, "text-orange")}>
            <Lock className="h-3 w-3" /> Miss a day: lose {me.stake.toLocaleString("en-US")} G$
          </span>
          {bonus ? (
            <span className={cn(chip, "text-green-edge")}>
              <Flame className="h-3 w-3" /> Finish: {fmtUsd(bonus.usd)} · {fmtNgn(bonus.ngn)}
            </span>
          ) : null}
        </div>
      </>
    );
  } else if (firstWeek && facts.firstWeek) {
    href = `/bingo/${FIRST_WEEK_SLUG}`;
    head = (
      <>
        <p className="m-0 text-[14px] font-extrabold leading-tight">Earn {fmtMoney(facts.firstWeek.entry)} in 7 days</p>
        <p className="m-0 mt-0.5 text-[11px] font-semibold text-muted-foreground">One photo a day · new players · once</p>
      </>
    );
  } else if (top.length) {
    href = "/leaderboard";
    head = <p className="m-0 text-[14px] font-extrabold leading-tight">Stake more, earn more</p>;
  }
  if (!head) return null;

  return (
    <Link
      href={href}
      className={cn("flex items-center gap-3 rounded-2xl border-2 border-yellow-line bg-yellow-soft px-3.5 py-3 text-ink no-underline", className)}
    >
      <div className="min-w-0 flex-1">
        {head}
        {top.length ? (
          <p className="m-0 mt-1.5 flex items-center gap-1 truncate text-[11px] font-semibold text-muted-foreground">
            <Trophy className="h-3 w-3 shrink-0" />
            {top.map((e) => `@${e.name} ${fmtUsd(e.usd)} · ${fmtNgn(e.ngn)}`).join("  ·  ")}
          </p>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
