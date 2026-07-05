"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";

export function HomeTop10Banner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#fdf6e3] px-3.5 py-3.5">
      {/* Ambient glow — same treatment as the feature carousel cards */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 110% 90% at 100% 0%, rgba(246,195,36,0.28) 0%, transparent 55%)",
            "radial-gradient(ellipse 90% 70% at 0% 100%, rgba(234,88,12,0.12) 0%, transparent 60%)",
          ].join(", "),
        }}
      />

      <div className="relative flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
          <Trophy className="h-4 w-4 text-amber-600" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-600"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Top 10 challenge
          </p>
          <p
            className="mt-0.5 text-base font-black leading-[1.15] tracking-tight text-foreground"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            Top 10 share $100
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Join a campaign, earn up to 30,000 points, and climb the leaderboard for your shot at the pool.
          </p>

          <Link
            href="/explore?tab=campaigns"
            className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-delulu-blue px-3 py-1.5 text-[11px] font-black text-white transition-transform active:scale-[0.97]"
          >
            Join a campaign →
          </Link>
        </div>
      </div>
    </div>
  );
}
