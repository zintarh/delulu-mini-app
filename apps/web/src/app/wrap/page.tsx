"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useUserWrapStats, type WrapPeriod } from "@/hooks/graph/useUserWeeklyWrap";
import { cn } from "@/lib/utils";
import { ArrowLeft, Share2, ChevronRight, Sparkles, Zap, Target } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WrapAnalysis {
  punchline: string;
  vibe: string;
  rating: string;
  insight: string;
  encouragement: string;
  tone: "roast" | "mixed" | "applaud";
}

// ── Slide configs — vivid Spotify Wrapped-style color blocking ────────────────

const SLIDE_BG: Record<number, string> = {
  0: "#0d0011",   // Intro      — near-black purple
  1: "#881337",   // Delulus    — deep crimson
  2: "#14532d",   // Milestones — forest green
  3: "#1e1b4b",   // Rate       — deep indigo
  4: "#0d0011",   // Tone       — overridden by tone
  5: "#78350f",   // Archetype  — amber/burnt
  6: "#0c1445",   // Insight    — ocean navy
  7: "#0d0011",   // CTA        — back to dark
};

const TONE_BG: Record<string, string> = {
  roast:   "#7f1d1d",
  mixed:   "#3b0764",
  applaud: "#064e3b",
};

const TONE_ACCENT: Record<string, string> = {
  roast:   "#fca5a5",
  mixed:   "#d8b4fe",
  applaud: "#6ee7b7",
};

const TOTAL_SLIDES = 8;

// ── Count-up ──────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 700) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const steps = 28;
    const inc = target / steps;
    const delay = duration / steps;
    let cur = 0;
    const t = setInterval(() => {
      cur = Math.min(cur + inc, target);
      setVal(Math.round(cur));
      if (cur >= target) clearInterval(t);
    }, delay);
    return () => clearInterval(t);
  }, [target, duration]);
  return val;
}

// ── Story progress bar ────────────────────────────────────────────────────────

function StoryBar({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5 px-4 w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="flex-1 rounded-full transition-all duration-200"
          style={{
            height: "3px",
            background: i <= current ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)",
          }}
        />
      ))}
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ pct }: { pct: number }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setProgress(pct), 200);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div className="relative w-52 h-52 flex items-center justify-center">
      <svg width="208" height="208" className="-rotate-90">
        <circle cx="104" cy="104" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14" />
        <circle
          cx="104" cy="104" r={r} fill="none"
          stroke="white" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${(progress / 100) * circ} ${circ}`}
          style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="wrap-thump text-white leading-none"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(56px, 14vw, 80px)" }}
        >
          {progress}%
        </span>
        <span className="text-white/40 text-xs mt-1" style={{ fontFamily: "var(--font-manrope)" }}>
          completion
        </span>
      </div>
    </div>
  );
}

// ── Period Selector ───────────────────────────────────────────────────────────

function PeriodSelector({ onSelect }: { onSelect: (p: WrapPeriod) => void }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{ background: "#0d0011" }}>

      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full blur-[120px] pointer-events-none"
        style={{ background: "rgba(252,255,82,0.07)" }} />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full blur-[100px] pointer-events-none"
        style={{ background: "rgba(136,19,55,0.12)" }} />

      <div className="relative z-10 w-full max-w-sm text-center mb-10">
        <p className="text-xs tracking-[0.45em] uppercase mb-5"
          style={{ fontFamily: "var(--font-manrope)", color: "rgba(252,255,82,0.5)" }}>
          ✦ Delulu ✦
        </p>
        <h1
          className="text-white leading-[0.9] mb-3"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(64px, 18vw, 96px)" }}
        >
          YOUR<br />
          <span style={{ color: "#fcff52" }}>DREAM</span><br />
          WRAPPED
        </h1>
        <p className="text-sm text-white/35 mt-4" style={{ fontFamily: "var(--font-manrope)" }}>
          Pick the period you want to see
        </p>
      </div>

      <div className="relative z-10 flex flex-col gap-3 w-full max-w-sm">
        {/* This Week */}
        <button
          type="button"
          onClick={() => onSelect("week")}
          className="group flex items-center justify-between px-6 py-5 rounded-2xl border transition-all active:scale-[0.98]"
          style={{
            background: "rgba(136,19,55,0.2)",
            borderColor: "rgba(136,19,55,0.5)",
          }}
        >
          <div className="text-left">
            <p className="text-xs uppercase tracking-widest mb-1"
              style={{ fontFamily: "var(--font-manrope)", color: "rgba(252,165,165,0.7)" }}>
              This Week
            </p>
            <p
              className="text-white"
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "32px", letterSpacing: "0.03em" }}
            >
              LAST 7 DAYS
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/70 transition-colors" />
        </button>

        {/* This Month */}
        <button
          type="button"
          onClick={() => onSelect("month")}
          className="group flex items-center justify-between px-6 py-5 rounded-2xl border transition-all active:scale-[0.98]"
          style={{
            background: "rgba(252,255,82,0.06)",
            borderColor: "rgba(252,255,82,0.25)",
          }}
        >
          <div className="text-left">
            <p className="text-xs uppercase tracking-widest mb-1"
              style={{ fontFamily: "var(--font-manrope)", color: "rgba(252,255,82,0.6)" }}>
              This Month
            </p>
            <p
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "32px", letterSpacing: "0.03em", color: "#fcff52" }}
            >
              LAST 30 DAYS
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#fcff52]/30 group-hover:text-[#fcff52]/70 transition-colors" />
        </button>
      </div>
    </div>
  );
}

// ── Slide 0: Intro ────────────────────────────────────────────────────────────

function IntroSlide({ address, period }: { address?: string; period: WrapPeriod }) {
  const label = period === "week" ? "THIS WEEK" : "THIS MONTH";
  const display = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Dreamer";

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="absolute top-16 left-1/2 -translate-x-1/2 w-80 h-52 rounded-full blur-[100px] pointer-events-none"
        style={{ background: "rgba(252,255,82,0.07)" }} />

      <p className="wrap-rise wrap-rise-1 text-xs tracking-[0.4em] uppercase mb-6"
        style={{ fontFamily: "var(--font-manrope)", color: "rgba(252,255,82,0.5)" }}>
        ✦ Delulu ✦
      </p>

      <h1
        className="wrap-thump text-white leading-[0.88] text-center"
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(72px, 20vw, 110px)" }}
      >
        YOUR<br />
        <span style={{ color: "#fcff52" }}>{label}</span><br />
        WRAPPED
      </h1>

      <div className="wrap-rise wrap-rise-2 mt-8 px-4 py-2 rounded-full border"
        style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)" }}>
        <p className="text-sm text-white/50" style={{ fontFamily: "var(--font-manrope)" }}>
          {display}
        </p>
      </div>

      <p className="wrap-rise wrap-rise-3 text-xs mt-8 text-white/20 animate-pulse"
        style={{ fontFamily: "var(--font-manrope)" }}>
        tap to begin →
      </p>
    </div>
  );
}

// ── Slide 1: Delulus created ──────────────────────────────────────────────────

function DelulusSlide({ count, period }: { count: number; period: WrapPeriod }) {
  const displayed = useCountUp(count);
  const label = period === "week" ? "THIS WEEK" : "THIS MONTH";

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="absolute bottom-24 right-8 w-48 h-48 rounded-full blur-[80px] pointer-events-none"
        style={{ background: "rgba(255,255,255,0.04)" }} />

      <p className="wrap-rise wrap-rise-1 text-xs tracking-[0.45em] uppercase text-white/40 mb-4"
        style={{ fontFamily: "var(--font-manrope)" }}>
        {label} YOU STARTED
      </p>

      <span
        className="wrap-thump text-white leading-none tabular-nums"
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(130px, 34vw, 220px)" }}
      >
        {displayed}
      </span>

      <p className="wrap-rise wrap-rise-2 text-white/70 mt-1"
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(28px, 7vw, 44px)", letterSpacing: "0.06em" }}>
        {count === 1 ? "DELULU" : "DELULUS"}
      </p>

      <p className="wrap-rise wrap-rise-3 text-white/30 text-sm mt-5 max-w-xs"
        style={{ fontFamily: "var(--font-manrope)" }}>
        {count === 0
          ? "Zero. Every legend has to start somewhere."
          : count === 1
          ? "One dream is one more than most people put on-chain."
          : `${count} bets on yourself. That takes conviction.`}
      </p>
    </div>
  );
}

// ── Slide 2: Milestones ───────────────────────────────────────────────────────

function MilestonesSlide({
  achieved, total, titles,
}: {
  achieved: number; total: number; titles: string[];
}) {
  const displayed = useCountUp(achieved);

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="absolute top-20 left-8 w-40 h-40 rounded-full blur-[70px] pointer-events-none"
        style={{ background: "rgba(255,255,255,0.04)" }} />

      <p className="wrap-rise wrap-rise-1 text-xs tracking-[0.45em] uppercase text-white/40 mb-4"
        style={{ fontFamily: "var(--font-manrope)" }}>
        YOU VERIFIED
      </p>

      <span
        className="wrap-thump text-white leading-none tabular-nums"
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(130px, 34vw, 220px)" }}
      >
        {displayed}
      </span>

      <p className="wrap-rise wrap-rise-2 text-white/70 mt-1"
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(28px, 7vw, 44px)", letterSpacing: "0.06em" }}>
        {achieved === 1 ? "MILESTONE" : "MILESTONES"}
      </p>

      {total > 0 && (
        <p className="wrap-rise wrap-rise-3 text-white/35 text-sm mt-2"
          style={{ fontFamily: "var(--font-manrope)" }}>
          out of {total} total
        </p>
      )}

      {titles.length > 0 && (
        <div className="wrap-rise wrap-rise-4 mt-6 space-y-2 w-full max-w-xs">
          {titles.slice(0, 3).map((t, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl text-left"
              style={{ background: "rgba(255,255,255,0.07)" }}>
              <Target className="w-3 h-3 shrink-0 text-white/40" />
              <p className="text-xs text-white/50 truncate" style={{ fontFamily: "var(--font-manrope)" }}>{t}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Slide 3: Completion rate ──────────────────────────────────────────────────

function RateSlide({ rate, achieved, total }: { rate: number; achieved: number; total: number }) {
  const judgement =
    total === 0 ? "Create your first delulu to start tracking." :
    rate === 100 ? "Perfect. Every single one. That's unprecedented." :
    rate >= 70 ? "Consistently showing up. Your believers are winning." :
    rate >= 40 ? "Halfway there. The gap between promise and proof is closing." :
    rate > 0 ? "Started strong, faded on follow-through. You know it." :
    "Zero verified milestones. The dreams were real. The proof wasn't.";

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <p className="wrap-rise wrap-rise-1 text-xs tracking-[0.45em] uppercase text-white/40 mb-8"
        style={{ fontFamily: "var(--font-manrope)" }}>
        COMPLETION RATE
      </p>

      <div className="wrap-thump">
        <DonutChart pct={rate} />
      </div>

      <p className="wrap-rise wrap-rise-2 text-white/40 text-sm mt-6 max-w-xs leading-relaxed"
        style={{ fontFamily: "var(--font-manrope)" }}>
        {judgement}
      </p>

      {total > 0 && (
        <p className="wrap-rise wrap-rise-3 text-white/20 text-xs mt-3 tabular-nums"
          style={{ fontFamily: "var(--font-manrope)" }}>
          {achieved} / {total} milestones verified
        </p>
      )}
    </div>
  );
}

// ── Slide 4: Tone — the roast or applaud moment ───────────────────────────────

function ToneSlide({
  tone, punchline, vibe,
  onConfetti,
}: {
  tone: WrapAnalysis["tone"];
  punchline: string;
  vibe: string;
  onConfetti: () => void;
}) {
  const isRoast = tone === "roast";
  const accent = TONE_ACCENT[tone] ?? "#ffffff";
  const emoji = isRoast ? "🔥" : tone === "applaud" ? "🏆" : "⚡";
  const label = isRoast ? "ROAST" : tone === "applaud" ? "APPLAUD" : "MIXED";

  useEffect(() => {
    if (tone === "applaud") {
      const t = setTimeout(onConfetti, 400);
      return () => clearTimeout(t);
    }
  }, [tone, onConfetti]);

  return (
    <div className="flex flex-col justify-center h-full px-7">
      <div className="absolute top-12 right-8 w-48 h-48 rounded-full blur-[80px] pointer-events-none"
        style={{ background: `${accent}18` }} />

      <p
        className="wrap-rise wrap-rise-1 text-xs tracking-[0.45em] uppercase mb-8"
        style={{ fontFamily: "var(--font-manrope)", color: `${accent}80` }}
      >
        {emoji} THE VERDICT: {label}
      </p>

      <p
        className="wrap-thump text-white leading-[1.05]"
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(44px, 11vw, 72px)", letterSpacing: "0.02em" }}
      >
        {punchline || (isRoast
          ? "You dreamed it. You didn't build it."
          : "You actually did the thing.")}
      </p>

      <div
        className="wrap-rise wrap-rise-2 mt-8 px-4 py-2.5 rounded-full self-start border"
        style={{ background: `${accent}15`, borderColor: `${accent}30` }}
      >
        <p
          className="text-sm font-semibold"
          style={{ fontFamily: "var(--font-manrope)", color: accent }}
        >
          VIBE: {vibe || "Building"}
        </p>
      </div>
    </div>
  );
}

// ── Slide 5: Archetype ────────────────────────────────────────────────────────

function ArchetypeSlide({ rating, insight }: { rating: string; insight: string }) {
  return (
    <div className="flex flex-col justify-center h-full px-7">
      <div className="absolute bottom-20 left-6 w-52 h-52 rounded-full blur-[90px] pointer-events-none"
        style={{ background: "rgba(255,255,255,0.04)" }} />

      <p className="wrap-rise wrap-rise-1 text-xs tracking-[0.45em] uppercase text-white/40 mb-5"
        style={{ fontFamily: "var(--font-manrope)" }}>
        YOUR DREAMER TYPE
      </p>

      <h2
        className="wrap-thump text-white leading-[0.92]"
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(64px, 17vw, 96px)", letterSpacing: "0.03em" }}
      >
        {rating || "DREAM ARCHITECT"}
      </h2>

      <div className="wrap-rise wrap-rise-2 w-10 h-0.5 my-5 rounded-full"
        style={{ background: "#fcff52" }} />

      <p
        className="wrap-rise wrap-rise-3 text-white/55 text-sm leading-relaxed max-w-xs"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        {insight || "You build dreams in public and back them with real stakes."}
      </p>
    </div>
  );
}

// ── Slide 6: Encouragement ────────────────────────────────────────────────────

function InsightSlide({
  encouragement, delulusCount, milestonesAchieved, completionRate, period,
}: {
  encouragement: string;
  delulusCount: number;
  milestonesAchieved: number;
  completionRate: number;
  period: WrapPeriod;
}) {
  const periodLabel = period === "week" ? "this week" : "this month";
  return (
    <div className="flex flex-col justify-center h-full px-7">
      <div className="absolute top-20 right-6 w-40 h-40 rounded-full blur-[80px] pointer-events-none"
        style={{ background: "rgba(252,255,82,0.06)" }} />

      <Sparkles className="wrap-rise wrap-rise-1 w-8 h-8 mb-6" style={{ color: "#fcff52" }} />

      <p
        className="wrap-thump text-white leading-snug mb-6"
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px, 9vw, 52px)", letterSpacing: "0.02em" }}
      >
        {encouragement || "Make next period count."}
      </p>

      <div className="wrap-rise wrap-rise-2 grid grid-cols-3 gap-3 mt-2">
        {[
          { v: delulusCount, l: "CREATED" },
          { v: milestonesAchieved, l: "VERIFIED" },
          { v: `${completionRate}%`, l: "RATE" },
        ].map(({ v, l }) => (
          <div key={l} className="rounded-xl p-3 text-center"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <p
              className="text-white leading-none"
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "28px" }}
            >
              {v}
            </p>
            <p className="text-white/30 text-[9px] tracking-widest mt-1 uppercase"
              style={{ fontFamily: "var(--font-manrope)" }}>
              {l}
            </p>
          </div>
        ))}
      </div>

      <p className="wrap-rise wrap-rise-3 text-white/20 text-xs mt-4"
        style={{ fontFamily: "var(--font-manrope)" }}>
        {periodLabel}
      </p>
    </div>
  );
}

// ── Slide 7: CTA ──────────────────────────────────────────────────────────────

function CtaSlide({
  period, onShare, shared, onChangePeriod,
}: {
  period: WrapPeriod;
  onShare: () => void;
  shared: boolean;
  onChangePeriod: () => void;
}) {
  const nextLabel = period === "week" ? "next week" : "next month";

  return (
    <div className="flex flex-col items-center justify-center h-full px-7 text-center">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-56 rounded-full blur-[100px] pointer-events-none"
        style={{ background: "rgba(53,208,127,0.07)" }} />

      <p className="wrap-rise wrap-rise-1 text-xs tracking-[0.45em] uppercase text-white/30 mb-6"
        style={{ fontFamily: "var(--font-manrope)" }}>
        That&apos;s a wrap
      </p>

      <h2
        className="wrap-thump text-white leading-[0.92] mb-2"
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(52px, 13vw, 76px)" }}
      >
        SEE YOU<br />
        <span style={{ color: "#35d07f" }}>{nextLabel.toUpperCase()},</span><br />
        DREAMER.
      </h2>

      <p className="wrap-rise wrap-rise-2 text-white/25 text-sm mt-4 mb-10 max-w-xs"
        style={{ fontFamily: "var(--font-manrope)" }}>
        Keep stacking milestones. The pool grows with every believer.
      </p>

      <div className="wrap-rise wrap-rise-3 flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm transition-all active:scale-95"
          style={{ background: "#fcff52", color: "#111111", fontFamily: "var(--font-manrope)" }}
        >
          <Share2 className="w-4 h-4" />
          {shared ? "Copied to clipboard!" : "Share your Wrap"}
        </button>

        <Link
          href="/board"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontFamily: "var(--font-manrope)" }}
        >
          Create a new Delulu →
        </Link>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChangePeriod(); }}
          className="text-white/25 text-sm hover:text-white/50 transition-colors py-2"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Switch period ↺
        </button>
      </div>
    </div>
  );
}

// ── Loading overlay ───────────────────────────────────────────────────────────

function Loader({ label = "Loading your wrap…" }: { label?: string }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4"
      style={{ background: "#0d0011" }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: "rgba(252,255,82,0.2)", borderTopColor: "#fcff52" }} />
      <p className="text-sm text-white/30" style={{ fontFamily: "var(--font-manrope)" }}>{label}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WrapPage() {
  const { address, authenticated } = useAuth();
  const router = useRouter();

  const [period, setPeriod] = useState<WrapPeriod | null>(null);
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [wrap, setWrap] = useState<WrapAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [shared, setShared] = useState(false);
  const hasFetchedAi = useRef(false);

  const stats = useUserWrapStats(period);

  // Auth guard
  useEffect(() => {
    if (!authenticated) router.replace("/sign-in");
  }, [authenticated, router]);

  // Fetch AI when data ready
  useEffect(() => {
    if (!period || hasFetchedAi.current || stats.isLoading || !address) return;
    hasFetchedAi.current = true;
    setIsAiLoading(true);

    fetch("/api/ai/wrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delulusCount: stats.delulusCount,
        resolvedCount: stats.resolvedCount,
        milestonesAchieved: stats.milestonesAchieved,
        totalMilestones: stats.totalMilestones,
        completionRate: stats.completionRate,
        deluluTitles: stats.deluluTitles,
        totalPointsEarned: stats.totalPointsEarned,
        period: period === "week" ? "this week" : "this month",
      }),
    })
      .then((r) => r.json())
      .then((data) => { if (data.wrap) setWrap(data.wrap); })
      .catch(() => null)
      .finally(() => setIsAiLoading(false));
  }, [period, stats.isLoading, address]);

  const handlePeriodSelect = useCallback((p: WrapPeriod) => {
    hasFetchedAi.current = false;
    setWrap(null);
    setSlide(0);
    setDirection("forward");
    setPeriod(p);
  }, []);

  const advance = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDirection("forward");
    setSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1));
  }, []);

  const retreat = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDirection("back");
    setSlide((s) => Math.max(s - 1, 0));
  }, []);

  const fireConfetti = useCallback(async () => {
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ["#fcff52", "#35d07f", "#ffffff"] });
    } catch {}
  }, []);

  const handleShare = useCallback(async () => {
    const text = `My Delulu ${period === "week" ? "Week" : "Month"} Wrapped:\n🎯 ${stats.delulusCount} delulus created\n✅ ${stats.milestonesAchieved}/${stats.totalMilestones} milestones verified\n📈 ${stats.completionRate}% completion rate\n\nManifesting on Delulu.`;
    try {
      if (navigator.share) {
        await navigator.share({ text, title: "My Delulu Wrap" });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 3000);
      }
    } catch {}
  }, [period, stats]);

  // ── Early returns
  if (!authenticated) return <Loader />;
  if (!period) return <PeriodSelector onSelect={handlePeriodSelect} />;
  if (stats.isLoading || isAiLoading) return <Loader label={isAiLoading ? "Analyzing your dreams…" : "Loading your wrap…"} />;

  const slideBg =
    slide === 4
      ? TONE_BG[wrap?.tone ?? "mixed"] ?? "#3b0764"
      : SLIDE_BG[slide] ?? "#0d0011";

  const enterClass = direction === "forward" ? "wrap-enter-right" : "wrap-enter-left";

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: slideBg, transition: "background 0.4s ease" }}>
      {/* Slide container — key forces re-mount → re-animation */}
      <div
        key={`${slide}-${direction}`}
        className={cn("absolute inset-0 flex flex-col", enterClass)}
      >
        {/* Story bar + back */}
        <div className="relative z-20 flex flex-col pt-safe-top pt-4 pb-2 px-0">
          <div className="flex items-center gap-3 px-4 mb-3">
            {slide === 0 ? (
              <Link href="/profile" className="flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs" style={{ fontFamily: "var(--font-manrope)" }}>Profile</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => retreat()}
                className="flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs" style={{ fontFamily: "var(--font-manrope)" }}>Back</span>
              </button>
            )}
            <div className="flex-1">
              <StoryBar total={TOTAL_SLIDES} current={slide} />
            </div>
            <span className="text-[11px] text-white/20 tabular-nums w-8 text-right"
              style={{ fontFamily: "var(--font-manrope)" }}>
              {slide + 1}/{TOTAL_SLIDES}
            </span>
          </div>
        </div>

        {/* Slide content */}
        <div className="relative flex-1 max-w-lg mx-auto w-full">
          {slide === 0 && <IntroSlide address={address} period={period} />}
          {slide === 1 && <DelulusSlide count={stats.delulusCount} period={period} />}
          {slide === 2 && <MilestonesSlide achieved={stats.milestonesAchieved} total={stats.totalMilestones} titles={stats.deluluTitles} />}
          {slide === 3 && <RateSlide rate={stats.completionRate} achieved={stats.milestonesAchieved} total={stats.totalMilestones} />}
          {slide === 4 && (
            <ToneSlide
              tone={wrap?.tone ?? "mixed"}
              punchline={wrap?.punchline ?? (isAiLoading ? "Analyzing…" : "Another period in the books.")}
              vibe={wrap?.vibe ?? "Building"}
              onConfetti={fireConfetti}
            />
          )}
          {slide === 5 && <ArchetypeSlide rating={wrap?.rating ?? "Dreamer"} insight={wrap?.insight ?? ""} />}
          {slide === 6 && (
            <InsightSlide
              encouragement={wrap?.encouragement ?? "Make next period count."}
              delulusCount={stats.delulusCount}
              milestonesAchieved={stats.milestonesAchieved}
              completionRate={stats.completionRate}
              period={period}
            />
          )}
          {slide === 7 && (
            <CtaSlide
              period={period}
              onShare={handleShare}
              shared={shared}
              onChangePeriod={() => { setPeriod(null); setSlide(0); }}
            />
          )}
        </div>

        {/* Tap zones: left half = back, right half = forward */}
        {slide < TOTAL_SLIDES - 1 && (
          <div className="absolute inset-0 z-10 flex" style={{ top: "80px" }}>
            <div className="flex-1" onClick={retreat} style={{ cursor: "pointer" }} />
            <div className="flex-1" onClick={advance} style={{ cursor: "pointer" }} />
          </div>
        )}

        {/* Hint on first slide only */}
        {slide === 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <Zap className="w-4 h-4 text-white/15 mx-auto animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
