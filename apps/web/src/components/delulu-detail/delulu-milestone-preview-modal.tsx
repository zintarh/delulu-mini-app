"use client";

import { CheckCircle2, Loader2, XIcon } from "lucide-react";
import { Modal, ModalContent } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { GraphMilestone } from "@/hooks/graph/useGraphDelulu";

export type NewMilestoneDraft = { description: string; days: string };

export function DeluluMilestonePreviewModal({
  open,
  onOpenChange,
  newMilestones,
  existingMilestones,
  isAdding,
  isConfirming,
  isSuccess,
  onBack,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newMilestones: NewMilestoneDraft[];
  existingMilestones: GraphMilestone[] | undefined;
  isAdding: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const busy = isAdding || isConfirming;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onOpenChange(false);
      }}
    >
      <ModalContent
        className="max-w-lg p-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
        showClose={false}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
              Preview
            </p>
            <h2 className="text-lg font-bold text-white leading-tight">
              Milestone plan
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!busy) onOpenChange(false);
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <XIcon className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>

        <div className="h-px bg-white/[0.06] mx-5" />

        <div className="px-5 py-4 max-h-[42vh] overflow-y-auto space-y-0">
          {(() => {
            const valid = newMilestones.filter(
              (m) => m.description.trim().length > 0 && m.days.trim().length > 0,
            );
            let cursor =
              existingMilestones && existingMilestones.length > 0
                ? existingMilestones[existingMilestones.length - 1]!.deadline.getTime()
                : Date.now();
            return valid.map((m, i) => {
              const daysNum = Number(m.days);
              cursor += daysNum * 24 * 60 * 60 * 1000;
              const deadline = new Date(cursor);
              const isLast = i === valid.length - 1;
              return (
                <div key={i} className="flex gap-3.5">
                  <div className="flex flex-col items-center pt-0.5">
                    <div className="w-5 h-5 rounded-full border border-white/20 bg-white/5 text-[10px] font-bold text-zinc-300 flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    {!isLast ? (
                      <div className="w-px flex-1 bg-white/[0.07] mt-1.5 mb-1.5 min-h-[28px]" />
                    ) : null}
                  </div>
                  <div className={cn("flex-1 min-w-0", !isLast ? "pb-4" : "pb-1")}>
                    <p className="text-sm font-medium text-white leading-snug">
                      {m.description.trim()}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-zinc-500">
                        {daysNum} {daysNum === 1 ? "day" : "days"}
                      </span>
                      <span className="text-zinc-700 text-[10px]">·</span>
                      <span className="text-[11px] text-zinc-600">
                        {deadline.toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        <div className="h-px bg-white/[0.06] mx-5" />

        <div className="px-5 pt-4 pb-5 space-y-4">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-zinc-500">Total duration</span>
            <span className="font-semibold text-zinc-200">
              {newMilestones
                .filter((m) => m.description.trim() && m.days.trim())
                .reduce((s, m) => s + Number(m.days), 0)}{" "}
              days
            </span>
          </div>

          <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
            <p className="text-[12px] text-zinc-400 leading-relaxed">
              <span className="text-zinc-200 font-semibold">
                Milestones are final once submitted.
              </span>{" "}
              Make sure you&apos;ve added everything — you won&apos;t be able to
              add more after this.
            </p>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-sm font-medium text-zinc-300 transition-colors disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy || isSuccess}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold",
                "bg-[#f6c324] text-[#1a1a19] hover:bg-[#e4b520] transition-colors",
                "flex items-center justify-center gap-2",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {busy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting…
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Done
                </>
              ) : (
                "Confirm & submit"
              )}
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
