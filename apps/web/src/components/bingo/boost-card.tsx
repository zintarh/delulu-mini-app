"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useChainId, usePublicClient } from "wagmi";
import { Loader2, Rocket } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { BOOST, BOOST_ABI } from "@/lib/bingo/boost";
import type { BingoView } from "@/lib/bingo/view";
import { GOODDOLLAR_ADDRESSES, getForfeitMarketAddress } from "@/lib/constant";
import { ngnWorthShowing } from "@/lib/earn/format";
import { showAppToast, fireConfetti } from "@/lib/celebrate";
import { afterVote } from "@/lib/vote-gate";
import { cn } from "@/lib/utils";

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : Math.round(n).toLocaleString("en-US"));

/** True once the live market has boostCommitment. A missing function reverts; a real one returns 0. */
let boostSupport: Promise<boolean> | null = null;
function marketSupportsBoost(client: NonNullable<ReturnType<typeof usePublicClient>>, market: `0x${string}`) {
  if (!boostSupport) {
    boostSupport = client
      .readContract({ address: market, abi: BOOST_ABI, functionName: "boostedAmount", args: [0n, 0] })
      .then(() => true)
      .catch(() => false);
  }
  return boostSupport;
}

/**
 * Top up any personal Bingo, at any stake: before today's photo, the player
 * picks how much G$ to add from their wallet. Claiming today's free G$ is
 * separate. Never required: the photo works without a top-up.
 */
export function BoostCard({ bingo, onBoosted, className }: { bingo: BingoView; onBoosted: () => void | Promise<void>; className?: string }) {
  const me = bingo.me;
  const boost = me?.boost;
  const { address } = useAuth();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const facts = useEarnFacts();
  const claim = useGoodDollarClaim();
  const { formatted, refetch } = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const market = (() => {
    try {
      return getForfeitMarketAddress(chainId);
    } catch {
      return undefined;
    }
  })();
  const approval = useTokenApproval(GOODDOLLAR_ADDRESSES.mainnet, market);
  const { writeContractAsync } = useUnifiedWriteContract();
  const [step, setStep] = useState<"idle" | "claiming" | "boosting" | "saving">("idle");
  const [raw, setRaw] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (!publicClient || !market) return;
    let cancel = false;
    void marketSupportsBoost(publicClient, market).then((ok) => {
      if (!cancel) setSupported(ok);
    });
    return () => {
      cancel = true;
    };
  }, [publicClient, market]);

  if (!me || !boost || supported == null) return null;

  const days = bingo.durationDays;
  const naira = (g: number) => (facts ? ngnWorthShowing(g * facts.gdUsd * facts.ngnPerUsd) : null) ?? `${k(g)} G$`;
  const claimable = claim.entitlement != null && claim.entitlement > 0n && !claim.hasClaimed ? Number(formatUnits(claim.entitlement, 18)) : 0;
  const balance = Math.floor(Number(formatted) || 0);
  const amount = /^\d+$/.test(raw) ? Number(raw) : 0;
  const open = boost.openSlot != null;
  const today = me.today ?? 0;
  const busy = step !== "idle";
  const levels = [...new Set(bingo.tiers.map((t) => t.stake).filter((s) => s > 0))].sort((a, b) => a - b);

  const claimOnly = async () => {
    if (!address) {
      setFormError("Connect your wallet to claim.");
      return;
    }
    setFormError(null);
    try {
      setStep("claiming");
      await afterVote(claim.claim);
      showAppToast("Claimed. It's in your wallet — top up any amount you want.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const text = /user (rejected|denied)|rejected the request|cancel/i.test(msg) ? "Cancelled." : msg || "Couldn't claim. Try again.";
      setFormError(text);
      showAppToast(text);
    } finally {
      setStep("idle");
    }
  };

  const run = async () => {
    if (!address || !market) {
      setFormError("Connect your wallet to top up.");
      return;
    }
    if (!open) {
      setFormError("Top up before today's photo.");
      return;
    }
    if (!/^\d+$/.test(raw) || amount <= 0) {
      setFormError("Enter how much G$ you want to add.");
      return;
    }
    if (amount > balance) {
      setFormError(`You have ${k(balance)} G$ in your wallet.`);
      return;
    }
    if (!supported) {
      setFormError("This card can't take a top-up yet.");
      return;
    }
    setFormError(null);
    try {
      setStep("boosting");
      if (approval.needsApproval(amount)) await approval.approve(amount);
      const hash = await writeContractAsync({
        address: market,
        abi: BOOST_ABI,
        functionName: "boostCommitment",
        args: [BigInt(boost.commitmentId), parseUnits(String(amount), 18)],
      });
      await publicClient?.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      setStep("saving");
      let saved = false;
      for (let i = 0; i < 6; i++) {
        const res = await fetch(`/api/bingo/attempts/${me.attemptId}/boost`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: hash }),
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string; retryable?: boolean };
        if (res.ok) {
          saved = true;
          break;
        }
        if (!j.retryable) throw new Error(j.error ?? "Couldn't save your top-up.");
        await new Promise((r) => setTimeout(r, 1500 + i * 1500));
      }
      if (!saved) throw new Error("Top-up is on your card. Pull to refresh if the number doesn't move.");
      fireConfetti?.();
      setRaw("");
      showAppToast(`Added ${k(amount)} G$ to your stake.`);
      void refetch();
      await onBoosted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const text = /user (rejected|denied)|rejected the request|cancel/i.test(msg) ? "Cancelled." : msg || "Couldn't top up. Try again.";
      setFormError(text);
      showAppToast(text);
    } finally {
      setStep("idle");
    }
  };

  return (
    <section className={cn("rounded-[22px] border-2 border-ink bg-white p-3.5 text-ink shadow-[0_3px_0_#000]", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label-mono m-0 text-[10px] text-muted-foreground">Top up your stake</p>
          <p className="m-0 mt-0.5 flex items-baseline gap-2">
            <span className="font-display text-[30px] font-extrabold leading-none text-green-edge">{boost.pct}%</span>
            <span className="text-[13px] font-extrabold">+{naira(boost.cashback)}</span>
          </p>
        </div>
        {boost.perfect ? (
          <span className="shrink-0 rounded-full bg-yellow px-2.5 py-1 text-[11px] font-extrabold uppercase">🚀 {BOOST.basePct + days * BOOST.stepPct}% club</span>
        ) : (
          <span className="shrink-0 text-right text-[11px] font-bold text-muted-foreground">
            up to {Math.min(BOOST.maxPct, BOOST.basePct + days * BOOST.stepPct)}%
          </span>
        )}
      </div>

      {/* One dot a day: boosted days glow. */}
      <ol className="m-0 mt-2.5 flex list-none gap-1 p-0" aria-label="Boosted days">
        {Array.from({ length: days }, (_, i) => {
          const on = boost.boostedSlots.includes(i);
          return (
            <li
              key={i}
              className={cn(
                "h-2 flex-1 rounded-full",
                on ? "bg-green-edge shadow-[0_0_8px_rgba(45,179,111,0.6)]" : i === today && boost.openSlot != null ? "bg-yellow" : "bg-line",
              )}
            />
          );
        })}
      </ol>

      {open ? (
        <>
          <label className="mt-3 block">
            <span className="label-mono text-[10px] text-muted-foreground">From your wallet · {k(balance)} G$</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={raw}
              disabled={busy}
              placeholder="Amount to add"
              onChange={(e) => {
                setRaw(e.target.value.replace(/\D/g, ""));
                setFormError(null);
              }}
              className="mt-1 h-12 w-full rounded-2xl border-2 border-ink bg-paper px-3 text-[16px] font-extrabold outline-none"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {levels.map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy || n > balance}
                onClick={() => {
                  setRaw(String(n));
                  setFormError(null);
                }}
                className="rounded-full bg-yellow-soft px-2.5 py-1 text-[11px] font-extrabold text-ink disabled:opacity-40"
              >
                {k(n)}
              </button>
            ))}
            <button
              type="button"
              disabled={busy || balance <= 0}
              onClick={() => {
                setRaw(String(balance));
                setFormError(null);
              }}
              className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-extrabold text-white disabled:opacity-40"
            >
              Max
            </button>
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy || amount <= 0}
            className="press-edge mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-green text-[14px] font-extrabold uppercase text-white shadow-[0_3px_0_#1d8a52] disabled:opacity-70"
          >
            {busy && step !== "claiming" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {step === "boosting" ? "Topping up…" : step === "saving" ? "Saving…" : amount > 0 ? `Top up ${k(amount)} G$` : "Top up"}
          </button>
          {formError ? <p className="m-0 mt-1.5 text-center text-[12px] font-bold text-orange">{formError}</p> : null}
          <p className="m-0 mt-1.5 text-center text-[12px] font-extrabold text-ink">The higher your stake, the higher your reward.</p>
          <p className="m-0 mt-0.5 text-center text-[11px] font-semibold text-muted-foreground">
            {boost.boostedToday
              ? "Added today. You can add more before your photo."
              : "Any card, any stake. Pick the amount from your wallet, before today's photo."}
          </p>
          {claimable > 0 ? (
            <button type="button" onClick={() => void claimOnly()} disabled={busy} className="mt-1 w-full text-center text-[12px] font-extrabold text-green-edge disabled:opacity-60">
              {step === "claiming" ? "Claiming…" : `Claim today's ${k(claimable)} G$ first`}
            </button>
          ) : null}
        </>
      ) : boost.boostedToday ? (
        <p className="m-0 mt-2 text-[12px] font-bold text-green-edge">Topped up today. Keep the day so the bigger stake pays.</p>
      ) : null}
    </section>
  );
}
