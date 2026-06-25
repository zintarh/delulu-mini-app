import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";

/** Off-chain points for a verified proof submission. */
export function computeProofPoints(options: {
  currentStreak: number;
  isEarlySubmit?: boolean;
}): { points: number; nextStreak: number } {
  const nextStreak = options.currentStreak + 1;
  return { points: BASE_PROOF_POINTS, nextStreak };
}
