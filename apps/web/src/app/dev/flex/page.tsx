"use client";

import { notFound } from "next/navigation";
import { BingoFlexCard } from "@/components/bingo/bingo-flex-card";
import type { BingoCardView, BingoSquareView } from "@/lib/bingo/view";

/** Development-only: the Bingo flex card across tiers and states. */
const PHOTOS = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300",
  "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=300",
  "https://images.unsplash.com/photo-1495567720989-cebdbdd97913?w=300",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=300",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=300",
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=300",
  "https://images.unsplash.com/photo-1495195134817-aeb325a55b65?w=300",
];
const WEEK = ["Show us what you ate today", "Find something beautiful", "Show us your outfit", "Try something new", "Capture the sky", "Show us your happy place", "Share something that made you smile"];
const DEBUT = ["Share a selfie", "Something you love", "Something that made you smile"];
const sq = (titles: string[], filled: number): BingoSquareView[] =>
  titles.map((title, i) => ({ index: i, title, bonus: false, state: i < filled ? "filled" : "empty", photoUrl: i < filled ? PHOTOS[i % PHOTOS.length] : null, filledAt: null }));
const card = (o: Partial<BingoCardView> & { titles: string[]; filled: number; day: number }): BingoCardView => ({
  attemptId: Math.random().toString(), wallet: "0x45394a2b50392ff073d26ec130527db6752e4be9", username: "hekii", avatarUrl: null,
  tierKey: "starter", tierLabel: "Starter", stake: 1000, status: "active", squaresFilled: o.filled, requiredFilled: o.filled, lastFilledAt: null,
  startedAt: new Date(Date.now() - (o.day - 1) * 86_400_000 - 3_600_000).toISOString(), endsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  squares: sq(o.titles, o.filled), ...o,
});

export default function DevFlex() {
  if (process.env.NODE_ENV === "production") notFound();
  const starter = card({ titles: WEEK, filled: 5, day: 6, username: "metakay23" });
  const pro = card({ titles: WEEK, filled: 2, day: 3, tierKey: "pro", tierLabel: "Pro", stake: 2000, username: "believerbg" });
  const elite = card({ titles: WEEK, filled: 7, day: 7, tierKey: "elite", tierLabel: "Elite", stake: 3000, username: "hekii" });
  const debut = card({ titles: DEBUT, filled: 1, day: 1, tierKey: "entry", tierLabel: "Debut", stake: 1000, username: "fabek" });
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 bg-paper px-5 py-6">
      <BingoFlexCard card={starter} bingoTitle="Outside Your Bubble" required={7} />
      <BingoFlexCard card={elite} bingoTitle="Outside Your Bubble" required={7} />
      <div className="grid grid-cols-2 gap-3">
        <BingoFlexCard card={elite} bingoTitle="x" required={7} size="sm" rank={1} />
        <BingoFlexCard card={starter} bingoTitle="x" required={7} size="sm" rank={2} />
        <BingoFlexCard card={pro} bingoTitle="x" required={7} size="sm" rank={3} />
        <BingoFlexCard card={debut} bingoTitle="x" required={3} size="sm" rank={4} mine />
      </div>
      <BingoFlexCard card={pro} bingoTitle="Outside Your Bubble" required={7} />
      <BingoFlexCard card={debut} bingoTitle="Delulu Debut" required={3} />
    </main>
  );
}
