"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { erc20Abi, parseUnits } from "viem";
import { Loader2 } from "lucide-react";
import { Coin, Lulu, Trophy } from "@/components/ds";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { useAuth } from "@/hooks/use-auth";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { CHEER_AMOUNTS, LEADERBOARD_SIZE } from "@/lib/bingo/cheers";
import type { CheerContest } from "@/lib/bingo/cheers-server";
import { fmtNgn } from "@/lib/earn/format";
import { fireConfetti, showAppToast } from "@/lib/celebrate";
import { cn } from "@/lib/utils";

const k = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n));
const lagosWeekday = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "long" }).format(new Date(Date.parse(iso) - 1));

export function useCheerContest(slug: string) {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["cheers", slug, address?.toLowerCase() ?? null],
    staleTime: 20_000,
    queryFn: async (): Promise<CheerContest> => {
      const res = await fetch(`/api/bingo/${slug}/cheers${address ? `?address=${address}` : ""}`);
      if (!res.ok) throw new Error("contest unavailable");
      return res.json();
    },
  });
}

/** The weekly prize, front and centre: Lulu with the trophy, the prize, the top 3. */
export function CheerContestBanner({ contest, onCheer }: { contest: CheerContest; onCheer?: () => void }) {
  if (!contest.live) return null;
  const top = contest.leaderboard.slice(0, 3);
  return (
    <div className="relative overflow-hidden rounded-[24px] border-2 border-ink bg-yellow p-4 shadow-[0_4px_0_#000]">
      {/* Lulu cheering next to the trophy */}
      <div className="absolute -right-2 -top-1 flex items-end">
        <span className="animate-bob">
          <Trophy size={52} />
        </span>
        <Lulu size={64} mood="kept" wave className="-ml-3" />
      </div>
      <p className="label-mono m-0 text-[10px] text-[#5c4a0a]">Best card this week</p>
      <p className="m-0 mt-0.5 font-display text-[30px] font-extrabold uppercase leading-none">Wins {k(contest.prizeG)} G$</p>
      <p className="m-0 mt-1 max-w-[62%] text-[12px] font-bold leading-snug">
        {contest.eligible
          ? `Cheer cards to vote · ends ${contest.endsAt ? lagosWeekday(contest.endsAt) : "soon"}`
          : `Unlocks at ${contest.minPlayers} players · ${contest.players}/${contest.minPlayers} so far`}
      </p>
      {top.length ? (
        <div className="mt-3 flex items-center gap-1.5">
          {top.map((e, i) => (
            <span key={e.attemptId} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold">
              {["🥇", "🥈", "🥉"][i]} @{e.username ?? e.wallet.slice(0, 6)} <span className="text-orange">🔥{e.score}</span>
            </span>
          ))}
        </div>
      ) : null}
      {onCheer && contest.eligible ? (
        <button
          type="button"
          onClick={onCheer}
          className="press-edge mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-extrabold uppercase text-white shadow-[0_3px_0_#000]"
        >
          🔥 Cheer a card
        </button>
      ) : null}
    </div>
  );
}

/**
 * Cheer one card: pick an amount, one tap, it's sent straight to the player.
 * Every cheer is a vote — more people cheering beats one big wallet.
 */
export function CheerPanel({
  slug,
  attemptId,
  ownerWallet,
  ownerName,
  contest,
}: {
  slug: string;
  attemptId: string;
  ownerWallet: string;
  ownerName: string;
  contest: CheerContest | undefined;
}) {
  const { address } = useAuth();
  const { requireAuth } = useRedirectToSignIn();
  const qc = useQueryClient();
  const facts = useEarnFacts();
  const { formatted } = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const balance = Number(formatted) || 0;
  const { writeContractAsync } = useUnifiedWriteContract();
  const [amount, setAmount] = useState<number>(CHEER_AMOUNTS[0]);
  const [step, setStep] = useState<"pick" | "sending" | "counting" | "done">("pick");
  const [error, setError] = useState<string | null>(null);

  const mine = !!address && address.toLowerCase() === ownerWallet.toLowerCase();
  const already = contest?.cheeredToday.includes(attemptId);
  const score = contest?.scores[attemptId];
  const rank = contest ? contest.leaderboard.findIndex((e) => e.attemptId === attemptId) + 1 : 0;
  const ngn = (g: number) => (facts ? fmtNgn(g * facts.gdUsd * facts.ngnPerUsd) : null);

  if (!contest?.live || contest.setupPending) return null;

  const cheer = () =>
    requireAuth(async () => {
      setError(null);
      setStep("sending");
      let hash: `0x${string}`;
      try {
        hash = await writeContractAsync({
          address: GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`,
          abi: erc20Abi,
          functionName: "transfer",
          args: [ownerWallet as `0x${string}`, parseUnits(String(amount), 18)],
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        setError(/reject|denied|cancel/i.test(msg) ? "Cancelled — nothing was sent." : "Couldn't send. Check you have a little CELO for gas.");
        setStep("pick");
        return;
      }
      setStep("counting");
      const res = await fetch("/api/bingo/cheers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, txHash: hash, amount }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Sent — counting your vote shortly.");
        setStep("pick");
      } else {
        setStep("done");
        void fireConfetti();
        showAppToast(`🔥 You cheered ${ownerName}!`);
      }
      void qc.invalidateQueries({ queryKey: ["cheers", slug] });
    });

  if (mine) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-yellow-soft px-3 py-3">
        <Lulu size={44} mood="kept" />
        <p className="m-0 text-[13px] font-bold leading-snug">
          {score ? `🔥 ${score.score} · ${score.voters} ${score.voters === 1 ? "person" : "people"} cheered you` : "Share your card — every cheer is a vote and G$ in your pocket."}
          {rank ? ` · #${rank}` : ""}
        </p>
      </div>
    );
  }

  if (step === "done" || already) {
    return (
      <div className="mt-3 flex flex-col items-center gap-1 rounded-2xl bg-green-soft px-3 py-4 text-center">
        <Lulu size={72} mood="kept" wave />
        <p className="m-0 font-display text-[22px] font-extrabold uppercase text-green-edge">Cheered!</p>
        <p className="m-0 text-[12px] font-bold text-green-edge">One vote for {ownerName} today · come back tomorrow</p>
      </div>
    );
  }

  const busy = step !== "pick";
  return (
    <div className="mt-3 rounded-[22px] border-2 border-ink bg-white p-3.5 shadow-[0_3px_0_#000]">
      <div className="flex items-center gap-3">
        <Lulu size={56} mood="kept" wave />
        <div className="min-w-0">
          <p className="m-0 text-[16px] font-extrabold leading-tight">Cheer {ownerName}</p>
          <p className="m-0 text-[12px] font-semibold text-muted-foreground">
            {score ? `🔥 ${score.score} · ${score.voters} cheering` : "Be the first to cheer"}
            {rank ? ` · #${rank} of top ${LEADERBOARD_SIZE}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {CHEER_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAmount(a)}
            disabled={busy}
            className={cn(
              "press-edge flex flex-col items-center rounded-2xl border-2 py-2",
              a === amount ? "border-ink bg-ink text-white shadow-[0_3px_0_#000]" : "border-line bg-white shadow-edge-sm",
            )}
          >
            <span className="flex items-center gap-1 font-display text-[18px] font-extrabold leading-none">
              <Coin size={16} /> {k(a)}
            </span>
            {ngn(a) ? <span className="text-[10px] font-bold opacity-70">≈ {ngn(a)}</span> : null}
          </button>
        ))}
      </div>
      {error ? <p className="m-0 mt-2 text-[12px] font-bold text-orange">{error}</p> : null}
      <button
        type="button"
        onClick={cheer}
        disabled={busy || (address ? balance < amount : false)}
        className="press-edge mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-yellow text-[15px] font-extrabold uppercase text-ink shadow-edge-yellow disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "🔥"}
        {step === "sending" ? "Confirm in your wallet…" : step === "counting" ? "Counting your vote…" : address && balance < amount ? "Not enough G$" : `Cheer ${k(amount)} G$`}
      </button>
      <p className="m-0 mt-1.5 text-center text-[10px] font-semibold text-muted-foreground">Goes straight to {ownerName} · 1 cheer per card a day</p>
    </div>
  );
}

const PROMPT_KEY = "delulu:cheer-prompt";

/** Once a day on a Bingo with a live contest: Lulu asks you to cheer someone into the top 10. */
export function CheerPrompt({ contest, onPick }: { contest: CheerContest | undefined; onPick: () => void }) {
  const { address } = useAuth();
  const [open, setOpen] = useState(false);
  const show = !!address && !!contest?.live && contest.eligible && !contest.setupPending && contest.cheeredToday.length === 0;
  useEffect(() => {
    if (!show) return;
    const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(PROMPT_KEY) === today) return;
      localStorage.setItem(PROMPT_KEY, today);
    } catch {
      /* show it */
    }
    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, [show]);
  if (!contest) return null;
  return (
    <ResponsiveSheet open={open} onOpenChange={setOpen} title="Cheer someone" hideTitleVisually sheetClassName="rounded-t-3xl pb-10" modalClassName="max-w-sm">
      <div className="flex flex-col items-center gap-2 px-5 pb-2 pt-2 text-center">
        <div className="flex items-end">
          <Lulu size={96} mood="kept" wave />
          <span className="-ml-4 mb-1 animate-bob">
            <Trophy size={64} />
          </span>
        </div>
        <p className="m-0 font-display text-[28px] font-extrabold uppercase leading-none">Best card wins {k(contest.prizeG)} G$</p>
        <p className="m-0 text-[14px] font-semibold text-muted-foreground">Cheer someone into the top {LEADERBOARD_SIZE}. More cheers, higher they climb.</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onPick();
          }}
          className="press-edge mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] font-extrabold uppercase text-white shadow-[0_3px_0_#000]"
        >
          🔥 Pick a card to cheer
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-9 text-[13px] font-bold text-muted-foreground">
          Maybe later
        </button>
      </div>
    </ResponsiveSheet>
  );
}
