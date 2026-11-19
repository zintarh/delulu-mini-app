"use client";

import { Children, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const LG = "(min-width: 1024px)";
const XL = "(min-width: 1280px)";

function subscribe(cb: () => void) {
  const lists = [LG, XL].map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", cb));
  return () => lists.forEach((l) => l.removeEventListener("change", cb));
}

/** Columns for the screen: 2 on phones and tablets, 3 on laptops, 4 on wide screens (when `wide`). */
function useColumns(wide: boolean, twoUp: boolean): number {
  return useSyncExternalStore(
    subscribe,
    () => (twoUp ? 2 : wide && window.matchMedia(XL).matches ? 4 : window.matchMedia(LG).matches ? 3 : 2),
    () => 2,
  );
}

/**
 * Pinterest-style board: cards dealt left, right, left, right into columns of
 * mixed-height cards (pinAspect() gives the rhythm). Dealt rather than CSS
 * `columns`, so two cards always sit side by side instead of stacking in one
 * column.
 */
export function PinBoard({
  children,
  className,
  twoUp = false,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Always two columns (small sets like Home's 4). */
  twoUp?: boolean;
  /** Four columns on wide screens (Explore). */
  wide?: boolean;
}) {
  const cols = useColumns(wide, twoUp);
  const items = Children.toArray(children);
  return (
    <div className={cn("grid items-start gap-3 sm:gap-4", className)} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols }, (_, col) => (
        <div key={col} className="flex min-w-0 flex-col gap-3 sm:gap-4">
          {items.filter((_, i) => i % cols === col)}
        </div>
      ))}
    </div>
  );
}

/**
 * Height rhythm for the i-th card: tall, square-ish, taller… never two identical rows.
 * Phones get taller shapes: a column there is only ~170px wide, and a squarer
 * card would leave the title and stake line covering most of it.
 */
const ASPECTS = [
  "aspect-[3/5] sm:aspect-[3/4]",
  "aspect-[2/3] sm:aspect-[4/5]",
  "aspect-[5/8] sm:aspect-[1/1]",
  "aspect-[4/7] sm:aspect-[2/3]",
  "aspect-[2/3] sm:aspect-[5/6]",
  "aspect-[3/5] sm:aspect-[3/4]",
  "aspect-[5/8] sm:aspect-[4/5]",
  "aspect-[2/3] sm:aspect-[9/10]",
];
export const pinAspect = (i: number) => ASPECTS[i % ASPECTS.length];
