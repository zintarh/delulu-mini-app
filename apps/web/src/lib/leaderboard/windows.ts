/**
 * Leaderboard windows: Weekly (from Fri 20 Nov 2026, Lagos midnight, every 7
 * days) and Monthly (calendar month, Lagos). Both score the same Season points
 * — stake-based, Bingos and missions — so a bigger stake climbs faster.
 */
const DAY_MS = 86_400_000;
const LAGOS_OFFSET_MS = 3_600_000; // WAT = UTC+1, no DST
/** Week 1 started Fri 20 Nov 2026 00:00 WAT. */
export const WEEKLY_ANCHOR_MS = Date.UTC(2026, 10, 20) - LAGOS_OFFSET_MS;

export type BoardWindow = "week" | "month";

/** The top of the monthly board share this pool each month. */
export const MONTHLY_PRIZE = { poolG: 500_000, winners: 10 };

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

export const boardWindow = (w: BoardWindow, nowMs = Date.now()) => (w === "week" ? weekWindow(nowMs) : monthWindow(nowMs));
