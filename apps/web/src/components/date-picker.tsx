"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import "react-day-picker/dist/style.css";

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(value);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(null);
      onChange(null);
      return;
    }

    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);

    setSelectedDate(newDate);
    onChange(newDate);
  };

  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-3 border py-6 border-white/20 text-white shadow-sm">
        <DayPicker
          mode="single"
          selected={selectedDate || undefined}
          onSelect={handleDateSelect}
          disabled={(date) => {
            if (minDate && date < minDate) return true;
            if (maxDate && date > maxDate) return true;
            return false;
          }}
          className="w-full"
          classNames={{
            months:
              "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-2",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-base font-bold text-white",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
              "text-white hover:bg-gray-100 rounded-full",
              "transition-all duration-150"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-gray-500 font-bold text-xs w-8",
            row: "flex w-full mt-1",
            cell: "text-center text-xs p-0 relative [&:has([aria-selected])]:bg-gray-100 first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20",
            day: cn(
              "h-8 w-8 p-0 font-bold text-white/80 text-sm",
              "hover:bg-black/20 rounded-full",
              "transition-all duration-150",
              "aria-selected:opacity-100",
              "focus:bg-gray-200 focus:outline-none"
            ),
            day_selected: cn(
              "bg-delulu-yellow-reserved text-delulu-charcoal",
              "hover:bg-delulu-yellow-reserved hover:text-delulu-charcoal",
              "focus:bg-delulu-yellow-reserved focus:text-delulu-charcoal"
            ),
            day_today:
              "bg-white text-delulu-charcoal font-black border-2 border-delulu-yellow-reserved",
            day_disabled: "text-gray-300 cursor-not-allowed",
            day_outside: "text-gray-400",
            day_hidden: "invisible",
          }}
        />
      </div>
    </div>
  );
}
