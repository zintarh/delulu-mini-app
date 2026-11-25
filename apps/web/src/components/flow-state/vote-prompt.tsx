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
import { registerVoteGate } from "@/lib/vote-gate";

/**
 * The Flow State vote, as a pop-up. Anyone who hasn't voted sees it when the
 * app opens, and again when they come back to it. An action waits on the same
 * screen: voting lets the action continue, "Not now" cancels it.
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
  const needsVote = vote.status === "vote" || vote.status === "verify";
  // Gate mode: opened by an action, which waits on this promise.
  const [gate, setGate] = useState(false);
  const release = useRef<{ resolve: () => void; reject: () => void } | null>(null);
  const live = useRef({ status: vote.status, pending: !!vote.pending });
  live.current = { status: vote.status, pending: !!vote.pending };
  const settle = (ok: boolean) => {
    const waiting = release.current;
    release.current = null;
    setGate(false);
    setOpen(false);
    if (!waiting) return;
    if (ok) waiting.resolve();
    else waiting.reject();
  };

  useEffect(() => {
    registerVoteGate(() => {
      // Wait out the first read so an action that just landed still gets the popup.
      return new Promise<void>((resolve, reject) => {
        let tries = 0;
        const openIfReady = () => {
          const status = live.current.status;
          if (status === "loading" && tries < 12) {
            tries += 1;
            window.setTimeout(openIfReady, 250);
            return;
          }
          if (status !== "vote" && status !== "verify") {
            resolve();
            return;
          }
          release.current?.reject();
          release.current = { resolve, reject };
          setGate(true);
          setOpen(true);
        };
        openIfReady();
      });
    });
    return () => {
      registerVoteGate(null);
      release.current?.reject();
      release.current = null;
    };
  }, []);

  // Open as soon as we know they haven't voted, including the next time the app is opened.
  useEffect(() => {
    if (!needsVote || vote.pending) return;
    setOpen(true);
  }, [needsVote, vote.pending]);

  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState !== "visible") return;
      const status = live.current.status;
      if (status === "vote" || status === "verify") setOpen(true);
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  // Voted: a little party, then out of the way.
  const voted = vote.status === "voted";
  useEffect(() => {
    if (!open || !voted) return;
    void fireConfetti();
    // From an action: a short thank-you, then the action carries on.
    const t = window.setTimeout(() => (gate ? settle(true) : setOpen(false)), gate ? 1400 : 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, voted, gate]);

  // Closing without voting drops the action that was waiting. Browsing can continue.
  const dismiss = () => {
    if (gate) settle(false);
    else setOpen(false);
  };
  const voteCount = Number(vote.votingPower);
  const votesToGive = voteCount > 0 ? voteCount : 10;
  const line = vote.busy || vote.error || vote.notice;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => {
        if (o) return setOpen(true);
        if (voted && !gate) {
          setOpen(false);
          return;
        }
        dismiss();
      }}
      title="Vote for Delulu"
      hideTitleVisually
      overlayClassName="z-[80]"
      sheetClassName="z-[90] rounded-t-3xl pb-10"
      modalClassName="z-[90] max-w-md"
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
            <p className="m-0 mt-2 max-w-[280px] text-[14px] font-semibold leading-snug text-white/75">
              {voted
                ? "Thank you for supporting Delulu."
                : vote.status === "verify"
                  ? "A quick face check gives you votes. Then one tap."
                  : `Please support Delulu so we can keep going. Give us your ${votesToGive} votes.`}
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
                    faceCheck?.start();
                    if (gate) settle(false);
                    else setOpen(false);
                    return;
                  }
                  void vote.voteAll();
                }}
                className="press-edge mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-yellow text-[15px] font-extrabold uppercase text-ink shadow-[0_3px_0_#b38f00] disabled:opacity-70"
              >
                {vote.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {vote.status === "verify" ? "Verify my face" : `Give your ${votesToGive} votes`}
              </button>
            )}
          </div>
        </div>
        {voted ? null : (
          <button type="button" onClick={dismiss} className="mt-2 h-10 w-full text-[13px] font-bold text-muted-foreground">
            Not now
          </button>
        )}
      </div>
    </ResponsiveSheet>
  );
}
