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
  /** The owner keeps their photos private: others get progress only (photoUrl null). */
  photosPrivate?: boolean;
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
  /** G$ for finishing the card on this tier, when the tier sets its own. */
  completionReward?: number;
  /** G$ per kept day on this tier, when it sets its own (e.g. 1% of the stake). */
  rewardPerSquare?: number;
  /** Finishers split missed stakes, up to their own stake (First Week). */
  potShare?: boolean;
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
  /** A few players' faces for the card's facepile (people with a photo first). */
  faces?: { address: string; username: string | null; pfpUrl: string | null }[];
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
        /** Daily Boost (rolling cards, once it's live): what the card's boosts are worth so far. */
        boost?: {
          pot: number;
          pct: number;
          cashback: number;
          boostedKeptDays: number;
          perfect: boolean;
          /** The card's on-chain ForfeitMarket commitment (what boostCommitment takes). */
          commitmentId: number;
          /** Days (0-based) boosted so far. */
          boostedSlots: number[];
          /** Today's day already boosted. */
          boostedToday: boolean;
          /** Day (0-based) a boost now would count for, or null when today can't be boosted. */
          openSlot: number | null;
          /** Most of a day's boost that earns cashback, before today's free claim is known. */
          capFromStake: number;
          /** Players who boosted today. */
          boostersToday: number;
        };
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

