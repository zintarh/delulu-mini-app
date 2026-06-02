"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChallengeOption = { id: number; title?: string };

export function DeluluJoinCampaignModal({
  open,
  challenges,
  selectedChallengeId,
  onSelectChallenge,
  joinErrorMessage,
  isJoining,
  isConfirming,
  onCancel,
  onJoin,
}: {
  open: boolean;
  challenges: ChallengeOption[];
  selectedChallengeId: number | null;
  onSelectChallenge: (id: number | null) => void;
  joinErrorMessage: string | null | undefined;
  isJoining: boolean;
  isConfirming: boolean;
  onCancel: () => void;
  onJoin: () => void;
}) {
  if (!open) return null;

  const busy = isJoining || isConfirming;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl border border-border">
        <h3 className="text-base md:text-lg font-black text-foreground mb-2">
          Join a campaign
        </h3>
        <p className="text-xs md:text-sm text-muted-foreground mb-4">
          Select an active campaign to join with this delulu. Once joined, it
          can earn points and appear on the campaign leaderboard.
        </p>

        <div className="mb-4">
          {challenges.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No active campaigns available to join right now.
            </p>
          ) : (
            <select
              className="w-full px-3 py-2 h-[46px] text-sm rounded-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              value={selectedChallengeId ?? ""}
              onChange={(e) =>
                onSelectChallenge(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            >
              <option value="">Select a campaign</option>
              {challenges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || `Campaign #${c.id}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {joinErrorMessage ? (
          <p className="mb-2 text-xs text-red-500">{joinErrorMessage}</p>
        ) : null}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-3 py-2 text-xs md:text-sm font-semibold rounded-md border border-border bg-secondary text-muted-foreground hover:bg-secondary/80 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              !selectedChallengeId || busy || challenges.length === 0
            }
            onClick={onJoin}
            className={cn(
              "px-4 py-2 text-xs md:text-sm font-black rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1a1a19]",
              "bg-delulu-yellow-reserved text-delulu-charcoal hover:scale-[0.98] transition-transform",
              (!selectedChallengeId || busy) && "opacity-60 cursor-not-allowed",
            )}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 inline-block animate-spin" />
                Joining...
              </>
            ) : (
              "Join campaign"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
