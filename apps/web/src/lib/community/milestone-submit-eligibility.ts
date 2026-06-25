import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";

function parseTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function isMilestoneActive(
  milestone: CommunityCampaignMilestoneRow,
  nowMs: number = Date.now(),
): boolean {
  if (milestone.completed) return false;
  const startMs = parseTime(milestone.start_time);
  const deadlineMs = parseTime(milestone.deadline);
  if (startMs != null && nowMs < startMs) return false;
  if (deadlineMs != null && nowMs > deadlineMs) return false;
  return true;
}

export function canSubmitMilestone(
  milestone: CommunityCampaignMilestoneRow,
  nowMs: number = Date.now(),
): boolean {
  return isMilestoneActive(milestone, nowMs);
}

/** First incomplete milestone whose window is currently open. */
export function getActiveMilestone(
  milestones: CommunityCampaignMilestoneRow[],
  nowMs: number = Date.now(),
): CommunityCampaignMilestoneRow | null {
  return milestones.find((m) => isMilestoneActive(m, nowMs)) ?? null;
}

/** First incomplete milestone that has not started yet. */
export function getUpcomingMilestone(
  milestones: CommunityCampaignMilestoneRow[],
  nowMs: number = Date.now(),
): CommunityCampaignMilestoneRow | null {
  return (
    milestones.find((m) => {
      if (m.completed) return false;
      const startMs = parseTime(m.start_time);
      return startMs != null && nowMs < startMs;
    }) ?? null
  );
}

export function formatMilestoneOpensAt(
  startTimeIso: string,
  nowMs: number = Date.now(),
): string {
  const startMs = parseTime(startTimeIso);
  if (startMs == null) return "Opens soon";

  const startDate = new Date(startMs);
  const nowDate = new Date(nowMs);
  const tomorrow = new Date(nowDate);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const sameUtcDay = (a: Date, b: Date) =>
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();

  if (sameUtcDay(startDate, tomorrow)) return "Opens tomorrow";

  return `Opens ${startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

/** Off-chain campaigns without on-chain start_time — derive slot windows from campaign dates. */
export function buildOffChainMilestoneSchedule(options: {
  displayEndsAt: string | null;
  durationDays: number;
  proofCadence: string;
  milestones: Array<{ order_index: number; title: string }>;
  completedOrderIndices: Set<number>;
  nowMs?: number;
}): CommunityCampaignMilestoneRow[] {
  const nowMs = options.nowMs ?? Date.now();
  const isWeekly = options.proofCadence === "weekly";
  const slotMs = (isWeekly ? 7 : 1) * 86400000;
  const endMs = options.displayEndsAt
    ? new Date(options.displayEndsAt).getTime()
    : nowMs + options.durationDays * 86400000;
  const startMs = endMs - options.durationDays * 86400000;

  return options.milestones.map((m) => {
    const slotStartMs = startMs + m.order_index * slotMs;
    const slotEndMs = slotStartMs + slotMs;
    const completed = options.completedOrderIndices.has(m.order_index);
    return {
      milestone_id: m.order_index,
      label: m.title,
      start_time: new Date(slotStartMs).toISOString(),
      deadline: new Date(slotEndMs).toISOString(),
      completed,
      is_overdue: !completed && slotEndMs < nowMs,
    };
  });
}

export function getDashboardNextMilestones(
  milestones: CommunityCampaignMilestoneRow[],
  nowMs: number = Date.now(),
): CommunityCampaignMilestoneRow[] {
  const active = getActiveMilestone(milestones, nowMs);
  const upcoming = getUpcomingMilestone(milestones, nowMs);
  const result: CommunityCampaignMilestoneRow[] = [];
  if (active) result.push(active);
  if (upcoming && upcoming.milestone_id !== active?.milestone_id) {
    result.push(upcoming);
  }
  return result.slice(0, 2);
}
