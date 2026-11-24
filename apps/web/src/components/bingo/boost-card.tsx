"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useChainId, usePublicClient } from "wagmi";
import { Loader2, Rocket } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { BOOST, BOOST_ABI, dailyBoostCap } from "@/lib/bingo/boost";
import type { BingoView } from "@/lib/bingo/view";
import { GOODDOLLAR_ADDRESSES, getForfeitMarketAddress } from "@/lib/constant";
import { ngnWorthShowing } from "@/lib/earn/format";
import { showAppToast, fireConfetti } from "@/lib/celebrate";
import { afterVote } from "@/lib/vote-gate";
import { cn } from "@/lib/utils";

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : Math.round(n).toLocaleString("en-US"));

/**
 * Daily Boost on your own card: the cashback meter (10% → up to 17%), the
 * day dots, and — before today's photo — one button that claims today's free
 * money and adds it to the card. Never required: the photo works without it.
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

  if (!BOOST.live || !me || !boost) return null;

  const days = bingo.durationDays;
  const naira = (g: number) => (facts ? ngnWorthShowing(g * facts.gdUsd * facts.ngnPerUsd) : null) ?? `${k(g)} G$`;
  const claimable = claim.entitlement != null && claim.entitlement > 0n && !claim.hasClaimed ? Number(formatUnits(claim.entitlement, 18)) : 0;
  const balance = Number(formatted) || 0;
  const cap = dailyBoostCap(me.stake, claimable);
  // Suggest today's free money; without a claim, what they hold up to the cap.
  const amount = Math.floor(claimable > 0 ? Math.min(claimable + balance, cap) : Math.min(balance, cap));
  const canBoost = boost.openSlot != null && !boost.boostedToday && amount > 0;
  const nextPct = Math.min(BOOST.maxPct, boost.pct + BOOST.stepPct);
  const today = me.today ?? 0;
  const skippedYesterday = today > 0 && !boost.boostedSlots.includes(today - 1);
  const busy = step !== "idle";

  const run = async () => {
    if (!address || !market || boost.openSlot == null) return;
    try {
      if (claimable > 0) {
        setStep("claiming");
        await afterVote(claim.claim);
      }
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
      for (let i = 0; i < 6; i++) {
        const res = await fetch(`/api/bingo/attempts/${me.attemptId}/boost`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: hash }),
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string; retryable?: boolean };
        if (res.ok) break;
        if (!j.retryable) throw new Error(j.error ?? "Couldn't save your boost.");
        await new Promise((r) => setTimeout(r, 1500 + i * 1500));
      }
      fireConfetti?.();
      void refetch();
      await onBoosted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showAppToast(/user (rejected|denied)|rejected the request|cancel/i.test(msg) ? "Cancelled." : msg || "Couldn't boost. Try again.");
    } finally {
      setStep("idle");
    }
  };

  return (
    <section className={cn("rounded-[22px] border-2 border-ink bg-white p-3.5 text-ink shadow-[0_3px_0_#000]", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label-mono m-0 text-[10px] text-muted-foreground">Cashback at the finish</p>
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

      {canBoost ? (
        <>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="press-edge mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-green text-[14px] font-extrabold uppercase text-white shadow-[0_3px_0_#1d8a52] disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {step === "claiming"
              ? "Claiming…"
              : step === "boosting"
                ? "Boosting…"
                : step === "saving"
                  ? "Saving…"
                  : `${claimable > 0 ? "Claim & boost" : "Boost"} +${k(amount)} G$ · ${nextPct}%`}
          </button>
          <p className="m-0 mt-1.5 text-center text-[11px] font-semibold text-muted-foreground">
            {boost.boostedKeptDays === 0 && today === 0
              ? `Boost before every photo: +1% a day, up to ${Math.min(BOOST.maxPct, BOOST.basePct + days * BOOST.stepPct)}% back`
              : skippedYesterday
                ? "You skipped yesterday's +1% — don't miss today's"
                : boost.boostersToday > 0
                  ? `${boost.boostersToday.toLocaleString("en-US")} ${boost.boostersToday === 1 ? "player" : "players"} boosted today`
                  : "Boost before your photo — it counts once the day is kept"}
          </p>
        </>
      ) : boost.boostedToday ? (
        <p className="m-0 mt-2 text-[12px] font-bold text-green-edge">Boosted today ✓ — keep the day to lock in +1%</p>
      ) : null}
    </section>
  );
}
