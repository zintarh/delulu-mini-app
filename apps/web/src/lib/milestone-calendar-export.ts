import {
  getDeluluCreatedAtMs,
  getMilestoneEndTimeMs,
  getMilestoneLabel,
  MS_PER_DAY,
  type MilestoneWithDeadline,
} from "@/lib/milestone-utils";

export type MilestoneCalendarInput = MilestoneWithDeadline & {
  milestoneId: string;
  milestoneURI?: string | null;
  isVerified?: boolean;
  isSubmitted?: boolean;
  isMissed?: boolean;
};

export type MilestoneCalendarEvent = {
  milestoneId: string;
  title: string;
  deluluTitle: string;
  startMs: number;
  endMs: number;
  durationLabel: string;
  statusLabel: string;
  proofUrl: string;
};

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcsUtc(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function formatDurationLabel(startMs: number, endMs: number): string {
  const diffMs = Math.max(0, endMs - startMs);
  const days = Math.round((diffMs / MS_PER_DAY) * 10) / 10;
  if (days >= 1) {
    const rounded = Math.round(days);
    return rounded === 1 ? "1 day" : `${rounded} days`;
  }
  const hours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

function milestoneStatusLabel(m: MilestoneCalendarInput): string {
  if (m.isVerified) return "Completed";
  if (m.isMissed) return "Missed";
  if (m.isSubmitted) return "Under review";
  return "Due — submit proof";
}

/** Build calendar rows using the same end-time chain as the delulu page. */
export function buildMilestoneCalendarEvents(
  milestones: MilestoneCalendarInput[],
  delulu: { createdAt?: Date; stakingDeadline?: Date },
  deluluTitle: string,
  deluluPageUrl: string,
  options?: { endTimesMs?: number[]; nowMs?: number },
): MilestoneCalendarEvent[] {
  if (!milestones.length) return [];

  const nowMs = options?.nowMs ?? Date.now();
  const sorted = [...milestones].sort(
    (a, b) => Number(a.milestoneId) - Number(b.milestoneId),
  );
  const createdAtMs = getDeluluCreatedAtMs(delulu, nowMs);
  const events: MilestoneCalendarEvent[] = [];
  let prevEndMs: number | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i]!;
    const computedEndMs = getMilestoneEndTimeMs(m, prevEndMs, createdAtMs);
    const endMs: number = options?.endTimesMs?.[i] ?? computedEndMs;
    prevEndMs = endMs;

    const chainStartMs = i === 0 ? createdAtMs : (events[i - 1]?.endMs ?? createdAtMs);
    const startMs =
      m.startTime && m.startTime.getTime() > 0
        ? m.startTime.getTime()
        : chainStartMs;

    const safeStartMs = Math.min(startMs, endMs - 60_000);
    const label = getMilestoneLabel(m, 120);
    const proofUrl = `${deluluPageUrl.replace(/\/$/, "")}?milestone=${m.milestoneId}`;

    events.push({
      milestoneId: m.milestoneId,
      title: label,
      deluluTitle,
      startMs: safeStartMs,
      endMs,
      durationLabel: formatDurationLabel(safeStartMs, endMs),
      statusLabel: milestoneStatusLabel(m),
      proofUrl,
    });
  }

  return events;
}

export function buildGoogleCalendarUrl(event: MilestoneCalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `[Delulu] ${event.title}`,
    dates: `${formatIcsUtc(event.startMs)}/${formatIcsUtc(event.endMs)}`,
    details: [
      event.deluluTitle,
      `Duration: ${event.durationLabel}`,
      `Status: ${event.statusLabel}`,
      "",
      "Submit proof on Delulu:",
      event.proofUrl,
    ].join("\n"),
    location: event.proofUrl,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildMilestonesIcsCalendar(
  events: MilestoneCalendarEvent[],
  options?: { calendarName?: string; reminderMinutesBefore?: number },
): string {
  const name = options?.calendarName ?? "Delulu milestones";
  const reminderMin = options?.reminderMinutesBefore ?? 60;
  const stamp = formatIcsUtc(Date.now());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Delulu//Milestones//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(name)}`,
  ];

  for (const event of events) {
    const uid = `delulu-milestone-${event.milestoneId}-${event.endMs}@staydelulu.xyz`;
    const description = escapeIcsText(
      [
        event.deluluTitle,
        `Duration: ${event.durationLabel}`,
        `Status: ${event.statusLabel}`,
        "",
        "Submit proof:",
        event.proofUrl,
      ].join("\n"),
    );

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatIcsUtc(event.startMs)}`,
      `DTEND:${formatIcsUtc(event.endMs)}`,
      `SUMMARY:${escapeIcsText(`[Delulu] ${event.title}`)}`,
      `DESCRIPTION:${description}`,
      `URL:${event.proofUrl}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `TRIGGER:-PT${reminderMin}M`,
      "DESCRIPTION:Milestone due soon on Delulu",
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcsFile(icsContent: string, filename: string) {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Next milestone that is not yet verified (for single-event Google link). */
export function getNextOpenMilestoneEvent(
  events: MilestoneCalendarEvent[],
  milestones: MilestoneCalendarInput[],
  nowMs: number = Date.now(),
): MilestoneCalendarEvent | null {
  const byId = new Map(events.map((e) => [e.milestoneId, e]));
  const sorted = [...milestones].sort(
    (a, b) => Number(a.milestoneId) - Number(b.milestoneId),
  );

  for (const m of sorted) {
    if (m.isVerified) continue;
    const event = byId.get(m.milestoneId);
    if (!event) continue;
    if (event.endMs > nowMs) return event;
  }

  for (const m of sorted) {
    if (m.isVerified) continue;
    const event = byId.get(m.milestoneId);
    if (event) return event;
  }

  return null;
}
