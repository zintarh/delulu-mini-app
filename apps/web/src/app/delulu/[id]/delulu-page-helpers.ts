import { MS_PER_DAY } from "@/lib/milestone-utils";

export type DeluluStakeRow = {
  amount: number;
  userId: string;
  user?: {
    address?: string | null;
    username?: string | null;
    pfpUrl?: string | null;
  } | null;
};

export type DeluluLeaderboardEntry = {
  address: string;
  username?: string;
  pfpUrl?: string;
  believerStake: number;
  totalStake: number;
  rank: number;
};

export function buildDeluluLeaderboard(
  stakes: DeluluStakeRow[] | null | undefined,
): DeluluLeaderboardEntry[] {
  if (!stakes || stakes.length === 0) return [];

  const grouped = stakes.reduce(
    (acc, stake) => {
      const key = stake.user?.address || stake.userId;
      if (!acc[key]) {
        acc[key] = {
          address: stake.user?.address || "",
          username: stake.user?.username || undefined,
          pfpUrl: stake.user?.pfpUrl || undefined,
          believerStake: 0,
          totalStake: 0,
        };
      }
      acc[key].believerStake += stake.amount;
      acc[key].totalStake += stake.amount;
      return acc;
    },
    {} as Record<
      string,
      {
        address: string;
        username?: string;
        pfpUrl?: string;
        believerStake: number;
        totalStake: number;
      }
    >,
  );

  return Object.values(grouped)
    .sort((a, b) => b.totalStake - a.totalStake)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function getDeluluRemainingDaysTotal({
  resolutionDeadline,
  lastMilestoneDeadline,
  nowMs,
}: {
  resolutionDeadline: Date | null | undefined;
  lastMilestoneDeadline: Date | null | undefined;
  nowMs: number;
}): number {
  if (!resolutionDeadline) return 0;
  const startMs =
    (lastMilestoneDeadline && lastMilestoneDeadline.getTime() > 0
      ? lastMilestoneDeadline.getTime()
      : nowMs) ?? nowMs;
  const endMs = resolutionDeadline.getTime();
  const days = (endMs - startMs) / MS_PER_DAY;
  return Math.max(0, Math.floor(days));
}

export function getMaxDaysPerRow(
  newMilestones: Array<{ days: string }>,
  deluluRemainingDaysTotal: number,
): number[] {
  return newMilestones.map((_, index) => {
    const daysUsedByPrevious = newMilestones
      .slice(0, index)
      .reduce((sum, m) => sum + (Number(m.days) || 0), 0);
    return Math.max(0, Math.floor(deluluRemainingDaysTotal - daysUsedByPrevious));
  });
}

export function getNewMilestoneTiming({
  existingMilestonesLastDeadline,
  newMilestones,
  index,
  resolutionDeadline,
  nowMs,
}: {
  existingMilestonesLastDeadline: Date | null | undefined;
  newMilestones: Array<{ days: string }>;
  index: number;
  resolutionDeadline: Date | null | undefined;
  nowMs: number;
}): { startTime: number; endTime: number; exceedsDeadline: boolean } {
  let startTime =
    existingMilestonesLastDeadline && existingMilestonesLastDeadline.getTime() > 0
      ? existingMilestonesLastDeadline.getTime()
      : nowMs;

  for (let i = 0; i < index; i++) {
    const prevDays = Number(newMilestones[i]?.days) || 0;
    if (prevDays > 0) startTime += prevDays * MS_PER_DAY;
  }

  const days = Number(newMilestones[index]?.days) || 0;
  const endTime = days > 0 ? startTime + days * MS_PER_DAY : startTime;

  const resolutionTime = resolutionDeadline?.getTime() || 0;
  const exceedsDeadline = resolutionTime > 0 && endTime > resolutionTime;

  return { startTime, endTime, exceedsDeadline };
}

