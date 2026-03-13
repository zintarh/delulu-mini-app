"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type PillVariant = "solid" | "outline" | "muted";
type PillSize = "sm" | "md";

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  asChild?: boolean;
  variant?: PillVariant;
  size?: PillSize;
}

export const Pill = React.forwardRef<HTMLSpanElement, PillProps>(
  (
    {
      asChild,
      className,
      variant = "muted",
      size = "sm",
      ...props
    }: PillProps,
    ref
  ) => {
    const Comp = asChild ? Slot : "span";

    const base =
      "inline-flex items-center rounded-full border font-medium whitespace-nowrap";

    const variantClasses: Record<PillVariant, string> = {
      solid:
        "bg-delulu-yellow-reserved text-delulu-charcoal border-delulu-charcoal",
      outline: "bg-background text-foreground border-border",
      muted: "bg-muted text-muted-foreground border-border/70",
    };

    const sizeClasses: Record<PillSize, string> = {
      sm: "px-2 py-0.5 text-[11px] gap-1",
      md: "px-3 py-1 text-xs gap-1.5",
    };

    return (
      <Comp
        ref={ref}
        className={cn(base, variantClasses[variant], sizeClasses[size], className)}
        {...props}
      />
    );
  }
);

Pill.displayName = "Pill";

