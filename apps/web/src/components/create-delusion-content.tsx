"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Loader2,
  X,
  Check,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { type GatekeeperConfig } from "@/lib/ipfs";
import { useUserSetupCheck } from "@/hooks/use-user-setup-check";
import {
  MIN_DURATION_DAYS,
  MAX_DURATION_DAYS,
  getDefaultDeadline,
  getMinDeadline,
  getMaxDeadline,
} from "@/lib/create-delulu-helpers";
import {
  PRIORITY_ORDER,
  type SideEffectHabit,
  type DelusionTemplate,
} from "@/components/create-delusion-shared";
import { CreateFlowSkeleton } from "@/components/create-flow-skeleton";
import {
  createFlowPx,
  createFlowPy,
  createFlowGap,
} from "@/components/create-flow-layout";
import { CreateFlowStepProgress } from "@/components/create-flow-step-progress";

const UserSetupModal = dynamic(
  () => import("@/components/user-setup-modal").then((m) => m.UserSetupModal),
  { ssr: false }
);

const CreateManifestStep = dynamic(
  () =>
    import("@/components/create-manifest-step").then((m) => m.CreateManifestStep),
  { ssr: false, loading: () => <CreateFlowSkeleton /> }
);

/** Preload wallet/manifest chunk while user is on dream or habits steps. */
export function prefetchCreateManifestStep() {
  void import("@/components/create-manifest-step");
}

const GOAL_SUGGESTIONS = [
  "Read daily",
  "Get fit",
  "Stay hydrated",
  "Create content",
  "Relationship",
  "Sleep better",
  "Study every day",
  "Get a new job",
  "Save money",
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

const AI_HABIT_COUNT = 3;

interface CreateDelusionContentProps {
  onClose: () => void;
  /** When true, parent provides page chrome (sidebar, desktop search header). */
  layout?: "main" | "standalone";
}

type Step = "dream" | "habits" | "manifest";

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateDelusionContent({
  onClose,
  layout = "main",
}: CreateDelusionContentProps) {
  const { address } = useAuth();

  // ── Step management ─────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("dream");
  const setupCheckEnabled = step === "manifest";
  const { needsSetup, isChecking } = useUserSetupCheck(setupCheckEnabled);
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);

  useEffect(() => {
    if (!setupCheckEnabled || isChecking) return;
    setShowUserSetupModal(needsSetup);
  }, [needsSetup, isChecking, setupCheckEnabled]);

  useEffect(() => {
    if (step === "dream" || step === "habits") {
      prefetchCreateManifestStep();
    }
  }, [step]);

  // ── AI / Series state ────────────────────────────────────────────────────────
  const [ultimateGoal, setUltimateGoal] = useState("");
  const [aiHabits, setAiHabits] = useState<SideEffectHabit[]>([]);
  const [alreadyHas, setAlreadyHas] = useState<Set<string>>(new Set());
  const [habitDurations, setHabitDurations] = useState<Record<string, number>>({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [goalSeriesId, setGoalSeriesId] = useState<string | null>(null);
  const [isSavingRoadmap, setIsSavingRoadmap] = useState(false);
  const [activeHabit, setActiveHabit] = useState<SideEffectHabit | null>(null);

  // refs for isSuccess effect (avoid stale closure)
  const goalSeriesIdRef = useRef<string | null>(null);
  const activeHabitRef = useRef<SideEffectHabit | null>(null);
  useEffect(() => { goalSeriesIdRef.current = goalSeriesId; }, [goalSeriesId]);
  useEffect(() => { activeHabitRef.current = activeHabit; }, [activeHabit]);

  // ── Image / template state ───────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<DelusionTemplate | null>(null);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [customUploadFile, setCustomUploadFile] = useState<File | null>(null);

  // ── Form state (manifest step owns wallet hooks) ─────────────────────────────
  const [delusionText, setDelusionText] = useState("");
  const [description, setDescription] = useState("");
  const [gatekeeper, setGatekeeper] = useState<GatekeeperConfig | null>(null);
  const [deadline, setDeadline] = useState<Date>(() => getDefaultDeadline());
  const [durationMode, setDurationMode] = useState<"fast" | "calendar">("calendar");
  const [fastDurationValue, setFastDurationValue] = useState<string>("7");

  const updateDeadlineFromFastMode = useCallback((value: string) => {
    if (!value || value === "" || isNaN(Number(value))) return;
    let numValue = Math.floor(Number(value));
    if (numValue < MIN_DURATION_DAYS) numValue = MIN_DURATION_DAYS;
    if (numValue > MAX_DURATION_DAYS) numValue = MAX_DURATION_DAYS;
    const now = new Date();
    const newDeadline = new Date(now);
    newDeadline.setTime(now.getTime() + numValue * 24 * 60 * 60 * 1000);
    const minDeadline = getMinDeadline();
    const maxDeadline = getMaxDeadline();
    if (newDeadline.getTime() < minDeadline.getTime()) {
      setDeadline(minDeadline);
    } else if (newDeadline.getTime() > maxDeadline.getTime()) {
      setDeadline(maxDeadline);
    } else {
      newDeadline.setUTCHours(23, 59, 59, 999);
      setDeadline(newDeadline);
    }
  }, []);

  useEffect(() => {
    if (durationMode === "fast" && fastDurationValue !== "") {
      updateDeadlineFromFastMode(fastDurationValue);
    }
  }, [durationMode, fastDurationValue, updateDeadlineFromFastMode]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep("dream");
    setUltimateGoal("");
    setAiHabits([]);
    setAlreadyHas(new Set());
    setHabitDurations({});
    setAiError(null);
    setGoalSeriesId(null);
    setActiveHabit(null);
    setDelusionText("");
    setDescription("");
    setDeadline(getDefaultDeadline());
    setDurationMode("calendar");
    setFastDurationValue("7");
    setGatekeeper(null);
    setSelectedTemplate(null);
    setCustomImage(null);
    setSelectedImage(null);
    setCustomUploadFile(null);
    onClose();
  };

  const handleBack = () => {
    if (step === "habits") {
      setStep("dream");
      return;
    }
    if (step === "manifest" && aiHabits.length > 0) {
      setStep("habits");
      return;
    }
    onClose();
  };

  // ── AI: analyse goal ────────────────────────────────────────────────────────

  const handleAnalyzeGoal = async () => {
    if (!ultimateGoal.trim()) return;
    setIsLoadingAI(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/side-effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: ultimateGoal }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "AI analysis failed");
      }
      const { habits } = await res.json();
      const trimmed = (habits as SideEffectHabit[]).slice(0, AI_HABIT_COUNT);
      setAiHabits(trimmed);
      const durations: Record<string, number> = {};
      trimmed.forEach((h) => {
        durations[h.id] = Math.min(MAX_DURATION_DAYS, h.suggestedDays);
      });
      setHabitDurations(durations);
      setStep("habits");
    } catch (err: any) {
      setAiError(err.message || "Failed to analyse dream");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const toggleAlreadyHas = (id: string) => {
    setAlreadyHas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // sorted roadmap: only unchecked, HIGH → MEDIUM → LOW
  const roadmapHabits = aiHabits
    .filter((h) => !alreadyHas.has(h.id))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  // ── Save roadmap & advance to gallery ───────────────────────────────────────

  const handleSaveRoadmap = async () => {
    if (!address) return;
    setIsSavingRoadmap(true);
    setAiError(null);
    try {
      const pendingHabits = roadmapHabits.map((h) => ({
        id: h.id,
        title: h.title,
        description: h.description,
        priority: h.priority,
        category: h.category,
        suggestedDays: habitDurations[h.id] ?? h.suggestedDays,
        alreadyHas: false,
        emoji: h.emoji,
      }));
      const skippedHabits = aiHabits
        .filter((h) => alreadyHas.has(h.id))
        .map((h) => ({
          id: h.id,
          title: h.title,
          description: h.description,
          priority: h.priority,
          category: h.category,
          suggestedDays: h.suggestedDays,
          alreadyHas: true,
          emoji: h.emoji,
        }));

      let seriesId: string | null = null;
      try {
        const res = await fetch("/api/goals/series", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorAddress: address,
            ultimateGoal,
            aiSideEffects: aiHabits,
            habits: [...pendingHabits, ...skippedHabits],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          seriesId = json.seriesId ?? null;
        } else {
          console.warn("[goals/series] save failed, continuing without series tracking");
        }
      } catch (err) {
        console.warn("[goals/series] save error, continuing without series tracking", err);
      }
      if (seriesId) setGoalSeriesId(seriesId);

      // Pre-fill gallery with first habit
      const first = roadmapHabits[0];
      if (first) {
        setActiveHabit(first);
        setDelusionText(first.title);
        setDescription(first.description || "");
        const days = String(Math.min(MAX_DURATION_DAYS, habitDurations[first.id] ?? first.suggestedDays));
        setFastDurationValue(days);
        setDurationMode("fast");
        updateDeadlineFromFastMode(days);
      }
      setStep("manifest");
    } catch (err: any) {
      setAiError(err.message || "Failed to save plan");
    } finally {
      setIsSavingRoadmap(false);
    }
  };

  const handleContinueToManifest = async () => {
    if (roadmapHabits.length === 0) {
      setStep("manifest");
      return;
    }
    await handleSaveRoadmap();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className={cn(
          "relative flex flex-1 min-h-0 flex-col overflow-hidden text-foreground",
          layout === "standalone" && "h-screen bg-background"
        )}
      >
        <div className={cn("shrink-0", createFlowPx, layout === "main" ? "pt-3 pb-1" : "py-3")}>
          <div className="flex items-center gap-2">
            {step !== "dream" && (
              <button
                type="button"
                onClick={handleBack}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-3 hover:bg-secondary transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-semibold">Back</span>
              </button>
            )}
            {layout === "standalone" && (
              <button
                type="button"
                onClick={handleClose}
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <CreateFlowStepProgress step={step} className="mt-3" />
        </div>

        {step === "dream" && (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            <div className={cn("flex flex-col gap-5", createFlowPx, createFlowPy)}>
              <div>
                <h2 className="text-2xl font-black tracking-tight lg:text-[1.75rem]">
                  What&apos;s your dream?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We&apos;ll suggest three daily habits to get you started.
                </p>
              </div>

              <textarea
                value={ultimateGoal}
                onChange={(e) => setUltimateGoal(e.target.value)}
                rows={3}
                placeholder="e.g. sleep better, get fit, land a job…"
                className="w-full min-h-[96px] resize-none rounded-2xl border border-border bg-background px-4 py-3.5 text-base font-semibold leading-snug placeholder:text-muted-foreground/50 focus-delulu"
                autoFocus
              />

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick picks
                </p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
                  {GOAL_SUGGESTIONS.map((label) => {
                    const selected = ultimateGoal === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setUltimateGoal(label)}
                        className={cn(
                          "rounded-full px-2 py-1.5 text-center text-[11px] font-semibold leading-tight transition-all sm:px-3 sm:py-2 sm:text-xs",
                          selected
                            ? "bg-delulu-blue text-white"
                            : "bg-secondary text-foreground hover:bg-secondary/80",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1 pb-8">
                {aiError && <p className="text-xs text-destructive">{aiError}</p>}
                <button
                  type="button"
                  onClick={handleAnalyzeGoal}
                  disabled={!ultimateGoal.trim() || isLoadingAI}
                  className={cn(
                    "w-full rounded-full py-3.5 text-sm font-bold transition-all lg:w-fit lg:min-w-[200px] lg:px-8",
                    "bg-foreground text-background active:scale-[0.98]",
                    (!ultimateGoal.trim() || isLoadingAI) &&
                      "cursor-not-allowed opacity-40",
                  )}
                >
                  {isLoadingAI ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Suggesting habits…
                    </span>
                  ) : (
                    "Get habit ideas"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("manifest")}
                  className="py-2 text-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground lg:text-left"
                >
                  Skip to manifest →
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "habits" && (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            <div className={cn("flex flex-col", createFlowGap, createFlowPx, createFlowPy)}>
              <div>
                <p className="text-xs text-muted-foreground truncate">{ultimateGoal}</p>
                <h2 className="mt-0.5 text-2xl font-black tracking-tight lg:text-3xl">
                  Already doing any?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Uncheck what you already do. We start with the first one left.
                </p>
              </div>

              <div className="space-y-2">
                {aiHabits.map((habit) => {
                  const has = alreadyHas.has(habit.id);
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      onClick={() => toggleAlreadyHas(habit.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                        has
                          ? "border-border/60 bg-secondary/50 opacity-60"
                          : "border-border bg-secondary hover:border-foreground/20",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                          has
                            ? "border-foreground/40 bg-foreground/10"
                            : "border-border bg-background",
                        )}
                      >
                        {has && (
                          <Check className="h-3 w-3 text-foreground/60" strokeWidth={3} />
                        )}
                      </div>
                      <span
                        className={cn(
                          "min-w-0 flex-1 text-sm font-semibold leading-snug",
                          has && "line-through text-muted-foreground",
                        )}
                      >
                        {habit.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 pt-1 pb-8">
                {aiError && <p className="text-xs text-destructive">{aiError}</p>}
                <button
                  type="button"
                  onClick={handleContinueToManifest}
                  disabled={isSavingRoadmap || !address}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold transition-all lg:w-fit lg:px-8",
                    "bg-foreground text-background active:scale-[0.98]",
                    (isSavingRoadmap || !address) && "cursor-not-allowed opacity-40",
                  )}
                >
                  {isSavingRoadmap ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing…
                    </>
                  ) : roadmapHabits.length > 0 ? (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    "Create without habits"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "manifest" && (
          <CreateManifestStep
            onClose={onClose}
            activeHabit={activeHabit}
            roadmapHabits={roadmapHabits}
            goalSeriesIdRef={goalSeriesIdRef}
            activeHabitRef={activeHabitRef}
            delusionText={delusionText}
            setDelusionText={setDelusionText}
            description={description}
            setDescription={setDescription}
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
            customImage={customImage}
            setCustomImage={setCustomImage}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            customUploadFile={customUploadFile}
            setCustomUploadFile={setCustomUploadFile}
            deadline={deadline}
            setDeadline={setDeadline}
            durationMode={durationMode}
            setDurationMode={setDurationMode}
            fastDurationValue={fastDurationValue}
            setFastDurationValue={setFastDurationValue}
            updateDeadlineFromFastMode={updateDeadlineFromFastMode}
            gatekeeper={gatekeeper}
          />
        )}
      </div>

      <UserSetupModal
        open={showUserSetupModal && needsSetup}
        onOpenChange={(open) => {
          setShowUserSetupModal(open);
          if (!open && needsSetup) onClose();
        }}
        onComplete={() => {
          setShowUserSetupModal(false);
        }}
      />
    </>
  );
}
