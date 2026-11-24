"use client";

import Link from "next/link";
import { ChevronRight, Flame, Lock, Trophy } from "lucide-react";
import { useBingoList } from "@/hooks/use-bingo";
import { fmtNgn, toMoney } from "@/lib/earn/format";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { FIRST_WEEK_SLUG } from "@/lib/bingo/first-week";
import { cn } from "@/lib/utils";
import type { BingoView } from "@/lib/bingo/view";

/** The card AtStakeCard is about: a running rolling Bingo you're still in. */
export function atStakePlaying(bingos: BingoView[] | null | undefined) {
  return bingos?.find((b) => b.enrollment === "rolling" && b.me && b.me.phase === "live" && !b.me.missedDay) ?? null;
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

  const playing = atStakePlaying(bingos);
  const bonusFor = (slug: string) =>
    slug === facts.firstWeek?.slug ? facts.firstWeek.entry : slug === facts.sevenDay?.slug ? facts.sevenDay.entry : null;
  const top = [...facts.topCampaign.slice(0, 1), ...facts.topReferrers.slice(0, 1)];

  let head: React.ReactNode = null;
  let href = "/explore";
  if (playing?.me) {
    const me = playing.me;
    const day = (me.today ?? 0) + 1;
    const bonus = bonusFor(playing.slug);
    // First Week pays as you go — show what they'd walk away from.
    const perPhoto = playing.slug === facts.firstWeek?.slug ? facts.firstWeek.perPhoto : playing.rewards.perProof;
    const earned = toMoney(me.requiredFilled * perPhoto, facts.gdUsd, facts.ngnPerUsd);
    href = `/bingo/${playing.slug}`;
    head = (
      <>
        <p className="m-0 text-[14px] font-extrabold leading-tight">
          {me.todayUsed ? `Day ${day} done ✓ — back tomorrow` : `${me.stake.toLocaleString("en-US")} G$ on the line today`}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={cn(chip, "text-orange")}>
            <Lock className="h-3 w-3" /> Miss a day: lose {me.stake.toLocaleString("en-US")} G$
          </span>
          {earned.g > 0 ? (
            <span className={chip}>
              Earned: {earned.g.toLocaleString("en-US")} G$ · {fmtNgn(earned.ngn)}
            </span>
          ) : null}
          {bonus ? (
            <span className={cn(chip, "text-green-edge")}>
              <Flame className="h-3 w-3" /> Finish: {fmtNgn(bonus.ngn)}
            </span>
          ) : null}
        </div>
      </>
    );
  } else if (bingos.some((b) => b.slug === FIRST_WEEK_SLUG && b.joinable)) {
    // The First Week hero at the top of Home already carries this.
    return null;
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
            {top.map((e) => `@${e.name} ${fmtNgn(e.ngn)}`).join("  ·  ")}
          </p>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
