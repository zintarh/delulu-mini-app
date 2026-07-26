"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

function toLocalEndOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

/**
 * Compact single-month date picker — no react-day-picker.
 * Designed to sit cleanly inside sheets/modals without dominating the viewport.
 */
export function DateTimePicker({
  value,
  onChange,
  minDate,
  maxDate,
  className,
}: DateTimePickerProps) {
  const selected = value ? startOfDay(value) : null;
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(value ?? new Date()),
  );

  const effectiveMin = useMemo(() => {
    if (minDate) return startOfDay(minDate);
    const d = new Date();
    d.setHours(d.getHours() + 24);
    return startOfDay(d);
  }, [minDate]);

  const effectiveMax = useMemo(() => {
    if (maxDate) return startOfDay(maxDate);
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return startOfDay(d);
  }, [maxDate]);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [visibleMonth]);

  const canGoPrev = !isBefore(endOfMonth(addMonths(visibleMonth, -1)), effectiveMin);
  const canGoNext = !isAfter(startOfMonth(addMonths(visibleMonth, 1)), effectiveMax);

  const isDisabled = (day: Date) => {
    const d = startOfDay(day);
    if (isBefore(d, effectiveMin)) return true;
    if (isAfter(d, effectiveMax)) return true;
    return false;
  };

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[280px] rounded-2xl border border-border/60 bg-card p-3 shadow-sm",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canGoPrev}
          onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p
          className="text-[13px] font-bold tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          {format(visibleMonth, "MMMM yyyy")}
        </p>
        <button
          type="button"
          aria-label="Next month"
          disabled={!canGoNext}
          onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
          <div
            key={`${label}-${i}`}
            className="flex h-6 items-center justify-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {weeks.flatMap((week) =>
          week.map((day) => {
            const inMonth = isSameMonth(day, visibleMonth);
            const disabled = isDisabled(day);
            const selectedDay = selected ? isSameDay(day, selected) : false;
            const today = isToday(day);

            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={disabled}
                aria-label={format(day, "PPP")}
                aria-pressed={selectedDay}
                onClick={() => {
                  if (disabled) return;
                  onChange(toLocalEndOfDay(day));
                  if (!isSameMonth(day, visibleMonth)) {
                    setVisibleMonth(startOfMonth(day));
                  }
                }}
                className={cn(
                  "flex h-8 w-full items-center justify-center rounded-full text-[12px] font-semibold transition-colors",
                  !inMonth && "text-muted-foreground/35",
                  inMonth && !selectedDay && !disabled && "text-foreground hover:bg-muted",
                  today && !selectedDay && inMonth && "ring-1 ring-delulu-charcoal/80",
                  selectedDay &&
                    "bg-delulu-charcoal font-bold text-white hover:bg-delulu-charcoal",
                  disabled && "cursor-not-allowed text-muted-foreground/30",
                )}
              >
                {format(day, "d")}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
