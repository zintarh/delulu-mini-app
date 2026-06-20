/** On-chain duration for a community campaign from Supabase duration_days. */
export function campaignDurationSeconds(durationDays: number): number {
  const days = Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 30;
  return days * 86_400;
}

/** Proof cadence interval in seconds for createCommunityChallenge. */
export function proofIntervalSeconds(cadence: "daily" | "weekly" | string): number {
  return cadence === "weekly" ? 604_800 : 86_400;
}
