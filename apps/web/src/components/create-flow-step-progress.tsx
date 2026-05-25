"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

export type CreateFlowStep = "dream" | "habits" | "manifest";

const STEPS: { key: CreateFlowStep; label: string }[] = [
  { key: "dream", label: "Dream" },
  { key: "habits", label: "Habits" },
  { key: "manifest", label: "Manifest" },
];

interface CreateFlowStepProgressProps {
  step: CreateFlowStep;
  className?: string;
}

export function CreateFlowStepProgress({ step, className }: CreateFlowStepProgressProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className={cn("flex flex-col gap-2", className)} aria-label="Create progress">
      <div className="flex items-center">
        {STEPS.map((s, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <Fragment key={s.key}>
              {index > 0 && (
                <div
                  className={cn(
                    "mx-1 h-0.5 flex-1 rounded-full transition-colors",
                    index <= currentIndex ? "bg-delulu-blue" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  (isComplete || isCurrent) && "bg-delulu-blue text-white",
                  !isComplete && !isCurrent && "bg-secondary text-muted-foreground",
                  isCurrent && "ring-2 ring-delulu-blue/25",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {index + 1}
              </div>
            </Fragment>
          );
        })}
      </div>
      <p className="text-xs font-semibold text-muted-foreground">
        Step {currentIndex + 1} of {STEPS.length} · {STEPS[currentIndex]?.label}
      </p>
    </div>
  );
}
