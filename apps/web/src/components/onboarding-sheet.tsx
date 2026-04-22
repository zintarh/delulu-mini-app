"use client";

import { useState } from "react";
import Link from "next/link";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface OnboardingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  {
    title: "What is Delulu?",
    body: (
      <>
        <p className="text-sm text-muted-foreground mb-3">
          <span className="font-semibold">Delulu</span> is a platform where you create{" "}
          <span className="font-semibold">goals (delulus)</span>, set milestones, and let others{" "}
          <span className="font-semibold">support / buy shares</span> to earn as you achieve them.
        </p>
        <p className="text-sm text-muted-foreground">
          To keep your <span className="font-semibold">Support button</span> and{" "}
          <span className="font-semibold">shares</span> open, you need to{" "}
          <span className="font-semibold">complete milestones</span>. Missing one pauses new support.
        </p>
      </>
    ),
  },
  {
    title: "Claim your G$",
    body: (
      <>
        <p className="text-sm text-muted-foreground mb-3">
          You need <span className="font-semibold">at least 100 G$</span> to create a delulu.
        </p>
        <p className="text-sm text-muted-foreground">
          On the{" "}
          <Link
            href="/daily-claim"
            className="font-semibold text-delulu-yellow-reserved underline-offset-2 hover:underline"
          >
            Claim
          </Link>{" "}
          page: first <span className="font-semibold">claim gas</span>, then{" "}
          <span className="font-semibold">claim your daily G$ UBI</span>.
        </p>
      </>
    ),
  },
  {
    title: "Create your first delulu",
    body: (
      <>
        <p className="text-sm text-muted-foreground mb-3">
          <span className="font-semibold">Sign up / sign in</span>, then hit{" "}
          <Link
            href="/"
            className="font-semibold text-delulu-yellow-reserved underline-offset-2 hover:underline"
          >
            Create
          </Link>{" "}
          to launch.
        </p>
        <p className="text-sm text-muted-foreground">
          Add clear <span className="font-semibold">milestones</span>, submit{" "}
          <span className="font-semibold">proof</span>, and let others{" "}
          <span className="font-semibold">support or buy shares</span> in your journey.
        </p>
      </>
    ),
  },
];

export function OnboardingSheet({ open, onOpenChange }: OnboardingSheetProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const { login } = useAuth();

  const handleNext = () => {
    if (isLast) {
      // On the final step, "Get Started" is handled by a separate button.
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleChange = (openValue: boolean) => {
    if (!openValue) {
      // When closed from outside controls, reset to first step for next time.
      setStepIndex(0);
    }
    onOpenChange(openValue);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={handleChange}
      title=""
      sheetClassName={cn(
        "border-t border-border max-h-[88vh] overflow-hidden p-0 rounded-t-3xl",
        "bg-secondary/95 backdrop-blur-xl",
        "shadow-[0_24px_80px_rgba(0,0,0,0.75)]",
        "[&>button]:text-foreground [&>button]:bg-transparent [&>button]:hover:bg-muted/60",
      )}
      modalClassName="max-w-xl"
    >
      <div className="flex flex-col h-full bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.10),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.10),_transparent_55%)]">
        <div className="px-6 pt-5 pb-4 border-b border-border/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-2">
                Onboarding
              </p>
              <h2 className="text-xl font-black text-foreground">Getting started</h2>
            </div>
            <div className="hidden sm:flex items-center gap-1 rounded-full border border-delulu-yellow-reserved/40 bg-delulu-yellow-reserved/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-delulu-yellow-reserved shadow-[0_0_0_3px_rgba(250,204,21,0.35)]" />
              {/* <span className="text-[11px] font-semibold text-foreground/80">
                New here? Start here
              </span> */}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          <div className="inline-flex items-center rounded-full bg-delulu-yellow-reserved/10 border border-delulu-yellow-reserved/40 px-3 py-1.5 mb-3">
            <span className="text-sm font-semibold text-delulu-yellow-reserved">
              {step.title}
            </span>
          </div>

          <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-background/80 via-background/40 to-background/80 px-5 py-4 shadow-neo-sm text-base text-foreground">
            {step.body}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/70 flex items-center justify-between gap-3 bg-secondary/95">
          <button
            type="button"
            onClick={handleBack}
            disabled={stepIndex === 0}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold border border-border text-muted-foreground",
              stepIndex === 0 && "opacity-40 cursor-default",
            )}
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                type="button"
                onClick={handleNext}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold",
                  "bg-muted text-foreground border border-border",
                  "hover:bg-muted/80 transition-colors",
                )}
              >
                Next
              </button>
            )}
            {isLast && (
              <button
                type="button"
                onClick={() => {
                  login();
                  onOpenChange(false);
                }}
                className={cn(
                  "px-5 py-2.5 rounded-full text-sm font-black",
                  "bg-delulu-yellow-reserved text-delulu-charcoal border border-delulu-charcoal",
                  "shadow-[2px_2px_0px_0px_#1A1A1A] hover:brightness-105 active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#1A1A1A]",
                )}
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </ResponsiveSheet>
  );
}

