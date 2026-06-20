import {
  BASE_PROOF_POINTS,
  EARLY_SUBMIT_BONUS,
  STREAK_BONUS_PER_DAY,
} from "@/lib/dashboard/campaign-constants";

/** Off-chain points for a verified proof submission. */
export function computeProofPoints(options: {
  currentStreak: number;
  isEarlySubmit?: boolean;
}): { points: number; nextStreak: number } {
  const nextStreak = options.currentStreak + 1;
  let points = BASE_PROOF_POINTS;
  if (options.isEarlySubmit) points += EARLY_SUBMIT_BONUS;
  if (nextStreak > 1) points += STREAK_BONUS_PER_DAY * Math.min(nextStreak - 1, 7);
  return { points, nextStreak };
}
