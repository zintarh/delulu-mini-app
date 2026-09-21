"use client";

import { useState } from "react";
import { ChevronDown, Circle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReferralEligibilitySteps } from "@/lib/referral/eligibility";
import { ONBOARDING_STEP_LABELS } from "@/components/referral-onboarding-checklist";

/** "3/5" badge that expands into the same onboarding checklist used elsewhere — click to see exactly what's missing. */
export function OnboardingProgressCell({ steps }: { steps: ReferralEligibilitySteps | null }) {
  const [open, setOpen] = useState(false);

  if (!steps) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const completed = ONBOARDING_STEP_LABELS.filter(({ key }) => steps[key]).length;
  const total = ONBOARDING_STEP_LABELS.length;
  const fullyOnboarded = completed === total;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold tabular-nums transition-colors",
          fullyOnboarded
            ? "bg-emerald-500/10 text-emerald-700"
            : "bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        {completed}/{total}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <ul className="mt-1.5 w-56 space-y-1 rounded-lg border border-border/60 bg-secondary/30 p-2.5">
          {ONBOARDING_STEP_LABELS.map(({ key, label }) => {
            const done = Boolean(steps[key]);
            return (
              <li
                key={key}
                className={cn(
                  "flex items-center gap-1.5 text-[11px]",
                  done ? "text-delulu-green" : "text-muted-foreground",
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0" strokeWidth={2} />
                ) : (
                  <Circle className="h-3 w-3 shrink-0" strokeWidth={2} />
                )}
                {label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
