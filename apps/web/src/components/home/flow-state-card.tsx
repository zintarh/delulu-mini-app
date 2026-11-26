"use client";

import Link from "next/link";
import { useRef } from "react";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { useFaceCheckOptional } from "@/contexts/right-panel-context";
import { useFlowVote } from "@/hooks/use-flow-vote";
import { FLOW_STATE } from "@/lib/flow-state";
import { useFlowVoteLive } from "@/hooks/use-flow-vote-live";
import { cn } from "@/lib/utils";

/**
 * The vote ask — one slim row while the Flow State vote is on, and the vote
 * happens right here: one tap claims the player's votes (a signature, no fee)
 * and gives them to Delulu. The /flow-state page has the details.
 *
 * On Home it's only for people who haven't voted (Home stays light): it waits
 * until we know, and after voting there it stays for the thank-you, then is
 * gone on the next visit. The Activity panel always has it while the vote is on.
 */
export function FlowStateCard({ place = "home" }: { place?: "home" | "activity" }) {
  if (useFlowVoteLive() !== true) return null;
  return <FlowStateRow place={place} />;
}

function FlowStateRow({ place }: { place: "home" | "activity" }) {
  const vote = useFlowVote();
  const faceCheck = useFaceCheckOptional();
  const voted = vote.status === "voted";
  // Seen not-yet-voted this visit → keep the row after voting, for the thank-you.
  const askedHere = useRef(false);
  if (vote.status === "vote" || vote.status === "verify" || vote.status === "full") askedHere.current = true;
  if (place === "home" && (vote.status === "loading" || vote.status === "closed" || (voted && !askedHere.current))) return null;
  const sub = vote.busy
    ? vote.busy
    : vote.error
      ? vote.error
      : vote.notice
        ? vote.notice
        : voted
          ? `Thank you! ${vote.votes} votes for Delulu`
          : vote.status === "verify"
            ? "Verify your face to get your votes"
            : `Free · one tap${FLOW_STATE.endsOn ? ` · ends ${FLOW_STATE.endsOn}` : ""}`;

  const action =
    vote.status === "loading" || vote.status === "closed" ? null : voted ? (
      <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-green-soft px-3 text-[12px] font-extrabold uppercase text-green-edge">
        <Check className="h-4 w-4" strokeWidth={3} /> Voted
      </span>
    ) : vote.status === "full" ? (
      <Link href="/flow-state" className="inline-flex h-9 shrink-0 items-center rounded-xl bg-white px-3 text-[12px] font-extrabold uppercase text-ink no-underline ring-2 ring-line">
        See how
      </Link>
    ) : (
      <button
        type="button"
        disabled={!!vote.busy}
        onClick={() => (vote.status === "verify" ? faceCheck?.start() : void vote.voteAll())}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-yellow px-3 text-[12px] font-extrabold uppercase text-ink shadow-edge-yellow disabled:opacity-70"
      >
        {vote.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {vote.status === "verify" ? "Verify" : "Vote"}
      </button>
    );

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 py-2.5 pl-3 pr-2 text-ink",
        voted ? "border-green-line bg-white" : "border-ink bg-white shadow-[0_3px_0_#161615]",
      )}
    >
      <span className="text-[22px] leading-none" aria-hidden>
        🗳️
      </span>
      <Link href="/flow-state" className="min-w-0 flex-1 text-ink no-underline">
        <span className="block truncate text-[14px] font-extrabold leading-tight">Vote for Delulu on Flow State</span>
        <span className={cn("block truncate text-[11px] font-semibold", vote.error ? "text-orange" : voted ? "text-green-edge" : "text-muted-foreground")}>{sub}</span>
      </Link>
      {action}
      <Link href="/flow-state" aria-label="About the vote" className="shrink-0 text-muted-foreground">
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
