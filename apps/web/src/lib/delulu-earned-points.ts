/** Sum on-chain points earned for a single delulu (verified milestones). */
export function sumDeluluEarnedPoints(
  milestones:
    | ReadonlyArray<{
        isVerified?: boolean | null;
        pointsEarned?: string | number | bigint | null;
      }>
    | null
    | undefined,
): number {
  if (!milestones?.length) return 0;
  return milestones.reduce((sum, m) => {
    if (!m.isVerified) return sum;
    const raw = m.pointsEarned;
    if (raw == null) return sum;
    const n = typeof raw === "bigint" ? Number(raw) : Number(raw);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}
