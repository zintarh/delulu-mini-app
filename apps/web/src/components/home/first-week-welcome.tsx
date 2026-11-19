"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { FirstWeekOffer } from "@/components/first-week-offer";
import { Coin } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { useBingoList } from "@/hooks/use-bingo";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { FIRST_WEEK_SLUG } from "@/lib/bingo/first-week";

const SNOOZE_MS = 24 * 60 * 60 * 1000;
const key = (wallet: string) => `delulu:first-week-welcome:${wallet.toLowerCase()}`;

/**
 * A new (or invited) player's first look at Home: a pop-up that says plainly
 * which Bingo carries the welcome bonus and what it pays — instead of making
 * them find it among everything else. Shows while First Week is open to them
 * and they haven't started it; "Not now" hides it for a day.
 */
export function FirstWeekWelcome() {
  const { address } = useAuth();
  const { bingos } = useBingoList();
  const facts = useEarnFacts();
  const [open, setOpen] = useState(false);

  // Listed only for eligible players; joinable = not running one, not finished it.
  const firstWeek = bingos?.find((b) => b.slug === FIRST_WEEK_SLUG);
  const offer = !!address && !!firstWeek?.joinable && !!facts?.firstWeek;

  useEffect(() => {
    if (!offer || !address) return;
    let snoozedUntil = 0;
    try {
      snoozedUntil = Number(localStorage.getItem(key(address)) ?? 0);
    } catch {
      /* private mode: show it */
    }
    if (Date.now() >= snoozedUntil) setOpen(true);
  }, [offer, address]);

  const snooze = () => {
    setOpen(false);
    if (!address) return;
    try {
      localStorage.setItem(key(address), String(Date.now() + SNOOZE_MS));
    } catch {
      /* fine */
    }
  };

  if (!offer) return null;
  return (
    <ResponsiveSheet open={open} onOpenChange={(o) => (o ? setOpen(true) : snooze())} title="Your welcome bonus" hideTitleVisually sheetClassName="rounded-t-3xl pb-10" modalClassName="max-w-md">
      <div className="flex flex-col gap-3 px-4 pb-2 pt-1">
        <p className="m-0 flex items-center gap-2 font-display text-[24px] font-extrabold uppercase leading-none">
          <Coin size={28} /> Welcome bonus
        </p>
        <p className="m-0 text-[14px] font-semibold leading-snug text-muted-foreground">
          Start <b className="text-ink">{firstWeek!.title}</b> — it&apos;s the one with your welcome bonus. Show up every day for 7 days.
        </p>
        <FirstWeekOffer variant="home" />
        <Link
          href={`/bingo/${FIRST_WEEK_SLUG}`}
          onClick={() => setOpen(false)}
          className="press-edge flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink text-[14px] font-extrabold uppercase text-white no-underline shadow-[0_3px_0_#000]"
        >
          Start my first week <ArrowRight className="h-4 w-4" />
        </Link>
        <button type="button" onClick={snooze} className="h-10 text-[13px] font-bold text-muted-foreground">
          Not now
        </button>
      </div>
    </ResponsiveSheet>
  );
}
