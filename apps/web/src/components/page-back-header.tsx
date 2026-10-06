"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Round 44px icon button with a pressable edge (design: `.ibtn`). */
export const ICON_BUTTON_CLASS =
  "press-edge inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-line bg-white text-ink shadow-edge-sm";

/**
 * Sub-page header (design: Settings / Activity / Leaderboard artboards):
 * a row with the back button (and an optional action on the right), then
 * an optional mono eyebrow and the page title underneath.
 */
export function PageBackHeader({
  title,
  eyebrow,
  subtitle,
  right,
  onBack,
  className,
}: {
  title: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onBack?: () => void;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div className={cn("mx-auto max-w-xl px-5 pt-4", className)}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack ?? (() => router.back())} aria-label="Back" className={ICON_BUTTON_CLASS}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        {right ?? <span />}
      </div>
      <div className="pt-4">
        {eyebrow ? <span className="label-mono block text-muted-foreground">{eyebrow}</span> : null}
        <h1 className={cn("m-0 animate-rise text-2xl font-bold leading-[1.2] tracking-[-0.02em]", eyebrow && "mt-1")}>{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}
