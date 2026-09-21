"use client";

import { useState } from "react";
import { ChevronDown, Circle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReferralEligibilitySteps } from "@/lib/referral/eligibility";

const STEP_LABELS: { key: keyof ReferralEligibilitySteps; label: string }[] = [
  { key: "verified", label: "Do a face verification" },
  { key: "claimedUbi", label: "Claim your daily G$" },
  { key: "profileSetup", label: "Set up your profile" },
  { key: "claimedGift", label: "Claim your 1,000 G$ welcome gift" },
  { key: "completedCampaign", label: "Join a campaign worth 1,000 G$" },
];

/**
 * Shown in place of the referral link/copy button until the wallet has
 * finished the full onboarding checklist — sharing a link before that
 * produces "referrers" who never engaged with the app themselves.
 */
export function ReferralOnboardingChecklist({
  steps,
}: {
  steps: ReferralEligibilitySteps | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-1.5 text-xs font-bold text-muted-foreground"
      >
        Complete onboarding to get your referral link
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <ul className="mt-1 w-full max-w-[280px] space-y-1.5 rounded-xl border border-border/60 bg-secondary/30 p-3">
          {STEP_LABELS.map(({ key, label }) => {
            const done = Boolean(steps?.[key]);
            return (
              <li
                key={key}
                className={cn(
                  "flex items-center gap-2 text-xs",
                  done ? "text-delulu-green" : "text-muted-foreground",
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                )}
                <span className={done ? "line-through decoration-1" : undefined}>{label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
