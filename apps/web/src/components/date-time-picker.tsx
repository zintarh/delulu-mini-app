"use client";

import { useState, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import "react-day-picker/dist/style.css";

interface DateTimePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  minDate,
  maxDate,
  className,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(value);

  // Sync with external value changes
  useEffect(() => {
    if (value && (!selectedDate || value.getTime() !== selectedDate.getTime())) {
      setSelectedDate(value);
    }
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(null);
      onChange(null);
      return;
    }

    // Set to end of day (23:59:59 UTC) - industry standard for prediction markets
    // Use UTC methods to avoid timezone issues
    const newDate = new Date(date);
    newDate.setUTCHours(23, 59, 59, 999);

    setSelectedDate(newDate);
    onChange(newDate);
  };

  // Calculate min date (at least 24 hours from now)
  const effectiveMinDate = minDate || (() => {
    const date = new Date();
    date.setHours(date.getHours() + 24);
    return date;
  })();

  // Calculate max date (1 year from now)
  const effectiveMaxDate = maxDate || (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date;
  })();

  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      {/* Date Picker */}
      <div className="bg-card rounded-2xl px-3 border py-6 border-border text-foreground shadow-sm">
        <DayPicker
          mode="single"
          selected={selectedDate || undefined}
          onSelect={handleDateSelect}
          disabled={(date) => {
            // Disable dates before min date
            const dateOnly = new Date(date);
            dateOnly.setHours(0, 0, 0, 0);
            const minDateOnly = new Date(effectiveMinDate);
            minDateOnly.setHours(0, 0, 0, 0);
            if (dateOnly < minDateOnly) return true;

            // Disable dates after max date
            const maxDateOnly = new Date(effectiveMaxDate);
            maxDateOnly.setHours(23, 59, 59, 999);
            if (dateOnly > maxDateOnly) return true;

            return false;
          }}
          className="w-full"
          classNames={{
            months:
              "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-2",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-bold text-foreground",
            nav: "space-x-1 flex items-center",
            // Month navigation controls – align icon colors with theme
            nav_button: cn(
              "h-6 w-6 bg-transparent p-0 rounded-full",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              "opacity-80 hover:opacity-100",
              "transition-all duration-150"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-muted-foreground font-bold text-xs w-8",
            row: "flex w-full mt-1",
            cell:
              "text-center text-xs p-0 relative [&:has([aria-selected])]:bg-muted first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20",
            day: cn(
              "h-8 w-8 p-0 font-bold text-foreground text-sm",
              "hover:bg-muted rounded-full",
              "transition-all duration-150",
              "aria-selected:opacity-100",
              "focus:bg-muted focus:outline-none"
            ),
            day_selected: cn(
              "bg-delulu-charcoal text-white",
              "hover:bg-delulu-charcoal hover:text-white",
              "focus:bg-delulu-charcoal focus:text-white"
            ),
            // Today indicator: use a black ring instead of yellow
            day_today:
              "bg-background text-foreground font-black border-2 border-delulu-charcoal",
            day_disabled: "text-muted-foreground/40 cursor-not-allowed",
            day_outside: "text-muted-foreground/60",
            day_hidden: "invisible",
          }}
        />
      </div>

   
    </div>
  );
}
