"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BingoBoard } from "@/components/bingo/bingo-board";
import { buildSquares, type BingoView } from "@/lib/bingo/view";

/** The three cards the homepage rotates: the same board you see when you open one. */
const SHOWCASE = ["workout-week", "reading-week", "prayer-week"] as const;

/**
 * Hero visual: a real Bingo card (workout, then reading, then prayer), built
 * with the same board as the Bingo page. Falls back to those cards' missions
 * if the list hasn't loaded yet.
 */
type Card = { slug: string; title: string; durationDays: number; perProof: number; missions: { title: string; bonus: boolean }[] };

const FALLBACK: Card[] = [
  {
    slug: "workout-week",
    title: "Workout Week",
    durationDays: 7,
    perProof: 10,
    missions: [
      "Morning stretch",
      "A 20-minute walk or run",
      "30 squats",
      "Your workout selfie",
      "A healthy meal after you train",
      "Plank for 60 seconds",
      "Your post-workout glow",
    ].map((title) => ({ title, bonus: false })),
  },
  {
    slug: "reading-week",
    title: "Read Every Day",
    durationDays: 7,
    perProof: 10,
    missions: [
      "The book you're reading",
      "Your reading spot",
      "A page that made you think",
      "Read with your favourite drink",
      "A line you love from your book",
      "How far you've read",
      "Finished a chapter selfie",
    ].map((title) => ({ title, bonus: false })),
  },
  {
    slug: "prayer-week",
    title: "Prayer Week",
    durationDays: 7,
    perProof: 10,
    missions: [
      "You praying this morning",
      "Your prayer spot",
      "You praying before a meal",
      "A prayer you wrote down",
      "You praying with someone",
      "You praying at night",
      "Your end-of-week prayer selfie",
    ].map((title) => ({ title, bonus: false })),
  },
];

function fromBingo(b: BingoView): Card {
  const entry = [...b.tiers].sort((a, c) => a.stake - c.stake)[0];
  return {
    slug: b.slug,
    title: b.title,
    durationDays: b.durationDays,
    perProof: entry?.rewardPerSquare ?? b.rewards.perProof,
    missions: b.missions.filter((m) => !m.bonus).slice(0, 9).map((m) => ({ title: m.title, bonus: false })),
  };
}

export function LandingBingoShowcase() {
  const [cards, setCards] = useState<Card[]>(FALLBACK);
  const [i, setI] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/bingo")
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { bingos?: BingoView[] } | null) => {
        if (!alive || !body?.bingos) return;
        const picked = SHOWCASE.map((slug) => body.bingos!.find((b) => b.slug === slug)).filter((b): b is BingoView => !!b).map(fromBingo);
        if (picked.length) setCards(picked);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % cards.length), 3200);
    return () => window.clearInterval(id);
  }, [cards.length]);

  const card = cards[i] ?? cards[0];
  const squares = buildSquares(card.missions, [], false);

  return (
    <div className="relative flex min-w-0 flex-[1_1_420px] justify-center py-5">
      <Link
        href={`/bingo/${card.slug}`}
        aria-label={`${card.title} Bingo`}
        className="block w-full max-w-[420px] text-ink no-underline"
      >
        <div key={card.slug} className="animate-rise">
          <p className="label-mono m-0 text-[11px] text-muted-foreground">{card.durationDays}-day Bingo</p>
          <h2 className="m-0 mt-1 font-display text-[34px] font-extrabold uppercase leading-[0.92]" aria-live="polite">
            {card.title}
          </h2>
          <div className="mt-4">
            <BingoBoard squares={squares} reward={card.perProof > 0 ? { perSquare: card.perProof } : undefined} />
          </div>
          <p className="m-0 mt-3 text-[13px] font-extrabold text-muted-foreground">Play this card · one proof a day</p>
        </div>
      </Link>
    </div>
  );
}
