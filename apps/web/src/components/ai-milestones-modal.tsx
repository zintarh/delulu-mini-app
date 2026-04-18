"use client";

import { useState, useEffect, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { Loader2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DELULU_ABI } from "@/lib/abi";
import { getDeluluContractAddress } from "@/lib/constant";

interface AiMilestone {
  title: string;
  days: number;
}

interface AiMilestonesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deluluId: string | null;
  dreamTitle: string;
  durationDays: number;
  onDone: () => void;
}

const STEP_COLORS = [
  "bg-delulu-yellow-reserved text-delulu-charcoal",
  "bg-muted text-muted-foreground",
  "bg-foreground text-background",
  "bg-muted text-muted-foreground",
  "bg-muted text-muted-foreground",
] as const;

export function AiMilestonesModal({
  open,
  onOpenChange,
  deluluId,
  dreamTitle,
  durationDays,
  onDone,
}: AiMilestonesModalProps) {
  const chainId = useChainId();
  const maxDays = Math.max(1, durationDays);

  const [milestones, setMilestones] = useState<AiMilestone[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const fetchMilestones = useCallback(async () => {
    if (!dreamTitle) return;
    setIsLoadingAI(true);
    setAiError(null);
    setMilestones([]);
    try {
      const res = await fetch("/api/ai/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: dreamTitle, durationDays: maxDays }),
      });
      const data = await res.json();
      if (data.milestones?.length) {
        // Enforce duration cap on whatever AI returns
        const capped: AiMilestone[] = data.milestones.map((m: AiMilestone) => ({
          title: m.title,
          days: Math.max(1, Math.min(maxDays, m.days)),
        }));
        setMilestones(capped);
      } else {
        throw new Error("No milestones returned");
      }
    } catch {
      setAiError("Could not generate milestones. You can add them on the dream page.");
    } finally {
      setIsLoadingAI(false);
    }
  }, [dreamTitle, maxDays]);

  useEffect(() => {
    if (open) {
      reset();
      fetchMilestones();
    }
  }, [open, fetchMilestones, reset]);

  useEffect(() => {
    if (isSuccess) {
      const t = setTimeout(onDone, 900);
      return () => clearTimeout(t);
    }
  }, [isSuccess, onDone]);

  const updateTitle = (idx: number, value: string) =>
    setMilestones((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, title: value } : m))
    );

  const updateDays = (idx: number, delta: number) =>
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === idx
          ? { ...m, days: Math.max(1, Math.min(maxDays, m.days + delta)) }
          : m
      )
    );

  const handleSave = () => {
    if (!deluluId || milestones.length < 3) return;
    const mURIs = milestones.map((m) => m.title);
    const mDurations = milestones.map((m) =>
      BigInt(Math.max(1, m.days) * 24 * 60 * 60)
    );
    writeContract({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "addMilestones",
      args: [BigInt(deluluId), mURIs, mDurations],
    });
  };

  const isSaving = isPending || isConfirming;
  const canSave =
    !isSaving &&
    milestones.length >= 3 &&
    milestones.every((m) => m.title.trim().length > 0);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-200"
          )}
        />

        {/* Responsive: bottom sheet on mobile, centered modal on lg+ */}
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 bg-background outline-none flex flex-col",
            // Mobile — bottom sheet
            "bottom-0 left-0 right-0 max-h-[88vh]",
            "rounded-t-[28px] border-t border-border",
            // Desktop — centered modal
            "lg:bottom-auto lg:left-1/2 lg:right-auto lg:top-1/2",
            "lg:-translate-x-1/2 lg:-translate-y-1/2",
            "lg:w-[calc(100%-2rem)] lg:max-w-[420px]",
            "lg:rounded-3xl lg:border lg:max-h-[85vh]",
            // Animation
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "duration-300"
          )}
        >
          {/* Drag handle — mobile only */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0 lg:hidden">
            <div className="w-9 h-1 rounded-full bg-border" />
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="px-5 pt-4 pb-10 space-y-5">

              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4 space-y-0.5">
                  <p className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                    Commit to your dream
                  </p>
                  <h2 className="text-[18px] font-black leading-snug text-foreground line-clamp-2">
                    {dreamTitle}
                  </h2>
                </div>
                <DialogPrimitive.Close
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 hover:bg-muted/80 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </DialogPrimitive.Close>
              </div>

              {/* Duration context */}
              {!isLoadingAI && !aiError && milestones.length > 0 && (
                <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3.5 py-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-delulu-yellow-reserved flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Milestones must fall within your{" "}
                    <span className="font-semibold text-foreground">{maxDays}-day</span>{" "}
                    dream window
                  </p>
                </div>
              )}

              {/* Loading */}
              {isLoadingAI && (
                <div className="flex flex-col items-center justify-center gap-4 py-14">
                  <div className="w-14 h-14 rounded-2xl bg-delulu-yellow-reserved/15 border border-delulu-yellow-reserved/20 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-foreground/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Building your commitment plan</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Just a moment...</p>
                  </div>
                </div>
              )}

              {/* AI Error */}
              {aiError && !isLoadingAI && (
                <div className="bg-muted rounded-2xl px-5 py-6 text-center space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">{aiError}</p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={fetchMilestones}
                      className="text-xs font-semibold text-foreground underline"
                    >
                      Try again
                    </button>
                    <button
                      onClick={onDone}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Skip, add later
                    </button>
                  </div>
                </div>
              )}

              {/* Milestone cards */}
              {!isLoadingAI && !aiError && milestones.length > 0 && (
                <div className="space-y-2.5">
                  {milestones.map((m, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === milestones.length - 1;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-2xl border p-4 flex gap-3",
                          isFirst
                            ? "bg-delulu-yellow-reserved/[0.07] border-delulu-yellow-reserved/25"
                            : isLast
                              ? "bg-card border-foreground/10"
                              : "bg-card border-border"
                        )}
                      >
                        {/* Step number */}
                        <div
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 mt-0.5",
                            STEP_COLORS[Math.min(idx, STEP_COLORS.length - 1)]
                          )}
                        >
                          {isSuccess ? (
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          ) : (
                            idx + 1
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-2.5">
                          {/* Editable title */}
                          <input
                            type="text"
                            value={m.title}
                            onChange={(e) => updateTitle(idx, e.target.value)}
                            className={cn(
                              "w-full bg-transparent text-sm font-semibold text-foreground",
                              "focus:outline-none placeholder:text-muted-foreground/40",
                              "border-b border-transparent focus:border-border/60",
                              "pb-0.5 transition-colors leading-snug"
                            )}
                            placeholder="Describe this checkpoint..."
                          />

                          {/* Day stepper */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                              Day
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateDays(idx, -1)}
                                disabled={m.days <= 1}
                                className="w-6 h-6 rounded-md bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground font-bold text-base leading-none transition-colors disabled:opacity-30"
                              >
                                −
                              </button>
                              <span className="text-xs font-bold tabular-nums w-8 text-center text-foreground">
                                {m.days}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateDays(idx, 1)}
                                disabled={m.days >= maxDays}
                                className="w-6 h-6 rounded-md bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground font-bold text-base leading-none transition-colors disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Contract error */}
              {writeError && !isSaving && (
                <p className="text-xs text-destructive px-1">
                  {writeError.message?.split("(")[0]?.trim() ||
                    "Transaction failed. Please try again."}
                </p>
              )}

              {/* CTAs */}
              {!isLoadingAI && !aiError && milestones.length > 0 && (
                <div className="space-y-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={!canSave || isSuccess}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold text-sm transition-all",
                      "flex items-center justify-center gap-2",
                      isSuccess
                        ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20"
                        : "bg-delulu-yellow text-delulu-charcoal active:scale-[0.98]",
                      !canSave && !isSuccess && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {isSuccess ? (
                      <><Check className="w-4 h-4" strokeWidth={2.5} />All set</>
                    ) : isSaving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />{isConfirming ? "Saving on-chain..." : "Confirm in wallet..."}</>
                    ) : (
                      "Commit to this dream"
                    )}
                  </button>

                  {!isSuccess && (
                    <button
                      onClick={onDone}
                      disabled={isSaving}
                      className="w-full text-xs text-center text-muted-foreground py-2.5 hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      Skip, add later
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
