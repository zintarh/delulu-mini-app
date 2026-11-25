/** Weekly Active Pot settings and tickets — client-safe (lib/pool/active-pot.ts is server-only). */
export const ACTIVE_POT = {
  weeklyG: 1_000_000,
  newcomerDays: 14,
  newcomerMultiplier: 2,
  stakeCap: 100_000,
} as const;

/** [minimum stake, tickets] — the biggest row the stake reaches. */
export const TICKETS: readonly (readonly [number, number])[] = [
  [100, 1],
  [500, 3],
  [1_000, 5],
  [2_500, 8],
  [5_000, 10],
  [20_000, 15],
  [100_000, 20],
];

/** Tickets for a stake (0 below 100) — doubled for new players. */
export function ticketsFor(stake: number, newcomer: boolean): number {
  let t = 0;
  for (const [min, n] of TICKETS) if (stake >= min) t = n;
  return t * (newcomer ? ACTIVE_POT.newcomerMultiplier : 1);
}
