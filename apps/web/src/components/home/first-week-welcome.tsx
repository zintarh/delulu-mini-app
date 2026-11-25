"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Coin } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { useUserTotalPoints } from "@/hooks/graph/useUserPoints";

const SNOOZE_MS = 24 * 60 * 60 * 1000;
const key = (wallet: string) => `delulu:first-week-welcome:${wallet.toLowerCase()}`;

/**
 * Home popup for a player who has never earned a point. The button opens the
 * four 100 G$ cards. "Not now" hides it for a day.
 */
export function FirstWeekWelcome() {
  const router = useRouter();
  const { address } = useAuth();
  const { points, isLoading } = useUserTotalPoints(address);
  const [open, setOpen] = useState(false);

  // Only players who have never earned a point. The four cards are their way in.
  const offer = !!address && !isLoading && points === 0;

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
          Pick one of the four cards. Claim today&apos;s G$ and stake 100 G$ for 7 days.
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            router.push("/play");
          }}
          className="press-edge flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink text-[14px] font-extrabold uppercase text-white shadow-[0_3px_0_#000]"
        >
          Start my first week <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={snooze} className="h-10 text-[13px] font-bold text-muted-foreground">
          Not now
        </button>
      </div>
    </ResponsiveSheet>
  );
}
