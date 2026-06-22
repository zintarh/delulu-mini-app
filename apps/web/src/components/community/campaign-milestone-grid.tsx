"use client";

import { cn } from "@/lib/utils";

export type ProofSubmissionRecord = {
  submitted_at: string;
  status: "approved" | "rejected";
  points_awarded: number;
};

function sameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function sameWeek(slotStartMs: number, submittedAt: Date) {
  const slotEnd = slotStartMs + 7 * 24 * 60 * 60 * 1000;
  const ms = submittedAt.getTime();
  return ms >= slotStartMs && ms < slotEnd;
}

type SlotState = "approved" | "missed" | "today" | "future" | "before-joined";

interface Slot {
  state: SlotState;
}

export function CampaignMilestoneGrid({
  submissions,
  totalMilestones,
  proofCadence,
  displayEndsAt,
  durationDays,
  joinedAt,
  myStreak,
  myPoints,
  myRank,
  totalParticipants,
}: {
  submissions: ProofSubmissionRecord[];
  totalMilestones: number;
  proofCadence: string;
  displayEndsAt: string | null;
  durationDays: number;
  joinedAt: string | null;
  myStreak?: number;
  myPoints?: number;
  myRank?: number;
  totalParticipants?: number;
}) {
  const isWeekly = proofCadence === "weekly";
  const now = new Date();

  // Derive campaign start date
  const endMs = displayEndsAt
    ? new Date(displayEndsAt).getTime()
    : now.getTime() + durationDays * 86400000;
  const startMs = endMs - durationDays * 86400000;
  const joinedAtMs = joinedAt ? new Date(joinedAt).getTime() : startMs;

  const approvedDates = submissions
    .filter((s) => s.status === "approved")
    .map((s) => new Date(s.submitted_at));

  const completedCount = approvedDates.length;

  // Build slots
  const slots: Slot[] = [];

  if (isWeekly) {
    for (let i = 0; i < totalMilestones; i++) {
      const slotStartMs = startMs + i * 7 * 86400000;
      const slotEndMs = slotStartMs + 7 * 86400000;
      const isBeforeJoined = slotStartMs < joinedAtMs;
      const isFuture = slotStartMs > now.getTime();
      const isApproved = approvedDates.some((d) => sameWeek(slotStartMs, d));
      const isCurrentWeek = now.getTime() >= slotStartMs && now.getTime() < slotEndMs;

      if (isBeforeJoined) slots.push({ state: "before-joined" });
      else if (isApproved) slots.push({ state: "approved" });
      else if (isCurrentWeek) slots.push({ state: "today" });
      else if (isFuture) slots.push({ state: "future" });
      else slots.push({ state: "missed" });
    }
  } else {
    for (let i = 0; i < totalMilestones; i++) {
      const slotDate = new Date(startMs + i * 86400000);
      const isBeforeJoined = slotDate.getTime() < joinedAtMs;
      const isFuture = slotDate.getTime() > now.getTime();
      const isApproved = approvedDates.some((d) => sameDay(d, slotDate));
      const isTodaySlot = sameDay(slotDate, now);

      if (isBeforeJoined) slots.push({ state: "before-joined" });
      else if (isApproved) slots.push({ state: "approved" });
      else if (isTodaySlot) slots.push({ state: "today" });
      else if (isFuture) slots.push({ state: "future" });
      else slots.push({ state: "missed" });
    }
  }

  // Group into rows of 7
  const rows: Slot[][] = [];
  for (let i = 0; i < slots.length; i += 7) {
    rows.push(slots.slice(i, i + 7));
  }

  function dotClass(slot: Slot) {
    switch (slot.state) {
      case "approved":
        return "bg-delulu-blue";
      case "today":
        return "ring-2 ring-delulu-blue bg-delulu-blue/10 animate-pulse";
      case "missed":
        return "bg-muted border-2 border-border";
      case "before-joined":
      case "future":
      default:
        return "bg-muted/40";
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Your journey
      </p>

      {/* Dot grid */}
      <div className="space-y-1.5">
        {rows.map((row, wi) => (
          <div key={wi} className="flex gap-1.5">
            {row.map((slot, di) => (
              <div
                key={di}
                className={cn("h-5 w-5 rounded-full", dotClass(slot))}
                title={slot.state}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-foreground">
          {completedCount}/{totalMilestones} milestones
        </span>
        {(myStreak ?? 0) > 0 && (
          <span className="font-semibold text-orange-500">🔥 {myStreak} streak</span>
        )}
        {myRank && totalParticipants ? (
          <span className="text-muted-foreground">
            #{myRank} of {totalParticipants}
          </span>
        ) : null}
        {(myPoints ?? 0) > 0 && (
          <span className="text-muted-foreground">{myPoints} pts</span>
        )}
      </div>

      {/* Next milestone nudge */}
      <p className="mt-2 text-xs text-muted-foreground">
        {isWeekly
          ? "Submit your weekly milestone anytime this week."
          : "Submit your daily milestone to keep the streak going."}
      </p>
    </div>
  );
}
