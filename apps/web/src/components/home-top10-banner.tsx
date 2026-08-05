"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import {
  FORFEIT_CAMPAIGN_END_UNIX,
  FORFEIT_CAMPAIGN_MIN_STAKE_WHOLE,
  FORFEIT_CAMPAIGN_POOL_USD,
  FORFEIT_CAMPAIGN_TOP_N,
} from "@/lib/dashboard/campaign-constants";

const campaignEndsLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
}).format(new Date(FORFEIT_CAMPAIGN_END_UNIX * 1000));

export function HomeTop10Banner() {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-[#D1E822] px-3.5 py-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between ">
        <div className="relative flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#244E1A]/10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <Trophy className="h-4 w-4 text-[#244E1A]" strokeWidth={2} />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className="text-[8px] font-black uppercase tracking-[0.18em] text-[#244E1A]"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              Forfeit challenge
            </p>
            <p
              className="mt-0.5  font-black  text-base sm:text-xl leading-[1.15] tracking-tight text-[#244E1A]"
              style={{ fontFamily: '"Clash Display", sans-serif' }}
            >
              Top {FORFEIT_CAMPAIGN_TOP_N} share ${FORFEIT_CAMPAIGN_POOL_USD.toLocaleString()}
            </p>
            <p className="mt-1 text-xs sm:text-sm leading-snug text-[#244E1A]/80">
              Forfeit {FORFEIT_CAMPAIGN_MIN_STAKE_WHOLE.toLocaleString()}+ G$ to charity or
              Delulu, then climb the leaderboard for your shot at the pool.
            </p>
            <p className="mt-1 text-[10px] sm:text-xs font-bold leading-snug text-[#244E1A]/70">
              Ends {campaignEndsLabel} — top {FORFEIT_CAMPAIGN_TOP_N} share the pool.
            </p>
          </div>
        </div>

        <div className=" hidden sm:flex justify-end">
          <Link
            href="/forfeit"
            className="inline-flex items-center gap-1 rounded-full bg-[#244E1A] px-3 py-1.5 text-xs sm:text-sm font-black text-white transition-transform hover:scale-[1.04] active:scale-[0.97]"
          >
            Create a forfeit →
          </Link>
        </div>
      </div>

      <div className=" sm:hidden flex justify-end mt-2">
        <Link
          href="/forfeit"
          className="inline-flex items-center gap-1 rounded-full bg-[#244E1A] px-3 py-1.5 text-xs sm:text-sm font-black text-white transition-transform hover:scale-[1.04] active:scale-[0.97]"
        >
          Create a forfeit →
        </Link>
      </div>
    </div>
  );
}
