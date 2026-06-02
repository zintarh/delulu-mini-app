"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Target,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatMilestoneCountdown,
  getMilestoneLabel,
} from "@/lib/milestone-utils";
import type { GraphMilestone } from "@/hooks/graph/useGraphDelulu";
import type { FormattedDelulu } from "@/lib/types";
import { getNewMilestoneTiming } from "@/app/(main)/delulu/[id]/delulu-page-helpers";
import type { NewMilestoneDraft } from "@/components/delulu-detail/delulu-milestone-preview-modal";

const DeluluMilestonesViewerList = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-milestones-viewer-list").then(
      (m) => m.DeluluMilestonesViewerList,
    ),
  { ssr: false },
);

const AddMilestonesToCalendar = dynamic(
  () =>
    import("@/components/delulu-detail/add-milestones-to-calendar").then(
      (m) => m.AddMilestonesToCalendar,
    ),
  { ssr: false },
);

export type MilestoneViewState = {
  sorted: GraphMilestone[];
  endTimesMs: number[];
  currentIndex: number;
  passedCount: number;
};

export function DeluluMilestonesSidebar({
  showOnboardingBanner,
  delulu,
  deluluTitle,
  deluluId,
  milestoneView,
  milestones,
  isCreator,
  canAddMilestones,
  showMilestoneForm,
  milestoneMinError,
  deluluRemainingDaysTotal,
  newMilestones,
  maxDaysPerRow,
  now,
  openMilestoneId,
  onToggleMilestone,
  onNewMilestoneChange,
  onAddMilestoneRow,
  onRemoveMilestoneRow,
  onContinueMilestones,
  onOpenProof,
  onDeleteMilestone,
  onOpenAiMilestones,
  isWaitingForMilestones,
}: {
  showOnboardingBanner: boolean;
  delulu: FormattedDelulu;
  deluluTitle: string;
  deluluId: string;
  milestoneView: MilestoneViewState;
  milestones: GraphMilestone[] | undefined;
  isCreator: boolean;
  canAddMilestones: boolean;
  showMilestoneForm: boolean;
  milestoneMinError: boolean;
  deluluRemainingDaysTotal: number;
  newMilestones: NewMilestoneDraft[];
  maxDaysPerRow: number[];
  now: number;
  openMilestoneId: string | null;
  onToggleMilestone: (id: string) => void;
  onNewMilestoneChange: (
    index: number,
    field: "description" | "days",
    value: string,
  ) => void;
  onAddMilestoneRow: () => void;
  onRemoveMilestoneRow: (index: number) => void;
  onContinueMilestones: () => void;
  onOpenProof: (milestoneId: string, existingProof?: string | null) => void;
  onDeleteMilestone: (milestoneId: string) => void;
  onOpenAiMilestones: () => void;
  isWaitingForMilestones: boolean;
}) {
  return (
    <aside
      id="milestones"
      className="scroll-mt-24 space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:scrollbar-hide"
    >
      {showOnboardingBanner && milestoneView.sorted.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <span className="font-bold block mb-0.5">
              Your delulu won&apos;t appear on the home feed yet.
            </span>
            Add at least 3 milestones below so people can follow the roadmap and
            support this goal.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4 lg:p-5">
        <div className="flex flex-col gap-4 mb-5 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-black text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 md:w-5 md:h-5" />
                Milestones
              </h2>
              <span className="text-sm md:text-base font-bold tabular-nums text-foreground">
                {milestoneView.sorted.length
                  ? `${milestoneView.passedCount}/${milestoneView.sorted.length}`
                  : "0/0"}
              </span>
            </div>
            {isCreator && milestoneView.sorted.length > 0 ? (
              <AddMilestonesToCalendar
                deluluId={deluluId}
                deluluTitle={deluluTitle || "Delulu"}
                deluluCreatedAt={delulu.createdAt}
                deluluStakingDeadline={delulu.stakingDeadline}
                milestones={milestoneView.sorted}
                endTimesMs={milestoneView.endTimesMs}
              />
            ) : null}
          </div>
        </div>

        {isCreator && canAddMilestones && showMilestoneForm ? (
          <MilestoneAddForm
            milestoneMinError={milestoneMinError}
            deluluRemainingDaysTotal={deluluRemainingDaysTotal}
            resolutionDeadline={delulu.resolutionDeadline}
            newMilestones={newMilestones}
            maxDaysPerRow={maxDaysPerRow}
            milestones={milestones}
            now={now}
            onNewMilestoneChange={onNewMilestoneChange}
            onAddMilestoneRow={onAddMilestoneRow}
            onRemoveMilestoneRow={onRemoveMilestoneRow}
            onContinueMilestones={onContinueMilestones}
          />
        ) : null}

        {milestones && milestones.length > 0 ? (
          isCreator ? (
            <CreatorMilestonesList
              milestoneView={milestoneView}
              now={now}
              openMilestoneId={openMilestoneId}
              onToggleMilestone={onToggleMilestone}
              onOpenProof={onOpenProof}
              onDeleteMilestone={onDeleteMilestone}
            />
          ) : (
            <DeluluMilestonesViewerList
              milestones={milestoneView.sorted}
              endTimesMs={milestoneView.endTimesMs}
              currentIndex={milestoneView.currentIndex}
              now={now}
            />
          )
        ) : isWaitingForMilestones ? (
          <MilestonesLoadingSkeleton />
        ) : (
          <EmptyMilestones
            isCreator={isCreator}
            canAddMilestones={canAddMilestones}
            deluluRemainingDaysTotal={deluluRemainingDaysTotal}
            onOpenAiMilestones={onOpenAiMilestones}
          />
        )}
      </div>
    </aside>
  );
}

function MilestoneAddForm({
  milestoneMinError,
  deluluRemainingDaysTotal,
  resolutionDeadline,
  newMilestones,
  maxDaysPerRow,
  milestones,
  now,
  onNewMilestoneChange,
  onAddMilestoneRow,
  onRemoveMilestoneRow,
  onContinueMilestones,
}: {
  milestoneMinError: boolean;
  deluluRemainingDaysTotal: number;
  resolutionDeadline: Date | null | undefined;
  newMilestones: NewMilestoneDraft[];
  maxDaysPerRow: number[];
  milestones: GraphMilestone[] | undefined;
  now: number;
  onNewMilestoneChange: (
    index: number,
    field: "description" | "days",
    value: string,
  ) => void;
  onAddMilestoneRow: () => void;
  onRemoveMilestoneRow: (index: number) => void;
  onContinueMilestones: () => void;
}) {
  return (
    <div className="mb-4 border border-dashed border-border rounded-2xl p-3 md:p-4 bg-muted/60">
      {milestoneMinError ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-3 mb-3">
          <span className="text-amber-500 text-base leading-none mt-px">⚠</span>
          <p className="text-xs text-amber-600 font-medium leading-snug">
            Add at least <span className="font-bold">3 milestones</span> before
            continuing. A minimum of 3 steps is required.
          </p>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground mb-3">
        <strong className="text-foreground">{deluluRemainingDaysTotal}</strong>{" "}
        days left · sequential
      </p>
      <div className="space-y-3 md:space-y-4">
        {newMilestones.map((m, index) => {
          const { exceedsDeadline } = getNewMilestoneTiming({
            existingMilestonesLastDeadline:
              milestones && milestones.length > 0
                ? milestones[milestones.length - 1]?.deadline
                : null,
            newMilestones,
            index,
            resolutionDeadline,
            nowMs: now,
          });

          return (
            <div
              key={index}
              className="rounded-xl border border-border bg-card p-3 md:p-4 space-y-2"
            >
              {newMilestones.length > 1 ? (
                <div className="flex items-center justify-end mb-1">
                  <button
                    type="button"
                    onClick={() => onRemoveMilestoneRow(index)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : null}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="What to do"
                    value={m.description}
                    onChange={(e) =>
                      onNewMilestoneChange(index, "description", e.target.value)
                    }
                    className="flex-1 min-w-0 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                  <input
                    type="number"
                    min={1}
                    max={maxDaysPerRow[index] || undefined}
                    placeholder="1-2 days"
                    value={m.days}
                    onChange={(e) =>
                      onNewMilestoneChange(index, "days", e.target.value)
                    }
                    className="w-24 shrink-0 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                {maxDaysPerRow[index] != null && maxDaysPerRow[index] > 0 ? (
                  <span className="text-[10px] text-muted-foreground">
                    max {maxDaysPerRow[index]} days
                  </span>
                ) : null}
                {exceedsDeadline ? (
                  <div className="text-[10px] font-semibold text-destructive">
                    Over deadline
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
        <button
          type="button"
          onClick={onAddMilestoneRow}
          className="inline-flex items-center justify-center px-3 py-2 text-xs md:text-sm font-semibold rounded-md border border-border bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
        >
          + Add
        </button>
        <button
          type="button"
          onClick={onContinueMilestones}
          disabled={
            (milestones && milestones.length >= 10) ||
            newMilestones.some((m) => !m.days || Number(m.days) <= 0)
          }
          className={cn(
            "inline-flex items-center justify-center px-4 py-2 text-xs md:text-sm font-black rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1a1a19]",
            "bg-delulu-yellow-reserved text-delulu-charcoal hover:scale-[0.98] transition-transform",
            ((milestones && milestones.length >= 10) ||
              newMilestones.some((m) => !m.days || Number(m.days) <= 0)) &&
              "opacity-60 cursor-not-allowed",
          )}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function CreatorMilestonesList({
  milestoneView,
  now,
  openMilestoneId,
  onToggleMilestone,
  onOpenProof,
  onDeleteMilestone,
}: {
  milestoneView: MilestoneViewState;
  now: number;
  openMilestoneId: string | null;
  onToggleMilestone: (id: string) => void;
  onOpenProof: (milestoneId: string, existingProof?: string | null) => void;
  onDeleteMilestone: (milestoneId: string) => void;
}) {
  return (
    <div className="space-y-3 md:space-y-4 pt-1">
      {milestoneView.sorted.map((m, i) => {
        const endTimeMs = milestoneView.endTimesMs[i] ?? m.deadline.getTime();
        const shortTitle = getMilestoneLabel(m, 80);
        const isPast =
          m.isVerified ||
          milestoneView.currentIndex === -1 ||
          i < milestoneView.currentIndex;
        const isOngoing = i === milestoneView.currentIndex && !m.isVerified;
        const isUpcoming = !isPast && !isOngoing;
        let statusLabel = "Upcoming";
        if (m.isVerified) statusLabel = "Completed";
        else if (isPast) statusLabel = m.isSubmitted ? "In review" : "Expired";
        else if (isOngoing)
          statusLabel = m.isSubmitted ? "Under review" : "Pending";

        const isPastExpired = isPast && !m.isVerified && !m.isSubmitted;
        const isInReview = isPast && m.isSubmitted && !m.isVerified;
        const timeLeft = formatMilestoneCountdown(now, endTimeMs);
        const showTimeOrReview =
          (isPast || isOngoing) &&
          (m.isSubmitted ? !m.isVerified : timeLeft !== "Ended");
        const timeDisplay = timeLeft;

        return (
          <div
            key={m.id}
            className={cn(
              "border rounded-lg overflow-hidden transition-colors",
              isOngoing
                ? "border-delulu-blue-border bg-delulu-blue-light"
                : isUpcoming
                  ? "border-border/40 bg-muted/30"
                  : "border-border/60 bg-card",
            )}
          >
            <button
              type="button"
              onClick={() => onToggleMilestone(m.id)}
              className="w-full flex gap-3 p-3 md:p-4 items-start text-left"
            >
              <div className="pt-1">
                {openMilestoneId === m.id ? (
                  <ChevronUp
                    className={cn(
                      "w-4 h-4",
                      isUpcoming && "text-muted-foreground/70",
                    )}
                  />
                ) : (
                  <ChevronDown
                    className={cn(
                      "w-4 h-4",
                      isUpcoming && "text-muted-foreground/70",
                    )}
                  />
                )}
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p
                    className={cn(
                      "font-semibold text-xs md:text-sm",
                      isUpcoming ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {shortTitle}
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isOngoing ? (
                      <div className="flex flex-col items-center gap-x-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onOpenProof(m.milestoneId, m.proofLink);
                          }}
                          className="inline-flex items-center rounded-full px-2.5 py-1 border border-border text-[11px] font-semibold bg-secondary"
                        >
                          {m.proofLink ? "Replace Evidence" : "Submit Evidence"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!m.isVerified) {
                            onOpenProof(m.milestoneId, m.proofLink);
                          }
                        }}
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0 text-[9px] md:text-[10px] font-semibold border cursor-default",
                          m.isVerified
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : isInReview || (isOngoing && m.isSubmitted)
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : isPastExpired
                                ? "bg-red-500/10 text-red-600 border-red-500/20"
                                : isUpcoming
                                  ? "bg-muted/60 text-muted-foreground border-border/50"
                                  : "bg-secondary text-secondary-foreground border-border",
                        )}
                      >
                        {statusLabel}
                      </button>
                    )}

                    {!m.isSubmitted &&
                    !m.isVerified &&
                    !m.isMissed &&
                    endTimeMs >= now ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteMilestone(m.milestoneId);
                        }}
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                        title="Delete step"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {showTimeOrReview ? (
                    <span
                      className={cn(
                        "text-[9px] md:text-[10px] tabular-nums font-medium",
                        isPastExpired && "text-destructive",
                        (isInReview || (isOngoing && m.isSubmitted)) &&
                          "text-amber-600",
                      )}
                    >
                      {timeDisplay}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>

            {openMilestoneId === m.id ? (
              <div className="px-4 md:px-6 pb-4 pt-0 text-xs text-muted-foreground">
                {m.proofLink ? (
                  <div className="space-y-1.5">
                    <img
                      src={m.proofLink}
                      alt="Evidence"
                      className="max-h-40 rounded-md border border-border object-contain hidden [&:not([data-failed])]:block"
                      onLoad={(e) =>
                        e.currentTarget.classList.remove("hidden")
                      }
                      onError={(e) => {
                        e.currentTarget.dataset.failed = "true";
                        e.currentTarget.classList.add("hidden");
                      }}
                    />
                    <a
                      href={m.proofLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 text-xs font-bold underline"
                    >
                      View Evidence
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No evidence added yet
                  </p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function MilestonesLoadingSkeleton() {
  return (
    <div className="space-y-3 pt-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="border-2 border-border/40 rounded-xl overflow-hidden animate-pulse"
        >
          <div className="flex items-center justify-between px-4 md:px-8 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-6 h-6 rounded-full bg-muted-foreground/20 shrink-0" />
              <div className="space-y-2">
                <div className="h-3 w-40 rounded bg-muted-foreground/20" />
                <div className="h-2.5 w-24 rounded bg-muted-foreground/15" />
              </div>
            </div>
            <div className="h-5 w-16 rounded-full bg-muted-foreground/15 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyMilestones({
  isCreator,
  canAddMilestones,
  deluluRemainingDaysTotal,
  onOpenAiMilestones,
}: {
  isCreator: boolean;
  canAddMilestones: boolean;
  deluluRemainingDaysTotal: number;
  onOpenAiMilestones: () => void;
}) {
  return (
    <div className="rounded-2xl bg-muted p-8 text-center mt-2">
      <Target className="w-10 h-10 text-muted-foreground/70 mx-auto mb-3" />
      <p className="text-sm md:text-base font-black text-foreground">
        {isCreator ? "No steps yet" : "None yet"}
      </p>
      {isCreator && canAddMilestones && deluluRemainingDaysTotal > 0 ? (
        <button
          type="button"
          onClick={onOpenAiMilestones}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-delulu-charcoal bg-delulu-yellow-reserved text-delulu-charcoal text-sm font-black shadow-[2px_2px_0px_0px_#1a1a19] hover:scale-[0.98] transition-transform"
        >
          <Target className="w-4 h-4" />
          Add Milestones
        </button>
      ) : null}
    </div>
  );
}
