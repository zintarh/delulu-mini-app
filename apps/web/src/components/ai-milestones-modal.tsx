"use client";

import { useState, useEffect, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useWaitForTransactionReceipt, useChainId } from "wagmi";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { Loader2, X, Check, Plus } from "lucide-react";
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
  "bg-secondary text-muted-foreground",
  "bg-foreground text-background",
  "bg-secondary text-muted-foreground",
  "bg-secondary text-muted-foreground",
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
  } = useUnifiedWriteContract();
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
        // API already returns correctly distributed durations — use them directly.
        const milestones: AiMilestone[] = data.milestones.map((m: AiMilestone) => ({
          title: String(m.title || "").trim(),
          days: Math.max(1, Number(m.days) || 1),
        })).filter((m: AiMilestone) => m.title.length > 0);
        setMilestones(milestones);
      } else {
        throw new Error("No milestones returned");
      }
    } catch {
      setAiError("Could not generate milestones. You can add them manually below.");
      // Seed one empty milestone so the user can start manually
      setMilestones([{ title: "", days: maxDays }]);
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
    setMilestones((prev) => {
      const total = prev.reduce((sum, m) => sum + m.days, 0);
      return prev.map((m, i) => {
        if (i !== idx) return m;
        if (delta > 0 && total >= maxDays) return m;
        if (delta < 0 && m.days <= 1) return m;
        return { ...m, days: Math.max(1, m.days + delta) };
      });
    });

  const addMilestone = () => {
    setMilestones((prev) => {
      // Steal 1 day from the milestone with the most days
      const maxIdx = prev.reduce(
        (best, m, i) => (m.days > prev[best].days ? i : best),
        0
      );
      if (prev.length > 0 && prev[maxIdx].days > 1) {
        const updated = prev.map((m, i) =>
          i === maxIdx ? { ...m, days: m.days - 1 } : m
        );
        return [...updated, { title: "", days: 1 }];
      }
      // All milestones are at 1 day — add anyway, user must adjust
      return [...prev, { title: "", days: 1 }];
    });
  };

  const removeMilestone = (idx: number) => {
    setMilestones((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev[idx];
      const newList = prev.filter((_, i) => i !== idx);
      // Give removed days back to the last remaining milestone
      if (newList.length > 0) {
        const lastIdx = newList.length - 1;
        newList[lastIdx] = {
          ...newList[lastIdx],
          days: newList[lastIdx].days + removed.days,
        };
      }
      return newList;
    });
  };

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
  const totalMilestoneDays = milestones.reduce((sum, m) => sum + m.days, 0);
  const daysRemaining = maxDays - totalMilestoneDays;
  const tooManyMilestones = milestones.length > maxDays;
  const canAddMore = milestones.length < maxDays;
  const canSave =
    !isSaving &&
    milestones.length >= 3 &&
    !tooManyMilestones &&
    totalMilestoneDays === maxDays &&
    milestones.every((m) => m.title.trim().length > 0);

  const showList = !isLoadingAI && milestones.length > 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-200"
          )}
        />

        {/* Responsive: bottom sheet on mobile, centered modal on lg+ */}
        <DialogPrimitive.Content
          className={cn(
            "fixed z-[60] bg-background outline-none flex flex-col",
            // Mobile — bottom sheet
            "bottom-0 left-0 right-0 max-h-[88vh]",
            "rounded-t-[28px] border-t border-border",
            // Desktop — centered modal
            "lg:bottom-auto lg:left-1/2 lg:right-auto lg:top-1/2",
            "lg:-translate-x-1/2 lg:-translate-y-1/2",
            "lg:w-[calc(100%-2rem)] lg:max-w-[560px]",
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
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5 hover:bg-secondary/80 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </DialogPrimitive.Close>
              </div>

              {/* Duration context */}
              {showList && (
                <div className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2.5",
                  daysRemaining === 0 ? "bg-emerald-500/10" : daysRemaining < 0 ? "bg-destructive/10" : "bg-muted/60"
                )}>
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    daysRemaining === 0 ? "bg-emerald-500" : daysRemaining < 0 ? "bg-destructive" : "bg-delulu-yellow-reserved"
                  )} />
                  <p className="text-xs text-muted-foreground">
                    Milestones must add up to your{" "}
                    <span className="font-semibold text-foreground">{maxDays}-day</span>{" "}
                    dream window{" "}
                    <span className={cn(
                      "font-semibold",
                      daysRemaining === 0 ? "text-emerald-600" : daysRemaining < 0 ? "text-destructive" : "text-foreground"
                    )}>
                      ({totalMilestoneDays}/{maxDays})
                    </span>
                  </p>
                </div>
              )}

              {/* AI error banner (non-blocking) */}
              {aiError && !isLoadingAI && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
                  <p className="text-xs text-amber-700 leading-relaxed flex-1">{aiError}</p>
                  <button
                    onClick={fetchMilestones}
                    className="text-[10px] font-semibold text-amber-700 underline shrink-0 mt-px"
                  >
                    Retry
                  </button>
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

              {/* Milestone cards */}
              {showList && (
                <div className="space-y-2">
                  {milestones.map((m, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === milestones.length - 1;
                    const canRemove = milestones.length > 1;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-xl border p-3 flex gap-2.5",
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
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5",
                            STEP_COLORS[Math.min(idx, STEP_COLORS.length - 1)]
                          )}
                        >
                          {isSuccess ? (
                            <Check className="w-3 h-3" strokeWidth={3} />
                          ) : (
                            idx + 1
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Editable title */}
                          <input
                            type="text"
                            value={m.title}
                            onChange={(e) => updateTitle(idx, e.target.value)}
                            className={cn(
                              "w-full bg-transparent text-xs font-semibold text-foreground",
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
                                className="w-5 h-5 rounded-md bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground font-bold text-sm leading-none transition-colors disabled:opacity-30"
                              >
                                −
                              </button>
                              <span className="text-[11px] font-bold tabular-nums w-7 text-center text-foreground">
                                {m.days}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateDays(idx, 1)}
                                disabled={daysRemaining <= 0}
                                className="w-5 h-5 rounded-md bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground font-bold text-sm leading-none transition-colors disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Remove button */}
                        {canRemove && !isSuccess && (
                          <button
                            type="button"
                            onClick={() => removeMilestone(idx)}
                            className="w-5 h-5 flex items-center justify-center text-muted-foreground/50 hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
                            aria-label="Remove milestone"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Add milestone button */}
                  {!isSuccess && (
                    <button
                      type="button"
                      onClick={addMilestone}
                      disabled={!canAddMore}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {canAddMore ? "Add milestone" : `Max ${maxDays} milestones`}
                    </button>
                  )}
                </div>
              )}

              {/* Contract error */}
              {writeError && !isSaving && (
                <p className="text-xs text-destructive px-1">
                  {writeError.message?.split("(")[0]?.trim() ||
                    "Transaction failed. Please try again."}
                </p>
              )}
              {showList && daysRemaining !== 0 && (
                <p className="text-xs text-destructive px-1">
                  {daysRemaining > 0
                    ? `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} still unassigned — add more milestones or increase day counts.`
                    : `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? "s" : ""} over budget — reduce day counts on some milestones.`}
                </p>
              )}
              {showList && milestones.length < 3 && (
                <p className="text-xs text-destructive px-1">
                  Add at least 3 milestones to continue.
                </p>
              )}
              {showList && tooManyMilestones && (
                <p className="text-xs text-destructive px-1">
                  Maximum {maxDays} milestones allowed. Remove {milestones.length - maxDays} to continue.
                </p>
              )}

              {/* CTAs */}
              {showList && (
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

              {/* Error state with no milestones seeded */}
              {!isLoadingAI && aiError && milestones.length === 0 && (
                <div className="space-y-2 pt-1">
                  <button
                    onClick={onDone}
                    className="w-full text-xs text-center text-muted-foreground py-2.5 hover:text-foreground transition-colors"
                  >
                    Skip, add later
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
