"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Coin } from "@/components/ds";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { fmtNgn, fmtUsd } from "@/lib/earn/format";
import { cn } from "@/lib/utils";

/** 500 → "500", 3,250 → "3.25k", 8,000 → "8k" — exact, never rounded up. */
const k = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(2).replace(/\.?0+$/, "")}k` : String(g));

/**
 * The First Week offer, big and plain: what 7 days pays ($ and ₦), what each
 * day adds, and what a miss costs. Shown on the invite link (before sign-up)
 * and at the top of Home for new and invited players. Renders nothing until
 * the First Week Bingo is live — the numbers come from its real config.
 */
export function FirstWeekOffer({
  variant,
  invitedBy,
  href,
  className,
}: {
  variant: "invite" | "home";
  /** Referrer's username on the invite link. */
  invitedBy?: string | null;
  /** Where the button goes (Home: the Bingo; invite: nowhere — sign-in is below). */
  href?: string;
  className?: string;
}) {
  const facts = useEarnFacts();
  const fw = facts?.firstWeek;
  if (!fw) return null;

  const daily = fw.perPhoto;
  const finish = Math.max(0, fw.entry.g - daily * 7);
  return (
    <div className={cn("rounded-[22px] border-2 border-ink bg-yellow-soft p-4 shadow-[0_4px_0_#000]", className)}>
      {invitedBy ? <p className="label-mono m-0 text-[10px] text-muted-foreground">@{invitedBy} invited you</p> : null}
      <p className="m-0 mt-1 text-[13px] font-bold">{variant === "invite" ? "Your first 7 days on Delulu pay" : "Your first week pays"}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-[40px] font-extrabold leading-none">{fmtUsd(fw.entry.usd)}</span>
        <span className="text-[18px] font-extrabold text-green-edge">≈ {fmtNgn(fw.entry.ngn)}</span>
      </div>

      {/* Day by day: each kept day pays, the finish pays the most. */}
      <div className="mt-3 grid grid-cols-8 gap-1" aria-label="What each day pays">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex flex-col items-center rounded-lg bg-white py-1.5">
            <span className="text-[9px] font-bold text-muted-foreground">D{i + 1}</span>
            <span className="text-[11px] font-extrabold">+{k(daily)}</span>
          </div>
        ))}
        <div className="flex flex-col items-center rounded-lg bg-green py-1.5">
          <span className="text-[9px] font-bold">🏁</span>
          <span className="text-[11px] font-extrabold">+{k(finish)}</span>
        </div>
      </div>
      <p className="m-0 mt-2 text-[11px] font-semibold text-muted-foreground">
        G$ · one photo a day · new players · paid as you go
      </p>
      <p className="m-0 mt-1 text-[11px] font-semibold text-orange">
        Miss a day: the card ends and you lose your stake — you keep everything you&apos;ve earned and can start again.
      </p>

      {href ? (
        <Link
          href={href}
          className="press-edge mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink text-[14px] font-extrabold uppercase text-white no-underline shadow-[0_3px_0_#000]"
        >
          <Coin size={20} /> Start my first week <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
