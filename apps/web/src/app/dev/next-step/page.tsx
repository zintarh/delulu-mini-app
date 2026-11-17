"use client";

import { notFound } from "next/navigation";
import { NextStepCard } from "@/components/next-step-card";
import { homeNextStep } from "@/lib/next-step";
import type { BingoView } from "@/lib/bingo/view";

/** Development-only: Home's "Your next step" in every stage of the journey. */
const DAY = 86_400_000;
function mk(slug: string, title: string, days: 3 | 7, recurrence: "one_time" | "automatic", me: Partial<NonNullable<BingoView["me"]>> | null = null): BingoView {
  return {
    id: slug, slug, title, description: null, coverImageUrl: null, durationDays: days, enrollment: "rolling", recurrence,
    missions: (days === 3 ? ["Share a selfie", "Something you love", "Something that made you smile"] : Array.from({ length: 7 }, (_, i) => `Mission ${i + 1}`)).map((t) => ({ title: t, bonus: false })),
    cycle: null, tiers: [{ key: "t", label: "T", stake: 1000, forfeitPct: 0, campaignId: null, challengeId: null, ready: true }],
    joinable: !me, visible: true, players: 12, photos: [], rewards: { perProof: 100, completion: 500 },
    me: me ? ({ attemptId: "a", wallet: "0x1", username: null, avatarUrl: null, tierKey: "t", tierLabel: "T", stake: 1000, status: "active", squaresFilled: 0, requiredFilled: 0, lastFilledAt: null, startedAt: new Date(Date.now() - 3600e3).toISOString(), endsAt: new Date(Date.now() + 3 * DAY).toISOString(), squares: [], phase: "live", today: 0, todayUsed: false, nextSquareAt: null, dayOrdered: true, missedDay: false, ...me } as BingoView["me"]) : null,
  };
}
const weekly = mk("outside-your-bubble", "Outside Your Bubble Bingo", 7, "automatic");
const debut = (me: Partial<NonNullable<BingoView["me"]>> | null = null) => mk("delulu-debut", "Delulu Debut", 3, "one_time", me);
const STAGES: [string, BingoView[], boolean][] = [
  ["Just signed up (not verified)", [debut(), weekly], false],
  ["Verified, new", [debut(), weekly], true],
  ["Playing — day 1 open", [debut({}), weekly], true],
  ["Day 1 done", [debut({ todayUsed: true, requiredFilled: 1, nextSquareAt: new Date(Date.now() + 5 * 3600e3).toISOString() }), weekly], true],
  ["Finished Debut", [debut({ requiredFilled: 3, squaresFilled: 3, todayUsed: true, today: 2 }), weekly], true],
  ["Missed a day", [debut({ missedDay: true }), weekly], true],
];

export default function DevNextStep() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 bg-paper px-5 py-6">
      {STAGES.map(([label, bingos, verified]) => (
        <section key={label}>
          <p className="label-mono mb-1.5 text-[10px] text-muted-foreground">{label}</p>
          <NextStepCard step={homeNextStep({ bingos, verified }).step} />
        </section>
      ))}
    </main>
  );
}
