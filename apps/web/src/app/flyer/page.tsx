"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Star, Target, Zap } from "lucide-react";

export default function FlyerPage() {
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date("2026-07-31").getTime() - Date.now()) / 86400000),
  );

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-20 text-center"
      style={{ background: "linear-gradient(160deg, #0d0d0b 0%, #070706 100%)" }}
    >
      {/* Dot grid texture */}
      <svg
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{ width: "100%", height: "100%" }}
        aria-hidden
      >
        <defs>
          <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="#f6c324" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>

      {/* Central radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 760,
          height: 760,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(246,195,36,0.13) 0%, rgba(246,195,36,0.04) 45%, transparent 70%)",
        }}
      />

      {/* Outer decorative ring + dashed inner ring */}
      <svg
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        width="640"
        height="640"
        viewBox="0 0 640 640"
        style={{ opacity: 0.07 }}
      >
        <circle cx="320" cy="320" r="290" stroke="#f6c324" strokeWidth="1.5" fill="none" />
        <circle
          cx="320"
          cy="320"
          r="318"
          stroke="#f6c324"
          strokeWidth="0.75"
          fill="none"
          strokeDasharray="3 12"
        />
      </svg>

      {/* ── Corner chrome ── */}
      <div
        className="absolute left-5 top-5 text-base font-black tracking-tight"
        style={{ fontFamily: '"Clash Display", sans-serif', color: "#f6c324" }}
      >
        delulu.
      </div>

      <div
        className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full border px-3 py-1"
        style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}
      >
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ background: "#4ade80" }}
        />
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Live now
        </span>
      </div>

      {/* Scattered accent stars */}
      <Star
        aria-hidden
        className="absolute h-3 w-3"
        style={{
          left: "11%",
          top: "17%",
          fill: "rgba(246,195,36,0.28)",
          color: "rgba(246,195,36,0.28)",
        }}
      />
      <Star
        aria-hidden
        className="absolute h-2 w-2"
        style={{
          right: "13%",
          top: "21%",
          fill: "rgba(246,195,36,0.18)",
          color: "rgba(246,195,36,0.18)",
        }}
      />
      <Star
        aria-hidden
        className="absolute h-2 w-2"
        style={{
          left: "19%",
          bottom: "24%",
          fill: "rgba(246,195,36,0.18)",
          color: "rgba(246,195,36,0.18)",
        }}
      />
      <Star
        aria-hidden
        className="absolute h-3 w-3"
        style={{
          right: "17%",
          bottom: "28%",
          fill: "rgba(246,195,36,0.22)",
          color: "rgba(246,195,36,0.22)",
        }}
      />

      {/* ── Main flyer content ── */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">

        {/* Overline */}
        <div className="mb-1 flex items-center gap-2.5">
          <div className="h-px w-8" style={{ background: "rgba(246,195,36,0.3)" }} />
          <span
            className="text-[10px] font-black uppercase tracking-[0.35em]"
            style={{ color: "rgba(246,195,36,0.55)" }}
          >
            Campaign reward
          </span>
          <div className="h-px w-8" style={{ background: "rgba(246,195,36,0.3)" }} />
        </div>

        {/* EARN label */}
        <p
          className="text-sm font-semibold uppercase tracking-[0.3em]"
          style={{ fontFamily: '"Clash Display", sans-serif', color: "rgba(255,255,255,0.3)" }}
        >
          Earn
        </p>

        {/* $$$ — the hero */}
        <p
          className="font-black leading-[0.88]"
          style={{
            fontFamily: '"Clash Display", sans-serif',
            fontSize: "clamp(100px, 24vw, 152px)",
            color: "#f6c324",
            textShadow:
              "0 0 60px rgba(246,195,36,0.45), 0 0 120px rgba(246,195,36,0.2), 0 0 240px rgba(246,195,36,0.1)",
          }}
        >
          $10
        </p>

        {/* Pool line */}
        <p
          className="mt-3.5 text-base font-semibold"
          style={{ color: "rgba(255,255,255,0.42)" }}
        >
          from a prize pool of{" "}
          <span className="font-black text-white">$100</span>
        </p>

        {/* ── Divider ── */}
        <div className="my-7 flex items-center gap-3">
          <div className="h-px w-14" style={{ background: "rgba(255,255,255,0.07)" }} />
          <Zap
            className="h-3.5 w-3.5"
            style={{ fill: "rgba(246,195,36,0.35)", color: "rgba(246,195,36,0.35)" }}
          />
          <div className="h-px w-14" style={{ background: "rgba(255,255,255,0.07)" }} />
        </div>

        {/* Points qualification card */}
        <div
          className="w-full rounded-2xl px-6 py-5"
          style={{
            border: "1px solid rgba(246,195,36,0.18)",
            background: "rgba(246,195,36,0.06)",
            boxShadow: "0 0 40px rgba(246,195,36,0.05) inset",
          }}
        >
          <p
            className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.3em]"
            style={{ color: "rgba(246,195,36,0.6)" }}
          >
            <Target className="h-3 w-3" />
            To qualify
          </p>
          <p
            className="mt-2 font-black text-white"
            style={{
              fontFamily: '"Clash Display", sans-serif',
              fontSize: "clamp(36px, 10vw, 52px)",
            }}
          >
            10,000 pts
          </p>
          <p className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            Submit daily proof milestones to earn
          </p>
        </div>

        {/* End date pill */}
        <div
          className="mt-5 flex items-center gap-2 rounded-full px-4 py-2"
          style={{
            border: "1px solid rgba(255,255,255,0.09)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <Calendar className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.35)" }} />
          <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
            Ends{" "}
            <span className="font-black text-white">July 31, 2026</span>
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-black"
            style={{ background: "rgba(246,195,36,0.15)", color: "#f6c324" }}
          >
            {daysLeft}d left
          </span>
        </div>

        {/* ── CTA ── */}
        <Link
          href="/explore?tab=campaigns"
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-black"
          style={{
            background: "#f6c324",
            color: "#0a0a09",
            fontFamily: "var(--font-manrope)",
            boxShadow:
              "0 0 40px rgba(246,195,36,0.35), 0 4px 32px rgba(0,0,0,0.5)",
          }}
        >
          Join the campaign
          <ArrowRight className="h-4 w-4" />
        </Link>

        {/* Tagline */}
        <p
          className="mt-8 text-[10px] font-semibold uppercase tracking-[0.3em]"
          style={{ color: "rgba(255,255,255,0.18)" }}
        >
          stay delusional. stay accountable.
        </p>
      </div>
    </div>
  );
}
