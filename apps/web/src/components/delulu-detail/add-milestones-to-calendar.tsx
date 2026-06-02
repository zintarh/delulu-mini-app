"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GraphMilestone } from "@/hooks/graph/useGraphDelulu";
import {
  buildGoogleCalendarUrl,
  buildMilestoneCalendarEvents,
  buildMilestonesIcsCalendar,
  downloadIcsFile,
  getNextOpenMilestoneEvent,
} from "@/lib/milestone-calendar-export";

export interface AddMilestonesToCalendarProps {
  deluluId: string;
  deluluTitle: string;
  deluluCreatedAt?: Date;
  deluluStakingDeadline?: Date;
  milestones: GraphMilestone[];
  endTimesMs: number[];
  className?: string;
}

export function AddMilestonesToCalendar({
  deluluId,
  deluluTitle,
  deluluCreatedAt,
  deluluStakingDeadline,
  milestones,
  endTimesMs,
  className,
}: AddMilestonesToCalendarProps) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [deluluPageUrl, setDeluluPageUrl] = useState(
    () =>
      `${(process.env.NEXT_PUBLIC_URL || "https://staydelulu.xyz").replace(/\/$/, "")}/delulu/${deluluId}`,
  );

  useEffect(() => {
    setDeluluPageUrl(`${window.location.origin}/delulu/${deluluId}`);
  }, [deluluId]);

  const events = useMemo(
    () =>
      buildMilestoneCalendarEvents(
        milestones,
        { createdAt: deluluCreatedAt, stakingDeadline: deluluStakingDeadline },
        deluluTitle || "Delulu",
        deluluPageUrl,
        { endTimesMs },
      ),
    [
      milestones,
      endTimesMs,
      deluluCreatedAt,
      deluluStakingDeadline,
      deluluTitle,
      deluluPageUrl,
    ],
  );

  const nextEvent = useMemo(
    () => getNextOpenMilestoneEvent(events, milestones),
    [events, milestones],
  );

  if (events.length === 0) return null;

  const safeFilename = `delulu-milestones-${deluluPageUrl.split("/").pop() ?? "export"}.ics`;

  const handleDownloadAll = () => {
    const ics = buildMilestonesIcsCalendar(events, {
      calendarName: deluluTitle ? `${deluluTitle} — Delulu` : "Delulu milestones",
      reminderMinutesBefore: 60,
    });
    downloadIcsFile(ics, safeFilename);
    setHint(
      "Calendar file downloaded. On your phone, open it and choose Google Calendar to import all milestones with reminders.",
    );
    setOpen(false);
  };

  const handleOpenGoogleNext = () => {
    if (!nextEvent) {
      handleDownloadAll();
      return;
    }
    window.open(buildGoogleCalendarUrl(nextEvent), "_blank", "noopener,noreferrer");
    setHint("Opened the next milestone in Google Calendar. Use “Download all” to add every step.");
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5",
          "text-[11px] font-semibold text-foreground transition-colors hover:bg-secondary/80",
          "sm:text-xs",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-delulu-blue" strokeWidth={2.25} />
        Google Calendar
        <ChevronDown
          className={cn("h-3.5 w-3.5 opacity-60 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Close calendar menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 top-full z-40 mt-1.5 w-[min(100vw-2rem,17rem)] rounded-xl border border-border bg-card p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleDownloadAll}
              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-muted/80"
            >
              <Download className="mt-0.5 h-4 w-4 shrink-0 text-delulu-blue" />
              <span>
                <span className="block font-bold text-foreground">Add all milestones</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                  Downloads {events.length} events with 1h phone reminders (import into Google
                  Calendar).
                </span>
              </span>
            </button>
            {nextEvent ? (
              <button
                type="button"
                role="menuitem"
                onClick={handleOpenGoogleNext}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-muted/80"
              >
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-delulu-blue" />
                <span>
                  <span className="block font-bold text-foreground">Next milestone only</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                    Opens Google Calendar for: {nextEvent.title}
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {hint ? (
        <p className="mt-2 max-w-xs text-[10px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
