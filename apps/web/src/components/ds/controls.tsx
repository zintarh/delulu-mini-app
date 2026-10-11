"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Segmented control (pill tabs). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (_value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("grid gap-1 rounded-2xl bg-[#ecece7] p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-10 rounded-xl text-sm font-semibold transition-colors",
              on ? "bg-ink text-white shadow-[0_3px_0_#000]" : "text-muted-foreground hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Selectable chip (quick-start templates, toggles). */
export function Chip({
  selected = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "press-edge inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-[14px] border-2 px-4 text-sm font-semibold",
        selected ? "border-ink bg-ink text-white shadow-[0_3px_0_#000]" : "border-line bg-white text-ink shadow-edge-sm",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Big tappable option tile used inside bottom sheets. */
export function OptionTile({
  selected = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "press-edge min-h-14 rounded-2xl border-2 px-3.5 text-[15px] font-semibold disabled:cursor-default disabled:border-dashed disabled:bg-transparent disabled:text-faint disabled:shadow-none",
        selected ? "border-ink bg-ink text-white shadow-[0_3px_0_#000]" : "border-line bg-white text-ink shadow-edge-sm",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** On/off switch (ink + yellow knob when on). */
export function GameSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (_value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("flex h-7 w-12 shrink-0 rounded-full p-[3px] transition-colors", checked ? "bg-ink" : "bg-[#d6d6cf]")}
    >
      <span
        className={cn(
          "h-[22px] w-[22px] rounded-full shadow transition-transform duration-300",
          checked ? "translate-x-5 bg-yellow" : "bg-white",
        )}
      />
    </button>
  );
}
