"use client";

import { useState, useEffect, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, X, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAddCommunityCampaignMilestones } from "@/hooks/use-add-community-campaign-milestones";
import {
  fetchDraftMilestones,
  publishDraftMilestonesOnChain,
} from "@/lib/community/publish-campaign-milestones-client";

interface AiMilestone {
  title: string;
  days: number;
}

export function CampaignMilestonesModal({
  open,
  onOpenChange,
  campaignId,
  challengeId,
  campaignTitle,
  durationDays,
  onChainMilestoneCount = 0,
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
  onDone: () => void;
}) {
  const maxDays = Math.max(1, durationDays);
  const isInitialPublish = onChainMilestoneCount === 0;
  const [milestones, setMilestones] = useState<AiMilestone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const {
    addCommunityCampaignMilestones,
    isPending,
    isSuccess,
    errorMessage,
    reset,
  } = useAddCommunityCampaignMilestones();

  const generateWithAi = useCallback(async () => {
    const res = await fetch("/api/ai/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: campaignTitle, durationDays: maxDays }),
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
  }, [campaignTitle, maxDays]);

  const loadMilestones = useCallback(async () => {
    if (!campaignTitle) return;
    setIsLoading(true);
    setLoadError(null);
    setMilestones([]);
    try {
      if (isInitialPublish) {
        const drafts = await fetchDraftMilestones(campaignId);
        if (drafts.length > 0) {
          setMilestones(
            drafts.map((m) => ({
              title: m.title,
              days: Math.max(1, Number(m.duration_days) || 1),
            })),
          );
          return;
        }
        setLoadError("No draft milestones found. Generate with AI or add them in the campaign draft.");
      }
      await generateWithAi();
    } catch {
      if (isInitialPublish) {
        setLoadError("Could not load draft milestones. Generate with AI below.");
        setMilestones([{ title: "", days: maxDays }]);
      } else {
        setLoadError("Could not generate milestones. Add them manually below.");
        setMilestones([{ title: "", days: maxDays }]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, campaignTitle, generateWithAi, isInitialPublish, maxDays]);

  useEffect(() => {
    if (open) {
      reset();
      setConfirmError(null);
      void loadMilestones();
    }
  }, [open, loadMilestones, reset]);

  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(() => onDone(), 900);
    return () => clearTimeout(t);
  }, [isSuccess, onDone]);

  const updateTitle = (idx: number, value: string) =>
    setMilestones((prev) => prev.map((m, i) => (i === idx ? { ...m, title: value } : m)));

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
  const showList = !isLoading && milestones.length > 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[88vh] flex-col rounded-t-[28px] border-t border-border bg-background lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[calc(100%-2rem)] lg:max-w-[560px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isInitialPublish ? "Publish milestones on-chain" : "Campaign milestones"}
                </p>
                <h2 className="text-lg font-bold text-foreground">{campaignTitle}</h2>
              </div>
              <DialogPrimitive.Close className="rounded-full bg-secondary p-2">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isInitialPublish ? "Loading planned milestones…" : "Generating milestones…"}
                </p>
              </div>
            ) : null}

            {loadError ? (
              <p className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                {loadError}
              </p>
            ) : null}

            {!isInitialPublish && !isLoading ? (
              <button
                type="button"
                onClick={() => void generateWithAi().catch(() => setLoadError("AI generation failed"))}
                className="mb-3 text-xs font-semibold text-delulu-blue hover:underline"
              >
                Regenerate with AI
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

            {daysRemaining !== 0 && showList ? (
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
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
