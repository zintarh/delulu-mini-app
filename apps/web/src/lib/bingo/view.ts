/** Client-safe Bingo view types (shared by API responses and UI). */
import type { BingoAttemptRow, BingoCampaignRow, BingoMission, BingoSquareRow, CyclePhase } from "@/lib/bingo/types";

export type BingoSquareView = {
  index: number;
  title: string;
  bonus: boolean;
  /** filled = approved and on-chain; confirming = approved, proof tx pending; missed = cycle over, never filled */
  state: "empty" | "confirming" | "filled" | "missed";
  photoUrl: string | null;
  filledAt: string | null;
};

export type BingoCardView = {
  attemptId: string;
  wallet: string;
  username: string | null;
  avatarUrl: string | null;
  tierKey: string;
  tierLabel: string;
  stake: number;
  status: BingoAttemptRow["status"];
  squaresFilled: number;
  requiredFilled: number;
  lastFilledAt: string | null;
  /** This player's own window — the cycle for weekly Bingos, their personal clock for rolling ones. */
  startedAt: string;
  endsAt: string;
  squares: BingoSquareView[];
};

export type BingoTierView = {
  key: string;
  label: string;
  stake: number;
  forfeitPct: number;
  campaignId: string | null;
  challengeId: number | null;
  ready: boolean;
};

export type BingoView = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  durationDays: 3 | 7;
  enrollment: "fixed" | "rolling";
  recurrence: BingoCampaignRow["recurrence"];
  missions: BingoMission[];
  cycle: {
    id: string;
    number: number;
    startsAt: string;
    endsAt: string;
    phase: CyclePhase;
    /** 0-based day of the cycle right now, or null when not running. */
    today: number | null;
    joinable: boolean;
    joinClosesAt: string;
  } | null;
  tiers: BingoTierView[];
  /** Can the viewer join (or, for rolling Bingos, start a fresh card) right now. */
  joinable: boolean;
  /** Shown in lists: running, or starting within a day (announced). */
  visible: boolean;
  players: number;
  /** Latest approved photos across players — the card art in lists. */
  photos: string[];
  /** Real engine amounts for verified players; 0 = category off. */
  rewards: { perProof: number; completion: number };
  me:
    | (BingoCardView & {
        /** The player's own clock: phase + 0-based day within it. */
        phase: CyclePhase;
        today: number | null;
        todayUsed: boolean;
        nextSquareAt: string | null;
        /** Rolling: squares must go in day order (day 1 → square 1). */
        dayOrdered: boolean;
        /** Rolling: a missed day ended this attempt early (stake forfeited). */
        missedDay: boolean;
      })
    | null;
};

export function buildSquares(missions: BingoMission[], squares: BingoSquareRow[], cycleOver: boolean): BingoSquareView[] {
  const byIndex = new Map(squares.map((s) => [s.square_index, s]));
  return missions.map((m, index) => {
    const s = byIndex.get(index);
    const state: BingoSquareView["state"] = s
      ? s.status === "filled"
        ? "filled"
        : cycleOver
          ? "missed"
          : "confirming"
      : cycleOver && !m.bonus
        ? "missed"
        : "empty";
    return {
      index,
      title: m.title,
      bonus: m.bonus,
      state,
      // A pending proof is the player's own photo — shown only on their card (see callers).
      photoUrl: s ? s.proof_url : null,
      filledAt: s?.filled_at ?? null,
    };
  });
}

