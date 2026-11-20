"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronLeft, Copy, KeyRound, Loader2 } from "lucide-react";
import { GameButton, Lulu } from "@/components/ds";
import { MainPage } from "@/components/main-app-header";
import { ICON_BUTTON_CLASS } from "@/components/page-back-header";
import { ExportKeySheet } from "@/components/wallet/export-key-sheet";
import { useAuth } from "@/hooks/use-auth";
import { FLOW_STATE, FLOW_URL } from "@/lib/flow-state";
import { useFlowVote } from "@/hooks/use-flow-vote";
import { useFaceCheckOptional } from "@/contexts/right-panel-context";
import { cn } from "@/lib/utils";

const APP_STORE = "https://apps.apple.com/app/metamask/id1438144202";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=io.metamask";
/** MetaMask's own link: opens the vote page straight inside MetaMask's browser. */
const openInMetaMask = (url: string) => `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, "")}`;

type Os = "ios" | "android" | "other";
function useOs(): Os {
  const [os, setOs] = useState<Os>("other");
  useEffect(() => {
    const ua = navigator.userAgent;
    setOs(/iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "other");
  }, []);
  return os;
}

const DONE_KEY = "delulu:flow-state-steps";
function useDoneSteps() {
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]"));
    } catch {
      /* private mode — start fresh */
    }
  }, []);
  const mark = (n: number) =>
    setDone((d) => {
      const next = d.includes(n) ? d : [...d, n];
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  return { done, mark };
}

function Step({ n, done, title, hint, children }: { n: number; done: boolean; title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-[20px] border-2 bg-white p-4 shadow-edge-sm", done ? "border-green-edge" : "border-line")}>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-base font-extrabold text-white",
            done ? "bg-green-edge" : "bg-ink",
          )}
        >
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
        </span>
        <h2 className="m-0 flex-1 text-[17px] font-extrabold leading-tight">{title}</h2>
      </div>
      {hint ? <p className="m-0 mt-2 text-[13px] font-semibold leading-snug text-muted-foreground">{hint}</p> : null}
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </section>
  );
}

const linkBtn =
  "press-edge inline-flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-extrabold uppercase tracking-[0.05em] no-underline";

/** Vote for Delulu on Flow State in 3 taps: get MetaMask, bring your wallet, vote. */
export default function FlowStateGuidePage() {
  const { address } = useAuth();
  const os = useOs();
  const { done, mark } = useDoneSteps();
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = FLOW_URL;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      mark(3);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is shown below to long-press */
    }
  };

  return (
    <MainPage>
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 pb-16 pt-4">
        <Link href="/home" aria-label="Home" className={ICON_BUTTON_CLASS}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </Link>

        <header className="flex items-center gap-3">
          <Lulu size={56} mood="kept" />
          <div>
            <p className="label-mono m-0 text-[11px] text-orange">Urgent · 2 minutes</p>
            <h1 className="m-0 mt-1 font-display text-[26px] font-extrabold uppercase leading-[0.95]">Vote for Delulu</h1>
          </div>
        </header>
        <p className="m-0 text-[14px] font-semibold text-muted-foreground">
          Your vote keeps rewards flowing to you.
          {FLOW_STATE.endsOn ? <b className="text-ink"> Ends {FLOW_STATE.endsOn}.</b> : null}
        </p>

        <VoteHere />

        {/* For anyone whose votes sit on another wallet: the old MetaMask way. */}
        <details className="group mt-2">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-1 py-2 text-[13px] font-extrabold text-muted-foreground">
            Vote another way (MetaMask)
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-3 pt-1">
        <Step n={1} done={done.includes(1)} title="Get MetaMask">
          <div className="flex gap-2">
            {os !== "android" ? (
              <a href={APP_STORE} target="_blank" rel="noopener noreferrer" onClick={() => mark(1)} className={cn(linkBtn, "bg-ink text-white shadow-edge-sm")}>
                App Store
              </a>
            ) : null}
            {os !== "ios" ? (
              <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" onClick={() => mark(1)} className={cn(linkBtn, "bg-ink text-white shadow-edge-sm")}>
                ▶ Google Play
              </a>
            ) : null}
          </div>
          <button type="button" onClick={() => mark(1)} className="text-[12px] font-bold text-muted-foreground underline">
            I already have it
          </button>
        </Step>

        <Step
          n={2}
          done={done.includes(2)}
          title="Add your Delulu wallet"
          hint={
            <>
              Copy your key → in MetaMask tap your <b className="text-ink">account name</b> → <b className="text-ink">Add account</b> →{" "}
              <b className="text-ink">Import account</b> → paste.
            </>
          }
        >
          <GameButton
            variant="ink"
            full
            disabled={!address}
            onClick={() => {
              setExportOpen(true);
              mark(2);
            }}
          >
            <KeyRound className="h-4 w-4" /> Copy my wallet key
          </GameButton>
        </Step>

        <Step
          n={3}
          done={done.includes(3)}
          title="Vote in MetaMask"
          hint={
            <>
              Copy the link → MetaMask <b className="text-ink">Explore</b> tab → paste in the search bar → <b className="text-ink">Connect</b> → vote for{" "}
              <b className="text-ink">Delulu</b>.
            </>
          }
        >
          <button
            type="button"
            onClick={copyLink}
            className={cn(linkBtn, "w-full bg-yellow text-ink shadow-edge-yellow")}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied — paste in Explore" : "Copy vote link"}
          </button>
          {os !== "other" ? (
            <a href={openInMetaMask(url)} onClick={() => mark(3)} className={cn(linkBtn, "w-full border-2 border-ink bg-white text-ink")}>
              🦊 Or open it in MetaMask
            </a>
          ) : null}
          <p className="m-0 select-all break-all rounded-xl bg-paper px-3 py-2 font-mono text-[11px] text-muted-foreground">{url}</p>
        </Step>
          </div>
        </details>
      </div>
      <ExportKeySheet open={exportOpen} onOpenChange={setExportOpen} />
    </MainPage>
  );
}

/** The one-tap vote, right here: claim your votes (a signature, no fee), then give them to Delulu. */
function VoteHere() {
  const vote = useFlowVote();
  const faceCheck = useFaceCheckOptional();
  const voted = vote.status === "voted";
  const line = vote.busy || vote.error || vote.notice;
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[24px] border-2 p-4",
        voted ? "border-green-edge bg-green-edge text-white shadow-[0_4px_0_#0d4a2a]" : "border-ink bg-ink text-white shadow-[0_4px_0_#000]",
      )}
    >
      <span className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-yellow/30 blur-3xl" aria-hidden />
      <div className="relative">
        <p className="m-0 font-display text-[22px] font-extrabold uppercase leading-none">
          {voted ? `${vote.votes} votes for Delulu ✓` : vote.status === "verify" ? "Verify to vote" : "Vote in one tap"}
        </p>
        <p className="m-0 mt-1.5 text-[13px] font-semibold text-white/75">
          {voted
            ? "Thank you — your votes stream rewards to Delulu all round."
            : vote.status === "verify"
              ? "Your face check gives you votes. It takes a minute."
              : vote.status === "full"
                ? "All your votes are on other projects. Change them on Flow State to back Delulu."
                : vote.status === "closed"
                  ? "Delulu isn't taking votes in this round right now."
                  : "Free · one tap — we claim your votes and give them to Delulu. Your other votes stay as they are."}
        </p>
        {line ? <p className={cn("m-0 mt-2 text-[12px] font-bold", vote.error ? "text-orange" : "text-yellow")}>{line}</p> : null}
        {vote.status === "vote" || vote.status === "verify" ? (
          <button
            type="button"
            disabled={!!vote.busy}
            onClick={() => (vote.status === "verify" ? faceCheck?.start() : void vote.voteAll())}
            className="press-edge mt-3.5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-yellow text-[14px] font-extrabold uppercase text-ink shadow-[0_3px_0_#b38f00] disabled:opacity-70"
          >
            {vote.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {vote.status === "verify" ? "Verify my face" : "Vote for Delulu"}
          </button>
        ) : vote.status === "full" ? (
          <a href={FLOW_URL} target="_blank" rel="noopener noreferrer" className="press-edge mt-3.5 flex h-12 w-full items-center justify-center rounded-2xl bg-white text-[14px] font-extrabold uppercase text-ink no-underline">
            Open Flow State
          </a>
        ) : vote.status === "loading" ? (
          <div className="mt-3.5 h-12 animate-pulse rounded-2xl bg-white/15" />
        ) : null}
        {vote.pending ? (
          <a href={`https://celoscan.io/tx/${vote.pending.hash}`} target="_blank" rel="noopener noreferrer" className="mt-2 block text-[12px] font-bold text-white/80 underline">
            View your vote ↗
          </a>
        ) : null}
      </div>
    </section>
  );
}
