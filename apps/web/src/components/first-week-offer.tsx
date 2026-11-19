"use client";

import Link from "next/link";
import { ArrowRight, Gift } from "lucide-react";
import { Coin, Lulu } from "@/components/ds";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { fmtNgn, fmtUsd } from "@/lib/earn/format";
import { cn } from "@/lib/utils";

/** 500 → "500", 3,250 → "3.25k", 8,000 → "8k" — G$ only; naira is always written in full. */
const k = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(2).replace(/\.?0+$/, "")}k` : String(g));

/**
 * The First Week offer — the welcome card. Dark, glowing, one big number
 * (what 7 days pays, $ and ₦), the week as a little road of coins to the
 * finish, one button. Shown on the invite / sign-in page, as Home's next step
 * for new and invited players, and on the First Week Bingo page. Renders
 * nothing until the First Week Bingo is live — the numbers are its real config.
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
    <div
      className={cn(
        "relative overflow-hidden rounded-[26px] border-2 border-ink bg-ink p-4 text-white shadow-[0_5px_0_#000]",
        className,
      )}
    >
      {/* Glow */}
      <span className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-yellow/35 blur-3xl" aria-hidden />
      <span className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-green/30 blur-3xl" aria-hidden />
      <span className="pointer-events-none absolute right-2 top-2 animate-bob" aria-hidden>
        <Lulu size={64} mood="kept" />
      </span>

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-ink">
          <Gift className="h-3.5 w-3.5" strokeWidth={2.6} />
          {invitedBy ? `@${invitedBy} invited you` : "Welcome week"}
        </span>
        <p className="m-0 mt-3 text-[13px] font-bold text-white/70">{variant === "invite" ? "Your first 7 days pay" : "Your first week pays"}</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-[44px] font-extrabold leading-none text-yellow [text-shadow:0_0_24px_rgba(255,214,0,0.35)]">
            {fmtNgn(fw.entry.ngn)}
          </span>
          <span className="text-[15px] font-extrabold text-white/80">≈ {fmtUsd(fw.entry.usd)}</span>
        </div>

        {/* The week: a coin a day, the big one at the finish. */}
        <ol className="m-0 mt-4 flex list-none items-end gap-1 p-0" aria-label="What each day pays">
          {Array.from({ length: 7 }, (_, i) => (
            <li key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                <Coin size={18} />
              </span>
              <span className="text-[10px] font-extrabold tabular-nums text-white/85">+{k(daily)}</span>
            </li>
          ))}
          <li className="flex flex-[1.4] flex-col items-center gap-1">
            <span className="flex h-9 w-9 animate-wiggle items-center justify-center rounded-full bg-green shadow-[0_0_16px_rgba(45,179,111,0.7)]">
              <span className="text-[16px]" aria-hidden>🏁</span>
            </span>
            <span className="text-[10px] font-extrabold tabular-nums text-green">+{k(finish)}</span>
          </li>
        </ol>

        <p className="m-0 mt-3 text-[11px] font-semibold text-white/60">One photo a day · paid as you go · miss a day, keep what you earned</p>

        {href ? (
          <Link
            href={href}
            className="press-edge mt-3.5 flex h-12 items-center justify-center gap-2 rounded-2xl bg-yellow text-[14px] font-extrabold uppercase text-ink no-underline shadow-[0_3px_0_#b38f00]"
          >
            Start my first week <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
