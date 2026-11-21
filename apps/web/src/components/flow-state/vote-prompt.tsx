"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Lulu } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { useFlowVote } from "@/hooks/use-flow-vote";
import { useFlowVotersLine } from "@/hooks/use-flow-voters";
import { useFaceCheckOptional } from "@/contexts/right-panel-context";
import { fireConfetti } from "@/lib/celebrate";
import { FLOW_STATE, flowStateLive } from "@/lib/flow-state";
import { canAutoShow, takeAutoSlot } from "@/lib/overlay-slot";
import { registerVoteGate } from "@/lib/vote-gate";

const SNOOZE_KEY = "delulu:vote-prompt-snoozed-at";
/** "Not now" holds it back this long, then it asks again. */
const SNOOZE_MS = 4 * 60 * 60 * 1000;

/**
 * The Flow State vote, as a pop-up: shows on its own for anyone who hasn't
 * voted yet (even on a first visit, after the intro and gift), takes the
 * visit's one automatic pop-up ahead of the others, and comes back 4 hours
 * after "Not now". The vote itself happens right here, in one tap.
 *
 * It is also the vote gate (lib/vote-gate.ts): before a Bingo photo or a daily
 * claim, a player who can vote and hasn't gets this screen with no "Not now";
 * once they've voted the action carries on. If the vote itself fails they can
 * continue, so a broken vote never locks anyone out of the app.
 */
export function VotePrompt() {
  const { address } = useAuth();
  if (!address || !flowStateLive()) return null;
  return <VotePromptInner key={address} />;
}

function VotePromptInner() {
  const vote = useFlowVote();
  const votersLine = useFlowVotersLine();
  const faceCheck = useFaceCheckOptional();
  const [open, setOpen] = useState(false);
  const shown = useRef(false);
  const needsVote = vote.status === "vote" || vote.status === "verify";
  // Gate mode: opened by an action, which waits on this promise.
  const [gate, setGate] = useState(false);
  const release = useRef<(() => void) | null>(null);
  const live = useRef({ status: vote.status, pending: !!vote.pending });
  live.current = { status: vote.status, pending: !!vote.pending };
  const letThrough = () => {
    release.current?.();
    release.current = null;
    setGate(false);
    setOpen(false);
  };

  useEffect(() => {
    registerVoteGate(() => {
      // Only players who can vote right now and haven't (verified, votes to give, nothing in flight).
      if (live.current.status !== "vote" || live.current.pending) return Promise.resolve();
      return new Promise<void>((resolve) => {
        release.current?.();
        release.current = resolve;
        shown.current = true;
        setGate(true);
        setOpen(true);
      });
    });
    return () => {
      registerVoteGate(null);
      release.current?.();
      release.current = null;
    };
  }, []);

  // Open once we know they haven't voted — waiting out the intro / gift modals (up to ~40s).
  useEffect(() => {
    if (shown.current || !needsVote || vote.pending) return;
    let snoozedAt = 0;
    try {
      snoozedAt = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    } catch {
      /* storage blocked */
    }
    if (Date.now() - snoozedAt < SNOOZE_MS) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (canAutoShow("vote", { firstVisit: true })) {
        takeAutoSlot("vote");
        shown.current = true;
        setOpen(true);
        window.clearInterval(id);
      } else if (tries > 20) window.clearInterval(id);
    }, 2000);
    return () => window.clearInterval(id);
  }, [needsVote, vote.pending]);

  // Voted: a little party, then out of the way.
  const voted = vote.status === "voted";
  useEffect(() => {
    if (!open || !voted) return;
    void fireConfetti();
    // From an action: a short thank-you, then the action carries on.
    const t = window.setTimeout(() => (gate ? letThrough() : setOpen(false)), gate ? 1400 : 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, voted, gate]);

  const snooze = () => {
    setOpen(false);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* storage blocked */
    }
  };
  const line = vote.busy || vote.error || vote.notice;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => {
        if (o) return setOpen(true);
        if (gate) {
          // Required: it only closes once they've voted, or if voting failed.
          if (voted || vote.error) letThrough();
          return;
        }
        if (voted) setOpen(false);
        else snooze();
      }}
      title="Vote for Delulu"
      hideTitleVisually
      sheetClassName="rounded-t-3xl pb-10"
      modalClassName="max-w-md"
    >
      <div className="px-4 pb-2 pt-1">
        <div className="relative overflow-hidden rounded-[24px] border-2 border-ink bg-ink p-5 text-center text-white shadow-[0_5px_0_#000]">
          <span className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-yellow/35 blur-3xl" aria-hidden />
          <span className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-green/30 blur-3xl" aria-hidden />
          <div className="relative flex flex-col items-center">
            <span className="animate-bob">
              <Lulu size={72} mood="kept" />
            </span>
            <p className="m-0 mt-2 font-display text-[28px] font-extrabold uppercase leading-none">
              {voted ? "Thank you!" : "Vote for Delulu 🗳️"}
            </p>
            <p className="m-0 mt-2 max-w-[260px] text-[14px] font-semibold leading-snug text-white/75">
              {voted
                ? `${vote.votes} votes for Delulu — that keeps the rewards flowing.`
                : gate
                  ? "Free · one tap · then you carry on."
                  : vote.status === "verify"
                  ? "A quick face check gives you votes. Then one tap."
                  : "Free · one tap · it keeps the rewards flowing to you."}
            </p>
            {votersLine && !voted ? <p className="m-0 mt-2 text-[12px] font-bold text-white/90">{votersLine}</p> : null}
            {FLOW_STATE.endsOn && !voted ? <p className="label-mono m-0 mt-2 text-[10px] text-yellow">Ends {FLOW_STATE.endsOn}</p> : null}
            {line ? <p className={`m-0 mt-2 text-[12px] font-bold ${vote.error ? "text-orange" : "text-yellow"}`}>{line}</p> : null}

            {voted ? (
              <span className="mt-4 inline-flex h-12 items-center gap-2 rounded-2xl bg-green px-6 text-[14px] font-extrabold uppercase text-white">
                <Check className="h-5 w-5" strokeWidth={3} /> Voted
              </span>
            ) : (
              <button
                type="button"
                disabled={!!vote.busy}
                onClick={() => {
                  if (vote.status === "verify") {
                    setOpen(false);
                    faceCheck?.start();
                  } else void vote.voteAll();
                }}
                className="press-edge mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-yellow text-[15px] font-extrabold uppercase text-ink shadow-[0_3px_0_#b38f00] disabled:opacity-70"
              >
                {vote.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {vote.status === "verify" ? "Verify my face" : "Vote now"}
              </button>
            )}
          </div>
        </div>
        {voted ? null : gate ? (
          // Required step: the only way past without voting is a vote that failed.
          vote.error ? (
            <button type="button" onClick={letThrough} disabled={!!vote.busy} className="mt-2 h-10 w-full text-[13px] font-bold text-muted-foreground">
              Continue for now
            </button>
          ) : null
        ) : (
          <button type="button" onClick={snooze} disabled={!!vote.busy} className="mt-2 h-10 w-full text-[13px] font-bold text-muted-foreground">
            Not now
          </button>
        )}
      </div>
    </ResponsiveSheet>
  );
}
