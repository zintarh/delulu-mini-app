"use client";

import { useEffect, useMemo, useRef } from "react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface DurationDayStripProps {
  /** Currently selected end-of-day date, or null. */
  value: Date | null;
  /** Fires with the end-of-day moment for the tapped day. */
  onChange: (date: Date) => void;
  /** Earliest day in the strip is minDate + 1 (i.e. "Tomorrow"). */
  minDate: Date;
  /** How many days to render — a scrollable row, not a full calendar. */
  daysAhead?: number;
  className?: string;
}

function toLocalEndOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

/**
 * A single scrollable row of days, not a month grid — deliberately not "a
 * calendar." Covers the same ground as the old preset buttons + full
 * month-picker combined (this app's own presets never went past 7 days, and
 * a scrollable strip out to ~2 months covers everything realistic beyond
 * that) in a fraction of the vertical space.
 */
export function DurationDayStrip({
  value,
  onChange,
  minDate,
  daysAhead = 60,
  className,
}: DurationDayStripProps) {
  const selected = value ? startOfDay(value) : null;
  const days = useMemo(
    () => Array.from({ length: daysAhead }, (_, i) => addDays(minDate, i + 1)),
    [minDate, daysAhead],
  );
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Keep the selected day in view — the default selection can otherwise
  // start scrolled off the right edge (e.g. the 7-day default).
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [value]);

  return (
    <div
      className={cn(
        "scrollbar-hide flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 pt-0.5",
        className,
      )}
    >
      {days.map((day, i) => {
        const isSelected = selected ? isSameDay(day, selected) : false;
        return (
          <button
            key={day.toISOString()}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            onClick={() => onChange(toLocalEndOfDay(day))}
            aria-pressed={isSelected}
            className={cn(
              "flex shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl border px-3.5 py-2.5 transition-all duration-150",
              isSelected
                ? "scale-105 border-delulu-blue bg-delulu-blue text-white shadow-lg shadow-delulu-blue/30"
                : "border-border/60 bg-card text-foreground hover:border-delulu-blue/40 hover:bg-delulu-blue/5",
            )}
            style={{ minWidth: 52 }}
          >
            <span
              className={cn(
                "text-[9px] font-bold uppercase tracking-wide",
                isSelected ? "text-white/80" : "text-muted-foreground",
              )}
            >
              {i === 0 ? "Tmrw" : format(day, "EEE")}
            </span>
            <span className="text-base font-black tabular-nums">{format(day, "d")}</span>
          </button>
        );
      })}
    </div>
  );
}
