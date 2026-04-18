"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronRight, SkipForward, RefreshCw, Target, Briefcase, DollarSign, Heart, BookOpen, Users, Brain } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  finance:   DollarSign,
  health:    Heart,
  career:    Briefcase,
  education: BookOpen,
  social:    Users,
  mindset:   Brain,
  other:     Target,
};
import { useAccount } from "wagmi";
import { cn } from "@/lib/utils";
import {
  useGoalSeries,
  useSkipHabit,
  useAbandonSeries,
  type GoalSeries,
  type GoalSeriesHabit,
} from "@/hooks/use-goal-series";
import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";

function PriorityDot({ priority }: { priority: GoalSeriesHabit["priority"] }) {
  return (
    <span
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
        priority === "high" && "bg-rose-400",
        priority === "medium" && "bg-amber-400",
        priority === "low" && "bg-sky-400"
      )}
    />
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-delulu-yellow rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface ContinueJourneyCardProps {
  className?: string;
}

export function ContinueJourneyCard({ className }: ContinueJourneyCardProps) {
  const { address } = useAccount();
  const router = useRouter();
  const { data: series, isLoading } = useGoalSeries(address);
  const [showAbandonModal, setShowAbandonModal] = useState(false);

  if (isLoading || !series) return null;

  const allHabits = series.goal_series_habits ?? [];
  const actionableHabits = allHabits.filter((h) => !h.already_has);
  const doneHabits = actionableHabits.filter(
    (h) => h.status === "completed" || h.status === "skipped" || h.status === "active"
  );

  const nextHabit = actionableHabits
    .filter((h) => h.status === "pending")
    .sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;

  // If there's nothing pending and nothing active, don't show the card
  if (!nextHabit && doneHabits.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          "bg-card border border-border rounded-2xl overflow-hidden",
          className
        )}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-0.5">
              Your journey
            </p>
            <p className="text-sm font-bold truncate">{series.ultimate_goal}</p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap mt-1">
            {doneHabits.length}/{actionableHabits.length} steps
          </span>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <ProgressBar done={doneHabits.length} total={actionableHabits.length} />
        </div>

        {/* Next up */}
        {nextHabit ? (
          <NextHabitRow
            series={series}
            habit={nextHabit}
            address={address!}
            onStartOver={() => setShowAbandonModal(true)}
            onStartGoal={() => {
              // Navigate to board (create flow) — it will show the active series
              router.push("/board");
            }}
          />
        ) : (
          <div className="px-4 pb-4">
            <p className="text-xs text-muted-foreground">
              All steps completed or in progress. Great work! 🎉
            </p>
          </div>
        )}
      </div>

      {/* Abandon confirmation modal */}
      <AbandonModal
        open={showAbandonModal}
        onOpenChange={setShowAbandonModal}
        seriesId={series.id}
        address={address!}
        goal={series.ultimate_goal}
      />
    </>
  );
}

// ─── Next Habit Row ───────────────────────────────────────────────────────────

function NextHabitRow({
  series,
  habit,
  address,
  onStartGoal,
  onStartOver,
}: {
  series: GoalSeries;
  habit: GoalSeriesHabit;
  address: string;
  onStartGoal: () => void;
  onStartOver: () => void;
}) {
  const skip = useSkipHabit(series.id, habit.habit_id);

  const handleSkip = async () => {
    await skip.mutateAsync(address);
  };

  return (
    <div className="border-t border-border/60 px-4 py-3 space-y-3">
      {/* Habit preview */}
      <div className="flex items-center gap-3">
        {(() => {
          const Icon = CATEGORY_ICONS[habit.category ?? "other"] ?? Target;
          return (
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
          );
        })()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <PriorityDot priority={habit.priority} />
            <span className="text-sm font-semibold truncate">{habit.title}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {habit.suggested_days} days suggested
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onStartGoal}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5",
            "py-2.5 rounded-xl bg-delulu-yellow text-delulu-charcoal",
            "text-sm font-bold transition-all active:scale-[0.98]"
          )}
        >
          Start this goal
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleSkip}
          disabled={skip.isPending}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 transition-colors text-muted-foreground"
          title="Skip this step"
        >
          {skip.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <SkipForward className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={onStartOver}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 transition-colors text-muted-foreground"
          title="Start over"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Abandon Modal ────────────────────────────────────────────────────────────

function AbandonModal({
  open,
  onOpenChange,
  seriesId,
  address,
  goal,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  seriesId: string;
  address: string;
  goal: string;
}) {
  const abandon = useAbandonSeries(seriesId);

  const handleAbandon = async () => {
    await abandon.mutateAsync(address);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-sm">
        <ModalHeader>
          <ModalTitle>Start over?</ModalTitle>
        </ModalHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will end your current journey toward{" "}
            <span className="font-semibold text-foreground">&ldquo;{goal}&rdquo;</span>.
            Your existing goals remain on-chain, but the roadmap queue will be cleared.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 py-3 rounded-xl bg-muted text-sm font-semibold hover:bg-muted/80 transition-colors"
            >
              Keep going
            </button>
            <button
              onClick={handleAbandon}
              disabled={abandon.isPending}
              className="flex-1 py-3 rounded-xl bg-destructive/15 text-destructive text-sm font-semibold hover:bg-destructive/25 transition-colors flex items-center justify-center gap-2"
            >
              {abandon.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Start over
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
