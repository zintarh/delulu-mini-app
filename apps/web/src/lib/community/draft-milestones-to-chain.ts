export type DraftMilestoneRow = {
  title: string;
  duration_days: number;
  order_index?: number;
};

export function draftMilestonesToChainArgs(
  rows: DraftMilestoneRow[],
  campaignDurationDays: number,
): { mURIs: string[]; mDurations: bigint[] } {
  const sorted = [...rows].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
  );
  const mURIs = sorted.map((m) => m.title.trim());
  const mDurations = sorted.map((m) =>
    BigInt(Math.max(1, Number(m.duration_days) || 1) * 24 * 60 * 60),
  );

  if (mURIs.length === 0) {
    throw new Error("At least one milestone is required.");
  }
  if (mURIs.some((t) => !t)) {
    throw new Error("Every milestone needs a title.");
  }

  const totalDays = sorted.reduce(
    (sum, m) => sum + Math.max(1, Number(m.duration_days) || 1),
    0,
  );
  const expected = Math.max(1, campaignDurationDays);
  if (totalDays !== expected) {
    throw new Error(
      `Milestones must total ${expected} days (currently ${totalDays}).`,
    );
  }

  return { mURIs, mDurations };
}
