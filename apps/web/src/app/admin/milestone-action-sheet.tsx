"use client";

import { useEffect, useState } from "react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { PendingMilestoneRow } from "@/hooks/graph/useAdminDashboard";
import { useMilestoneVerification } from "@/hooks/use-milestone-verification";

type ActionMode = "verify" | "reject" | null;

function parseDeluluId(row: PendingMilestoneRow): number | null {
  const fromOnChain = parseInt(row.delulu.onChainId, 10);
  if (!isNaN(fromOnChain) && fromOnChain > 0) return fromOnChain;
  const fromId = parseInt(row.delulu.id, 10);
  if (!isNaN(fromId) && fromId > 0) return fromId;
  return null;
}

function parseMilestoneId(row: PendingMilestoneRow): number | null {
  const n = parseInt(row.milestoneId, 10);
  return !isNaN(n) && n >= 0 ? n : null;
}

interface MilestoneActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PendingMilestoneRow | null;
  mode: ActionMode;
  onSuccess: () => void;
}

export function MilestoneActionSheet({
  open,
  onOpenChange,
  row,
  mode,
  onSuccess,
}: MilestoneActionSheetProps) {
  const [pointsStr, setPointsStr] = useState("10");
  const [reason, setReason] = useState("");
  const {
    verifyMilestone,
    rejectMilestone,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  } = useMilestoneVerification();

  useEffect(() => {
    if (!open) {
      setPointsStr("10");
      setReason("");
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    if (!isSuccess || !row) return;
    const t = setTimeout(() => {
      onSuccess();
      onOpenChange(false);
    }, 1200);
    return () => clearTimeout(t);
  }, [isSuccess, row, onOpenChange, onSuccess]);

  const busy = isPending || isConfirming;
  const deluluId = row ? parseDeluluId(row) : null;
  const milestoneId = row ? parseMilestoneId(row) : null;

  const handleSubmit = () => {
    if (!row || deluluId === null || milestoneId === null) return;
    try {
      if (mode === "verify") {
        const p = parseInt(pointsStr, 10);
        if (isNaN(p) || p < 0) return;
        verifyMilestone(deluluId, milestoneId, p);
      } else if (mode === "reject") {
        rejectMilestone(deluluId, milestoneId, reason);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const title =
    mode === "verify"
      ? "Verify milestone"
      : mode === "reject"
        ? "Reject submission"
        : "";

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      showClose={!busy}
      title=""
      sheetClassName="border-t-2 border-border !p-0 !z-[100] rounded-t-2xl bg-card"
      modalClassName="max-w-lg"
    >
      <div className="max-w-lg mx-auto pt-6 pb-8 px-5 space-y-5 text-foreground">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {row && (
          <div className="rounded-lg border-2 border-border bg-muted p-3 text-sm space-y-1">
            <p className="text-muted-foreground">
              Delulu #{deluluId ?? "—"} · Milestone #{milestoneId ?? "—"}
            </p>
            {row.proofLink && (
              <a
                href={row.proofLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline break-all hover:text-muted-foreground"
              >
                Proof link
              </a>
            )}
          </div>
        )}

        {mode === "verify" && (
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Points to award
            </span>
            <input
              type="number"
              min={0}
              value={pointsStr}
              onChange={(e) => setPointsStr(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border-2 border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        )}

        {mode === "reject" && (
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Reason (optional)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              rows={3}
              placeholder="Brief note to the creator"
              className="w-full rounded-lg border-2 border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none placeholder:text-muted-foreground"
            />
          </label>
        )}

        {isSuccess && (
          <p className="text-sm text-delulu-green font-medium text-center">
            Transaction submitted. Indexing may take a few seconds.
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive text-center font-medium">
            {(error as Error).message ?? "Transaction failed"}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className={cn(
              "flex-1 py-3 rounded-lg border-2 border-border bg-card text-sm font-bold text-foreground shadow-neo-sm",
              "hover:bg-muted disabled:opacity-50 transition-colors"
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              busy ||
              isSuccess ||
              deluluId === null ||
              milestoneId === null ||
              !mode
            }
            className={cn(
              "flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border-2 border-border shadow-neo-sm transition-all active:scale-[0.98]",
              mode === "reject"
                ? "bg-destructive/90 text-destructive-foreground hover:bg-destructive"
                : "bg-delulu-yellow-reserved text-delulu-charcoal hover:opacity-95"
            )}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Confirm…
              </>
            ) : mode === "reject" ? (
              "Reject"
            ) : (
              "Verify"
            )}
          </button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
