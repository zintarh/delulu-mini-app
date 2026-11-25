/**
 * Leaderboard windows, both from Fri 20 Nov 2026 (Lagos midnight): this week
 * and the last 2 weeks. Both score the same points — stake ÷ 10 per kept day
 * on any Forfeit goal or Bingo (cap 100k), missions by their stake — so the
 * bigger the stake, the higher you rank. The money is the weekly pool
 * (1,000,000 G$ in lib/pool/tickets.ts), shared by everyone who shows up
 * all 7 days, not a separate bi-weekly prize.
 */
const DAY_MS = 86_400_000;
const LAGOS_OFFSET_MS = 3_600_000; // WAT = UTC+1, no DST
/** Week 1 started Fri 20 Nov 2026 00:00 WAT. */
export const WEEKLY_ANCHOR_MS = Date.UTC(2026, 10, 20) - LAGOS_OFFSET_MS;

export type BoardWindow = "week" | "fortnight" | "month";

/** New players' First Week (a 1k stake) scores like this stake, so a kept week ranks with regular 10k players. */
export const FIRST_WEEK_BOARD_STAKE = 10_000;

/** Each day kept this round adds 10% to your stake points: 14 days kept = × 2.4. */
export const CONSISTENCY_BOOST_PER_DAY = 0.1;
/** Board score: stake points (stake ÷ 10 per kept day) × the consistency boost. */
export function boardScore(stakePoints: number, daysKept: number): number {
  return Math.round(stakePoints * (1 + CONSISTENCY_BOOST_PER_DAY * Math.max(0, daysKept)));
}

export function weekWindow(nowMs = Date.now()): { index: number; startMs: number; endMs: number } {
  const index = Math.max(0, Math.floor((nowMs - WEEKLY_ANCHOR_MS) / (7 * DAY_MS)));
  const startMs = WEEKLY_ANCHOR_MS + index * 7 * DAY_MS;
  return { index: index + 1, startMs, endMs: startMs + 7 * DAY_MS };
}

export function monthWindow(nowMs = Date.now()): { startMs: number; endMs: number } {
  const lagos = new Date(nowMs + LAGOS_OFFSET_MS);
  const y = lagos.getUTCFullYear();
  const m = lagos.getUTCMonth();
  return { startMs: Date.UTC(y, m, 1) - LAGOS_OFFSET_MS, endMs: Date.UTC(y, m + 1, 1) - LAGOS_OFFSET_MS };
}

/** The 2-week ranking: Round 1 is Fri 20 Nov – Thu 3 Dec 2026. */
export function fortnightWindow(nowMs = Date.now()): { index: number; startMs: number; endMs: number } {
  const index = Math.max(0, Math.floor((nowMs - WEEKLY_ANCHOR_MS) / (14 * DAY_MS)));
  const startMs = WEEKLY_ANCHOR_MS + index * 14 * DAY_MS;
  return { index: index + 1, startMs, endMs: startMs + 14 * DAY_MS };
}

export const boardWindow = (w: BoardWindow, nowMs = Date.now()) =>
  w === "week" ? weekWindow(nowMs) : w === "fortnight" ? fortnightWindow(nowMs) : monthWindow(nowMs);
