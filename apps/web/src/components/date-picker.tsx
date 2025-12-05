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
    
    // Set time to end of day (23:59:59) for the deadline
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    
    setSelectedDate(newDate);
    onChange(newDate);
  };

  return (
    <div className={cn("w-full max-w-sm mx-auto", className)}>
      <div className="bg-white rounded-2xl border-2 border-delulu-dark p-4 shadow-[0_4px_0_0_#0a0a0a]">
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
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-2",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-base font-bold text-delulu-dark",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
              "text-delulu-dark hover:bg-delulu-purple/10 rounded-full",
              "transition-all duration-150"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-delulu-dark/50 font-bold text-xs w-8",
            row: "flex w-full mt-1",
            cell: "text-center text-xs p-0 relative [&:has([aria-selected])]:bg-delulu-purple/10 first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20",
            day: cn(
              "h-8 w-8 p-0 font-bold text-delulu-dark text-sm",
              "hover:bg-delulu-purple/10 rounded-full",
              "transition-all duration-150",
              "aria-selected:opacity-100",
              "focus:bg-delulu-purple/20 focus:outline-none"
            ),
            day_selected: cn(
              "bg-delulu-purple text-white",
              "hover:bg-delulu-purple hover:text-white",
              "focus:bg-delulu-purple focus:text-white"
            ),
            day_today: "bg-delulu-yellow/20 text-delulu-dark font-black border-2 border-delulu-purple",
            day_disabled: "text-delulu-dark/20 cursor-not-allowed",
            day_outside: "text-delulu-dark/30",
            day_hidden: "invisible",
          }}
          components={{
            IconLeft: () => <span className="text-delulu-dark">‹</span>,
            IconRight: () => <span className="text-delulu-dark">›</span>,
          }}
        />
      </div>
    </div>
  );
}

