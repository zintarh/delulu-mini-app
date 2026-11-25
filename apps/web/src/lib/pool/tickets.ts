/** Weekly Active Pot settings and tickets — client-safe (lib/pool/active-pot.ts is server-only). */
export const ACTIVE_POT = {
  weeklyG: 1_000_000,
  /** "New" = joined within this many days of the week's end. */
  newcomerDays: 14,
  /** New players' tickets just for being active all 7 days, whatever their stake. */
  newcomerTickets: 5,
  stakeCap: 100_000,
} as const;

/**
 * Returning players: [minimum stake, tickets] — the biggest row the stake reaches.
 * Below 1,000 a returning player isn't in the pot: after their first two weeks,
 * the pot rewards staking higher (25 Nov 2026).
 */
export const TICKETS: readonly (readonly [number, number])[] = [
  [1_000, 5],
  [2_500, 10],
  [5_000, 15],
  [20_000, 25],
  [100_000, 40],
];

function stakeTickets(stake: number): number {
  let t = 0;
  for (const [min, n] of TICKETS) if (stake >= min) t = n;
  return t;
}

/**
 * Tickets for a week kept 7/7 on a staked card. New players (first 14 days):
 * at least ACTIVE_POT.newcomerTickets for being active, more if their stake
 * earns more. Returning players: by stake, 0 below 1,000.
 */
export function ticketsFor(stake: number, newcomer: boolean): number {
  if (!(stake > 0)) return 0;
  return newcomer ? Math.max(ACTIVE_POT.newcomerTickets, stakeTickets(stake)) : stakeTickets(stake);
}
