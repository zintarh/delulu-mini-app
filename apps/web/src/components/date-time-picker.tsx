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
        "relative mx-auto w-full max-w-[300px] overflow-hidden rounded-[28px] border border-border/50 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]",
        "bg-gradient-to-b from-delulu-blue-light/70 via-card to-card dark:from-delulu-blue/10 dark:via-card dark:to-card",
        className,
      )}
    >
      {/* Soft accent glow — the thing that keeps this from reading as a plain OS calendar grid. */}
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full opacity-60 blur-2xl"
        style={{
          background:
            "radial-gradient(circle, var(--delulu-blue) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canGoPrev}
          onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-delulu-charcoal text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <p
          className="text-[15px] font-black tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          {format(visibleMonth, "MMMM yyyy")}
        </p>
        <button
          type="button"
          aria-label="Next month"
          disabled={!canGoNext}
          onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-delulu-charcoal text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      <div className="relative mb-1.5 grid grid-cols-7">
        {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
          <div
            key={`${label}-${i}`}
            className="flex h-6 items-center justify-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/50"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="relative grid grid-cols-7 gap-y-1">
        {weeks.flatMap((week) =>
          week.map((day) => {
            const inMonth = isSameMonth(day, visibleMonth);
            const disabled = isDisabled(day);
            const selectedDay = selected ? isSameDay(day, selected) : false;
            const today = isToday(day);

            return (
              <div key={day.toISOString()} className="flex items-center justify-center">
                <button
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
                    "relative flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold transition-all duration-150",
                    !inMonth && "text-muted-foreground/25",
                    inMonth && !selectedDay && !disabled && "text-foreground hover:scale-105 hover:bg-delulu-blue/10",
                    today && !selectedDay && inMonth && "bg-delulu-yellow-reserved/20 text-foreground",
                    selectedDay &&
                      "scale-105 bg-delulu-blue font-black text-white shadow-lg shadow-delulu-blue/40 hover:bg-delulu-blue",
                    disabled && "cursor-not-allowed text-muted-foreground/20",
                  )}
                >
                  {format(day, "d")}
                  {today && !selectedDay ? (
                    <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-delulu-blue" aria-hidden />
                  ) : null}
                </button>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
