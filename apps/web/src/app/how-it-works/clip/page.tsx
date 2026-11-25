"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BingoBoard } from "@/components/bingo/bingo-board";
import { Lulu, Stamp, gameButtonClass } from "@/components/ds";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { fmtUsd } from "@/lib/earn/format";
import { ACTIVE_POT } from "@/lib/pool/tickets";
import type { BingoSquareView } from "@/lib/bingo/view";

const BEAT_MS = 5600;

const WORKOUT = [
  "Morning stretch",
  "A 20-minute walk or run",
  "30 squats",
  "Your workout selfie",
  "A healthy meal after you train",
  "Plank for 60 seconds",
  "Your post-workout glow",
];

function card(kept: number): BingoSquareView[] {
  return WORKOUT.map((title, index) => ({
    index,
    title,
    bonus: false,
    state: index < kept ? "filled" : "empty",
    photoUrl: null,
    filledAt: null,
  }));
}

/** Scales a scene so the whole thing stays inside the frame. */
function Fit({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const b = box.current;
    const n = inner.current;
    if (!b || !n) return;
    const measure = () => {
      const availH = b.clientHeight;
      const availW = b.clientWidth;
      const needH = n.offsetHeight;
      const needW = n.offsetWidth;
      if (!availH || !availW || !needH || !needW) return;
      setScale(Math.min(1, availH / needH, availW / needW));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(n);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="relative min-h-0 w-full flex-1 overflow-hidden">
      <div ref={inner} className="absolute left-1/2 top-1/2 w-[min(100%,380px)]" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

function Cursor() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden className="drop-shadow-[2px_3px_0_#161615]">
      <path d="M4 2.5 L4 18.5 L8.6 14.2 L12.4 21.2 L15.2 19.8 L11.3 12.8 L17.8 12.6 Z" fill="#fff" stroke="#161615" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function JoinScene() {
  return (
    <div className="flex w-full flex-col gap-3">
      <BingoBoard squares={card(0)} className="w-full" />
      <div className="relative">
        <span className={gameButtonClass({ variant: "yellow", full: true, size: "lg", className: "clip-join pointer-events-none text-[16px] tracking-normal" })}>
          <span className="grid place-items-center">
            <span className="clip-join-word col-start-1 row-start-1">Join · 100 G$</span>
            <span className="clip-joined-word col-start-1 row-start-1">Joined</span>
          </span>
        </span>
        <span className="clip-cursor pointer-events-none absolute left-1/2 top-1">
          <Cursor />
        </span>
      </div>
    </div>
  );
}

function PlayScene() {
  return (
    <div className="relative w-full">
      <BingoBoard squares={card(0)} className="w-full" />
      <Stamp tone="kept" big slam className="clip-stamp absolute left-[7%] top-[16%] -rotate-12 bg-white/95">
        Kept
      </Stamp>
    </div>
  );
}

function BoardRow({ rank, name, pts, you }: { rank: number; name: string; pts: string; you?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${you ? "border-2 border-ink bg-yellow" : ""}`}>
      <span className="w-5 text-center font-display text-[16px] font-extrabold">{rank}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold">{name}</span>
      <span className="text-[12px] font-extrabold">{pts}</span>
    </div>
  );
}

function PoolAmount({ size = "lg" }: { size?: "sm" | "lg" }) {
  const facts = useEarnFacts();
  const usd = facts ? fmtUsd(ACTIVE_POT.weeklyG * facts.gdUsd) : null;
  const pot = ACTIVE_POT.weeklyG.toLocaleString("en-US");
  return (
    <>
      <p className={`m-0 font-display font-extrabold leading-none text-yellow ${size === "lg" ? "text-[32px]" : "text-[22px]"}`}>{pot} G$</p>
      {usd ? <p className="m-0 mt-1 text-[13px] font-extrabold text-white/80">≈ {usd}</p> : null}
    </>
  );
}

function PointsScene() {
  return (
    <div className="w-full rounded-[22px] border-2 border-ink bg-white p-2.5 shadow-[0_4px_0_#161615]">
      <div className="rounded-2xl bg-ink px-3 py-2.5 text-white">
        <p className="label-mono m-0 text-[10px] text-white/60">This will be shared</p>
        <PoolAmount size="sm" />
      </div>
      <div className="mt-1.5 flex flex-col">
        <BoardRow rank={4} name="@veenom33" pts="9,590 pts" />
        <BoardRow rank={5} name="@Irelee001" pts="9,380 pts" />
        <BoardRow rank={6} name="@Phemzy19" pts="8,550 pts" />
        <div className="clip-climb">
          <BoardRow rank={8} name="You" pts="10 pts" you />
        </div>
        <BoardRow rank={9} name="@Honeydrop" pts="7,500 pts" />
      </div>
    </div>
  );
}

function ShareScene() {
  return (
    <div className="flex w-full flex-col items-center gap-3 text-center">
      <div className="w-full rounded-[22px] border-2 border-ink bg-ink px-4 py-3 text-white shadow-[0_4px_0_#000]">
        <p className="label-mono m-0 text-[11px] text-white/60">This will be shared</p>
        <PoolAmount />
      </div>
      <Lulu size={72} mood="kept" />
      <p className="m-0 text-[13px] font-extrabold leading-snug">Cash your G$ to a Naira bank account on the app.</p>
    </div>
  );
}

const STEPS: { n: string; title: string; body: string; art: ReactNode }[] = [
  {
    n: "Step 1",
    title: "Join a Bingo",
    body: "Put 100 G$ on the card. That’s how you stick with the habit.",
    art: <JoinScene />,
  },
  {
    n: "Step 2",
    title: "Play the card",
    body: "One proof a day. That square is kept.",
    art: <PlayScene />,
  },
  {
    n: "Step 3",
    title: "Earn points",
    body: "A kept proof is 10 points. You move up a place.",
    art: <PointsScene />,
  },
  {
    n: "Step 4",
    title: "Share the pool",
    body: "Show up all 7 days and this is shared. Cash your G$ to a Naira bank account on the app.",
    art: <ShareScene />,
  },
];

/** Short looping clip. Loaded in an iframe so watching stays inside the app. */
const SOUND_AT: Record<number, [string, number][]> = {
  0: [["click", 2800]],
  1: [["stamp", 400]],
  2: [["climb", 2100]],
  3: [["whoosh", 350], ["chime", 800]],
};

export default function HowItWorksClip() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setI((n) => (n + 1) % STEPS.length), BEAT_MS);
    const cues = (SOUND_AT[i] ?? []).map(([name, at]) =>
      window.setTimeout(() => {
        window.parent.postMessage({ type: "delulu-clip-sound", name }, window.location.origin);
      }, at),
    );
    return () => {
      window.clearTimeout(id);
      cues.forEach((t) => window.clearTimeout(t));
    };
  }, [i]);

  const step = STEPS[i]!;

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[#f6f3e8] text-ink">
      <div className="flex gap-1 px-6 pt-5">
        {STEPS.map((s, idx) => (
          <span key={s.n} className="h-1 flex-1 overflow-hidden rounded-full bg-ink/15">
            <span
              className="block h-full bg-ink"
              style={{
                width: idx < i ? "100%" : idx === i ? "100%" : "0%",
                animation: idx === i ? `delulu-clip-fill ${BEAT_MS}ms linear` : undefined,
              }}
            />
          </span>
        ))}
      </div>
      <div key={i} className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-3">
        <Fit>
          <div className="flex flex-col items-center gap-3 text-center">
            <div>
              <p className="label-mono m-0 text-[12px] text-[#8a6a00]">{step.n}</p>
              <h1 className="m-0 mt-1 font-display text-[36px] font-extrabold leading-[0.95]">{step.title}</h1>
              <p className="m-0 mt-1.5 text-[14px] font-semibold leading-snug">{step.body}</p>
            </div>
            {step.art}
          </div>
        </Fit>
      </div>
      <style>{`
        @keyframes delulu-clip-fill { from { width: 0%; } to { width: 100%; } }
        @keyframes clip-cursor {
          0% { transform: translate(90px, -48px); }
          40% { transform: translate(24px, 8px); }
          50% { transform: translate(24px, 14px) scale(0.92); }
          62%, 100% { transform: translate(24px, 8px); }
        }
        .clip-cursor { animation: clip-cursor ${BEAT_MS}ms ease forwards; }
        @keyframes clip-press {
          0%, 46% { transform: none; }
          52% { transform: translateY(3px); }
          60%, 100% { transform: none; }
        }
        .clip-join { animation: clip-press ${BEAT_MS}ms ease forwards; }
        @keyframes clip-swap-word { 0%, 48% { opacity: 1; } 56%, 100% { opacity: 0; } }
        @keyframes clip-swap-in { 0%, 48% { opacity: 0; } 56%, 100% { opacity: 1; } }
        .clip-join-word { animation: clip-swap-word ${BEAT_MS}ms linear forwards; }
        .clip-joined-word { animation: clip-swap-in ${BEAT_MS}ms linear forwards; }
        @keyframes clip-pop { from { transform: scale(0.2); opacity: 0; } to { transform: none; opacity: 1; } }
        .clip-stamp { animation: clip-pop .55s .4s cubic-bezier(.2,1.4,.4,1) both; }
        @keyframes clip-climb {
          0%, 22% { transform: translateY(28px); opacity: 0; }
          38% { opacity: 1; transform: translateY(28px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        .clip-climb { animation: clip-climb ${BEAT_MS}ms ease forwards; }
        @keyframes clip-coin {
          0% { transform: translateY(16px) scale(.92); opacity: 0; }
          100% { transform: none; opacity: 1; }
        }
        .clip-coin { animation: clip-coin .55s ease both; }
        .clip-coin-late { animation: clip-coin .55s ease .7s both; }
      `}</style>
    </main>
  );
}
