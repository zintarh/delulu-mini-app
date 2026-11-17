"use client";

import { notFound } from "next/navigation";
import { BingoBoard } from "@/components/bingo/bingo-board";
import { MissionSticker } from "@/components/bingo/mission-stickers";
import type { BingoSquareView } from "@/lib/bingo/view";

/** Development-only: the Bingo board in every state, and every mission sticker. */
const MISSIONS = [
  "Show us what you ate today", "Find something beautiful", "Show us your outfit",
  "Try something new", "Capture the sky", "Show us your happy place",
  "Share something that made you smile", "Your shoes today", "Something green",
];
const MORE = [
  "Share a selfie", "Something you love", "Your favourite drink", "Your favourite snack", "Something colourful",
  "Your current view", "A picture with a friend", "Your favourite part of the week", "Where you work or study",
  "Something old you still love", "Somewhere you went", "Something interesting you discovered", "Read a chapter", "Morning walk", "Day 1 · You praying", "Anything else",
];
const PHOTOS = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300",
  "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=300",
  "https://images.unsplash.com/photo-1495567720989-cebdbdd97913?w=300",
];

const sq = (i: number, state: BingoSquareView["state"], photo?: string): BingoSquareView => ({
  index: i, title: MISSIONS[i], bonus: i >= 7, state, photoUrl: photo ?? null, filledAt: null,
});

export default function DevBingoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const live = MISSIONS.map((_, i) =>
    i === 0 ? sq(i, "filled", PHOTOS[0]) : i === 1 ? sq(i, "filled", PHOTOS[1]) : i === 2 ? sq(i, "confirming", PHOTOS[2]) : sq(i, "empty"),
  );
  const done = MISSIONS.map((_, i) => (i < 7 ? sq(i, "filled", PHOTOS[i % 3]) : sq(i, "empty")));
  const ended = MISSIONS.map((_, i) => (i < 3 ? sq(i, "filled", PHOTOS[i % 3]) : sq(i, i < 7 ? "missed" : "empty")));
  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 bg-paper px-5 py-6">
      <section>
        <p className="label-mono mb-2 text-[11px]">Live · day 4 open</p>
        <BingoBoard reward={{ perSquare: 100 }} squares={live} availability={(s) => (s.state !== "empty" ? "none" : s.index === 3 || s.bonus ? "open" : "locked")} onPick={() => {}} />
      </section>
      <section>
        <p className="label-mono mb-2 text-[11px]">Complete</p>
        <BingoBoard squares={done} complete />
      </section>
      <section>
        <p className="label-mono mb-2 text-[11px]">Ended with misses · minis</p>
        <BingoBoard squares={ended} />
        <div className="mt-3 grid grid-cols-3 gap-3">
          <BingoBoard squares={live} size="mini" />
          <BingoBoard squares={done} size="mini" />
          <BingoBoard squares={ended} size="mini" />
        </div>
      </section>
      <section>
        <p className="label-mono mb-2 text-[11px]">Stickers</p>
        <div className="grid grid-cols-4 gap-3">
          {[...MISSIONS, ...MORE].map((t) => (
            <div key={t} className="flex flex-col items-center gap-1 rounded-2xl bg-white p-2 text-center">
              <MissionSticker title={t} size={44} />
              <span className="text-[9px] font-bold leading-tight">{t}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
