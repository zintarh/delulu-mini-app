/**
 * Shared milestone logic for delulu card and single delulu page.
 * Same query (useGraphDelulu), same calculations, same date/countdown format.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface MilestoneWithDeadline {
  startTime: Date | null;
  deadline: Date;
}

/**
 * End time in ms for a milestone. Uses milestone.deadline if set, else prev end + 1 day from delulu creation chain.
 */
export function getMilestoneEndTimeMs(
  milestone: MilestoneWithDeadline,
  prevEndTimeMs: number | null,
  deluluCreatedAtMs: number
): number {
  const deadlineMs = milestone.deadline.getTime();
  if (deadlineMs > 0) return deadlineMs;
  const startFrom = prevEndTimeMs ?? deluluCreatedAtMs;
  return startFrom + MS_PER_DAY;
}

/**
 * Duration in days from milestone startTime to endTimeMs. Matches delulu card calculation.
 */
export function getMilestoneDurationDays(
  m: MilestoneWithDeadline,
  endTimeMs: number
): number | null {
  if (m.startTime && m.startTime.getTime() > 0) {
    const startMs = m.startTime.getTime();
    const diffMs = endTimeMs - startMs;
    if (diffMs <= 0) return null;
    return Math.round((diffMs / MS_PER_DAY) * 100) / 100;
  }
  return null;
}

/**
 * Countdown string for display. Format: "Ended" | "Xd HH:MM:SS" | "HH:MM:SS".
 * Same as delulu card (formatTimeLeftWithSeconds).
 */
export function formatMilestoneCountdown(nowMs: number, targetMs: number): string {
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) return "Ended";
  const totalSeconds = Math.floor(diffMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const days = Math.floor(totalSeconds / 86400);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (days > 0) return `${days}d ${hms}`;
  return hms;
}

/**
 * Countdown in d:h:m:s format (e.g. "2:04:05:03" for 2d 4h 5m 3s). Single delulu page only.
 */
export function formatMilestoneCountdownDHMS(nowMs: number, targetMs: number): string {
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) return "0:00:00:00";
  const totalSeconds = Math.floor(diffMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const days = Math.floor(totalSeconds / 86400);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Time display as "Xd H:M:S" (e.g. "3d 4:05:04"). For countdown or duration.
 */
export function formatMilestoneTimeDisplayDHMS(nowMs: number, targetMs: number): string {
  const raw = formatMilestoneCountdownDHMS(nowMs, targetMs);
  const [d, h, m, s] = raw.split(":");
  return `${d}d ${h}:${m}:${s}`;
}

/**
 * Duration in days to "Xd H:M:S" (e.g. "2d 12:00:00") for past milestones.
 */
export function formatDurationDaysToDHMS(days: number): string {
  const totalSeconds = Math.round(days * 86400);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Default label for a milestone: milestoneURI or "Milestone N" (1-based from milestoneId). Max 50 chars on card; single page can use longer.
 */
export function getMilestoneLabel(
  milestone: { milestoneId: string; milestoneURI?: string | null },
  maxLength: number = 50
): string {
  const raw =
    (milestone.milestoneURI && milestone.milestoneURI.length > 0
      ? milestone.milestoneURI
      : `Milestone ${Number(milestone.milestoneId) + 1 || 1}`) || "";
  return raw.length > maxLength ? `${raw.slice(0, maxLength - 3)}…` : raw;
}

/**
 * Delulu created-at time in ms for milestone chain. Same fallback as card.
 */
export function getDeluluCreatedAtMs(delulu: { createdAt?: Date; stakingDeadline?: Date }, nowMs: number): number {
  if (delulu.createdAt && delulu.createdAt.getTime() > 0) {
    return delulu.createdAt.getTime();
  }
  if (delulu.stakingDeadline && delulu.stakingDeadline.getTime() > 0) {
    return delulu.stakingDeadline.getTime() - 7 * MS_PER_DAY;
  }
  return nowMs - 30 * MS_PER_DAY;
}
