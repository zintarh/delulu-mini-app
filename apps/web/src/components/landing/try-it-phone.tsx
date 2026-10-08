"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import { Chip, Coin, ConfettiStatic, Lulu, gameButtonClass } from "@/components/ds";
import { cn } from "@/lib/utils";

const HABITS = [
  { id: "read", label: "Read", word: "read for 30 minutes" },
  { id: "sugar", label: "No sugar", word: "skip sugar" },
  { id: "journal", label: "Journal", word: "write one journal page" },
  { id: "gym", label: "Workout", word: "work out for 20 minutes" },
  { id: "walk", label: "Walk 10k", word: "walk 10,000 steps" },
] as const;

type HabitId = (typeof HABITS)[number]["id"];
type Stake = "word" | "money";

/**
 * Hero demo: a phone running a mini "New contract" screen. Habits auto-cycle
 * until the visitor taps one; the stake toggle switches Lulu's mood.
 */
export function TryItPhone() {
  const [habit, setHabit] = useState<HabitId>("read");
  const [auto, setAuto] = useState(true);
  const [stake, setStake] = useState<Stake>("word");

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      setHabit((h) => {
        const i = HABITS.findIndex((x) => x.id === h);
        return HABITS[(i + 1) % HABITS.length].id;
      });
    }, 2600);
    return () => window.clearInterval(id);
  }, [auto]);

  const word = stake === "word";
  const current = HABITS.find((h) => h.id === habit)!;

  return (
    <div className="relative flex min-w-0 flex-[1_1_420px] justify-center py-5">
      <ConfettiStatic
        pieces={[
          { left: "6%", top: "10%", color: "#161615", rotate: 20 },
          { left: "90%", top: "6%", color: "#EC5B8D", rotate: -25, w: 10, h: 16 },
          { left: "94%", top: "70%", color: "#2DB36F", rotate: 35 },
          { left: "2%", top: "78%", color: "#F6C324", rotate: -15, w: 14, h: 20 },
        ]}
      />
      <div className="absolute right-[calc(50%-230px)] top-0 z-[3]">
        <span key={stake} className="inline-block animate-bounce-in">
          <span className="inline-block animate-bob">
            <Lulu size={104} mood={word ? "dream" : "kept"} />
          </span>
        </span>
      </div>

      <div className="relative z-[2] w-[340px] max-w-full animate-rise rounded-[50px] bg-ink p-[11px] shadow-lift">
        <div className="absolute left-1/2 top-5 z-[2] -ml-[46px] h-[26px] w-[92px] rounded-[14px] bg-ink" aria-hidden />
        <div className="flex min-h-[600px] flex-col gap-3.5 overflow-hidden rounded-[40px] bg-paper px-4 pb-[18px] pt-[54px]">
          <div className="flex items-center justify-between">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-line bg-white" aria-hidden>
              <X className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <span className="text-[15px] font-bold">New contract</span>
            <span className="w-[34px]" />
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick a habit">
            {HABITS.map((h) => (
              <Chip
                key={h.id}
                selected={habit === h.id}
                className="h-9 px-3 text-[13px]"
                onClick={() => {
                  setHabit(h.id);
                  setAuto(false);
                }}
              >
                {h.label}
              </Chip>
            ))}
          </div>

          <div className="rounded-[20px] border-2 border-line bg-white p-4 shadow-edge">
            <div className="label-mono mb-2 text-[9px] text-muted-foreground">Contract Nº 0001</div>
            <p className="m-0 text-lg font-semibold leading-[1.6]" aria-live="polite">
              I&apos;ll{" "}
              <span
                key={current.id}
                className="inline-block animate-bounce-in rounded-t-md border-b-[3px] border-yellow bg-yellow-soft px-1.5 font-bold"
              >
                {current.word}
              </span>{" "}
              every day for 7 days. If I miss a day,{" "}
              <span
                className={cn(
                  "rounded-t-md border-b-[3px] px-1.5 font-bold",
                  word ? "border-pink-bright bg-pink-soft" : "border-yellow bg-yellow-soft",
                )}
              >
                {word ? "I'll call my dad and admit I quit" : "I lose the money I put down"}
              </span>
              .
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2" role="group" aria-label="What's on the line">
            <button
              type="button"
              aria-pressed={word}
              onClick={() => setStake("word")}
              className={cn(
                "press-edge flex h-[50px] items-center justify-center gap-1.5 rounded-[14px] border-2 text-sm font-extrabold",
                word ? "border-ink bg-pink-soft shadow-[0_3px_0_#161615]" : "border-line bg-white shadow-edge-sm",
              )}
            >
              <MessageCircle className="h-[18px] w-[18px] text-pink" strokeWidth={2.4} />
              My word
            </button>
            <button
              type="button"
              aria-pressed={!word}
              onClick={() => setStake("money")}
              className={cn(
                "press-edge flex h-[50px] items-center justify-center gap-1.5 rounded-[14px] border-2 text-sm font-extrabold",
                !word ? "border-ink bg-yellow-soft shadow-[0_3px_0_#161615]" : "border-line bg-white shadow-edge-sm",
              )}
            >
              <Coin size={18} />
              Money
            </button>
          </div>

          <Link href="/sign-in" className={gameButtonClass({ variant: "ink", full: true, className: "mt-auto h-[54px] text-sm" })}>
            Sign this contract
          </Link>
        </div>
      </div>
    </div>
  );
}
