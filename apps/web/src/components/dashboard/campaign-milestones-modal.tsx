"use client";

import { useState, useEffect, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, Loader2, Sparkles, X, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAddCommunityCampaignMilestones } from "@/hooks/use-add-community-campaign-milestones";
import { publishDraftMilestonesOnChain } from "@/lib/community/publish-campaign-milestones-client";

interface AiMilestone {
  title: string;
  days: number;
}

type ModalStep = "config" | "review";

const INTERVAL_OPTIONS = [
  { days: 1, label: "Daily" },
  { days: 2, label: "Every 2 days" },
  { days: 3, label: "Every 3 days" },
  { days: 7, label: "Weekly" },
  { days: 14, label: "Every 2 weeks" },
];

export function CampaignMilestonesModal({
  open,
  onOpenChange,
  campaignId,
  challengeId,
  campaignTitle,
  durationDays,
  onChainMilestoneCount = 0,
  autoGenerate = false,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  challengeId: number;
  campaignTitle: string;
  durationDays: number;
  /** Subgraph milestone count — 0 means initial publish from DB drafts. */
  onChainMilestoneCount?: number;
  /** When true, show the AI config step first instead of opening with a blank form. */
  autoGenerate?: boolean;
  onDone: () => void;
}) {
  const maxDays = Math.max(1, durationDays);
  const isInitialPublish = onChainMilestoneCount === 0;

  // Step 1: config (goal input + interval) — only when autoGenerate=true
  // Step 2: review (milestone list, edit, publish)
  const [step, setStep] = useState<ModalStep>(autoGenerate ? "config" : "review");

  // Config step state
  const [configGoal, setConfigGoal] = useState("");
  const [configInterval, setConfigInterval] = useState(1);

  // Review step state
  const [milestones, setMilestones] = useState<AiMilestone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const {
    addCommunityCampaignMilestones,
    isPending,
    isSuccess,
    errorMessage,
    reset,
  } = useAddCommunityCampaignMilestones();

  // Available interval options — only show ones that produce ≥ 2 milestones
  const availableIntervals = INTERVAL_OPTIONS.filter(
    (opt) => Math.floor(maxDays / opt.days) >= 2,
  );
  // Default to the largest interval that gives at least 2 milestones,
  // but cap at 7 days so we don't default to "every 2 weeks" for short campaigns
  const defaultInterval = availableIntervals.find((o) => o.days <= 7)
    ? Math.max(...availableIntervals.filter((o) => o.days <= 7).map((o) => o.days))
    : availableIntervals[0]?.days ?? 1;

  const generateWithAi = useCallback(
    async (goal: string, intervalDays?: number) => {
      const body: Record<string, unknown> = {
        goal: goal || campaignTitle,
        durationDays: maxDays,
      };
      if (intervalDays && intervalDays > 1) body.intervalDays = intervalDays;

      const res = await fetch("/api/ai/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.milestones?.length) {
        const items: AiMilestone[] = data.milestones
          .map((m: AiMilestone) => ({
            title: String(m.title || "").trim(),
            days: Math.max(1, Number(m.days) || 1),
          }))
          .filter((m: AiMilestone) => m.title.length > 0);
        setMilestones(items);
        return;
      }
      throw new Error("No milestones returned");
    },
    [campaignTitle, maxDays],
  );

  // Reset everything when modal opens
  useEffect(() => {
    if (!open) return;
    reset();
    setConfirmError(null);
    setLoadError(null);
    setHasInteracted(false);
    setConfigGoal("");
    setConfigInterval(defaultInterval);

    if (autoGenerate) {
      setStep("config");
      setMilestones([]);
    } else {
      setStep("review");
      if (isInitialPublish) {
        setMilestones([{ title: "", days: maxDays }]);
      } else {
        setIsLoading(true);
        generateWithAi(campaignTitle)
          .catch(() => {
            setLoadError("Could not generate milestones. Add them manually below.");
            setMilestones([{ title: "", days: maxDays }]);
          })
          .finally(() => setIsLoading(false));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(() => onDone(), 900);
    return () => clearTimeout(t);
  }, [isSuccess, onDone]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setLoadError(null);
    setMilestones([]);
    setHasInteracted(false);
    setStep("review");
    try {
      await generateWithAi(configGoal, configInterval);
    } catch {
      setLoadError("AI generation failed. Edit milestones manually or try again.");
      setMilestones([{ title: "", days: maxDays }]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTitle = (idx: number, value: string) => {
    setHasInteracted(true);
    setMilestones((prev) => prev.map((m, i) => (i === idx ? { ...m, title: value } : m)));
  };

  const updateDays = (idx: number, delta: number) => {
    setHasInteracted(true);
    setMilestones((prev) => {
      const total = prev.reduce((sum, m) => sum + m.days, 0);
      return prev.map((m, i) => {
        if (i !== idx) return m;
        if (delta > 0 && total >= maxDays) return m;
        if (delta < 0 && m.days <= 1) return m;
        return { ...m, days: Math.max(1, m.days + delta) };
      });
    });
  };

  const addMilestone = () => {
    setMilestones((prev) => {
      const maxIdx = prev.reduce((best, m, i) => (m.days > prev[best].days ? i : best), 0);
      if (prev.length > 0 && prev[maxIdx].days > 1) {
        return [
          ...prev.map((m, i) => (i === maxIdx ? { ...m, days: m.days - 1 } : m)),
          { title: "", days: 1 },
        ];
      }
      return [...prev, { title: "", days: 1 }];
    });
  };

  const removeMilestone = (idx: number) => {
    setMilestones((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev[idx];
      const newList = prev.filter((_, i) => i !== idx);
      if (newList.length > 0) {
        const lastIdx = newList.length - 1;
        newList[lastIdx] = { ...newList[lastIdx], days: newList[lastIdx].days + removed.days };
      }
      return newList;
    });
  };

  const handleSave = async () => {
    if (milestones.length < 1) return;
    setConfirmError(null);
    try {
      await publishDraftMilestonesOnChain({
        campaignId,
        challengeId,
        durationDays: maxDays,
        draftRows: milestones.map((m) => ({
          title: m.title,
          duration_days: m.days,
        })),
        addOnChain: addCommunityCampaignMilestones,
      });
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Failed to save milestones");
    }
  };

  const totalMilestoneDays = milestones.reduce((sum, m) => sum + m.days, 0);
  const daysRemaining = maxDays - totalMilestoneDays;
  const canSave =
    !isPending &&
    milestones.length >= 1 &&
    totalMilestoneDays === maxDays &&
    milestones.every((m) => m.title.trim().length > 0);
  const showList = step === "review" && !isLoading && milestones.length > 0;

  // Computed preview for config step
  const previewCount = Math.max(2, Math.floor(maxDays / configInterval));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed bottom-0 left-0 right-0 z-[60] flex max-h-[88vh] flex-col rounded-t-[28px] border-t border-border bg-background lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[calc(100%-2rem)] lg:max-w-[560px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border">
          <div className="flex-1 overflow-y-auto px-5 py-4">

            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                {step === "review" && autoGenerate ? (
                  <button
                    type="button"
                    onClick={() => setStep("config")}
                    className="rounded-full bg-secondary p-1.5"
                    aria-label="Back to settings"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {step === "config"
                      ? "Generate milestones with AI"
                      : isInitialPublish
                        ? "Publish milestones on-chain"
                        : "Campaign milestones"}
                  </p>
                  <h2 className="text-lg font-bold text-foreground">{campaignTitle}</h2>
                </div>
              </div>
              <DialogPrimitive.Close className="rounded-full bg-secondary p-2">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            {/* ── Step 1: Config ── */}
            {step === "config" ? (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    What should participants do?
                  </label>
                  <textarea
                    value={configGoal}
                    onChange={(e) => setConfigGoal(e.target.value)}
                    placeholder={`e.g. Post on X daily to grow reach and engagement`}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-delulu-blue focus:outline-none focus:ring-1 focus:ring-delulu-blue/30"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank to use the campaign title.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">
                    Milestone interval
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableIntervals.map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setConfigInterval(opt.days)}
                        className={cn(
                          "rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors",
                          configInterval === opt.days
                            ? "border-delulu-blue bg-delulu-blue text-white"
                            : "border-border bg-muted/30 text-foreground hover:bg-muted/60",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    → {previewCount} milestone{previewCount !== 1 ? "s" : ""} ·{" "}
                    {configInterval} day{configInterval !== 1 ? "s" : ""} each
                    {maxDays % configInterval !== 0
                      ? ` (last milestone: ${maxDays - (previewCount - 1) * configInterval} day${maxDays - (previewCount - 1) * configInterval !== 1 ? "s" : ""})`
                      : ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-delulu-blue py-3.5 text-sm font-bold text-white"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate milestones
                </button>
              </div>
            ) : null}

            {/* ── Step 2: Review ── */}
            {step === "review" ? (
              <>
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Generating milestones…</p>
                  </div>
                ) : null}

                {loadError ? (
                  <p className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                    {loadError}
                  </p>
                ) : null}

                {!isLoading && !autoGenerate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoading(true);
                      setLoadError(null);
                      void generateWithAi(campaignTitle)
                        .catch(() => {
                          setLoadError("AI generation failed. Edit milestones manually.");
                          setMilestones([{ title: "", days: maxDays }]);
                        })
                        .finally(() => setIsLoading(false));
                    }}
                    className="mb-3 text-xs font-semibold text-delulu-blue hover:underline"
                  >
                    {isInitialPublish ? "Generate with AI" : "Regenerate with AI"}
                  </button>
                ) : null}

                {showList ? (
                  <div className="space-y-2">
                    {milestones.map((m, idx) => (
                      <div key={idx} className="flex gap-2 rounded-xl border border-border p-3">
                        <span className="mt-1 text-xs font-bold text-muted-foreground">{idx + 1}</span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <input
                            value={m.title}
                            onChange={(e) => updateTitle(idx, e.target.value)}
                            placeholder="Milestone title"
                            className="w-full bg-transparent text-sm font-semibold focus:outline-none"
                          />
                          <div className="flex items-center gap-2 text-xs">
                            <button type="button" onClick={() => updateDays(idx, -1)} disabled={m.days <= 1}>
                              −
                            </button>
                            <span>{m.days}d</span>
                            <button type="button" onClick={() => updateDays(idx, 1)} disabled={daysRemaining <= 0}>
                              +
                            </button>
                          </div>
                        </div>
                        {milestones.length > 1 ? (
                          <button type="button" onClick={() => removeMilestone(idx)} aria-label="Remove">
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addMilestone}
                      className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed py-2 text-xs font-semibold text-muted-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add milestone
                    </button>
                  </div>
                ) : null}

                {daysRemaining !== 0 && showList && hasInteracted ? (
                  <p className="mt-2 text-xs text-destructive">
                    Milestones must total {maxDays} days ({totalMilestoneDays}/{maxDays}).
                  </p>
                ) : null}

                {(errorMessage || confirmError) && !isPending ? (
                  <p className="mt-2 text-xs text-destructive">{confirmError ?? errorMessage}</p>
                ) : null}

                {showList ? (
                  <button
                    type="button"
                    disabled={!canSave || isSuccess}
                    onClick={() => void handleSave()}
                    className={cn(
                      "mt-4 w-full rounded-2xl py-3.5 text-sm font-bold",
                      isSuccess
                        ? "bg-emerald-500/15 text-emerald-700"
                        : "bg-delulu-blue text-white disabled:opacity-40",
                    )}
                  >
                    {isSuccess ? (
                      <span className="inline-flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Milestones published
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Confirm in wallet…
                      </span>
                    ) : (
                      "Publish milestones on-chain"
                    )}
                  </button>
                ) : null}
              </>
            ) : null}

          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
