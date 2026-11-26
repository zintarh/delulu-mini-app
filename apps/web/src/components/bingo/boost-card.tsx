"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useChainId, usePublicClient } from "wagmi";
import { Loader2 } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { useAuth } from "@/hooks/use-auth";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { BOOST_ABI } from "@/lib/bingo/boost";
import type { BingoView } from "@/lib/bingo/view";
import { GOODDOLLAR_ADDRESSES, getForfeitMarketAddress } from "@/lib/constant";
import { showAppToast, fireConfetti } from "@/lib/celebrate";
import { cn } from "@/lib/utils";

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : Math.round(n).toLocaleString("en-US"));

function topUpError(raw: string): string {
  const m = raw.toLowerCase();
  if (/user (rejected|denied)|rejected the request|cancel/.test(m)) return "Cancelled.";
  if (m.includes("periodalreadyresolved") || m.includes("already resolved")) {
    return "This day is already set. You can top up again when the next day opens.";
  }
  if (m.includes("periodnotopen") || m.includes("not open")) {
    return "The next day isn't open yet. You can top up as soon as it starts.";
  }
  if (m.includes("deadlinepassed") || m.includes("deadline")) {
    return "Today's deadline has passed.";
  }
  if (m.includes("insufficient") || m.includes("transfer amount exceeds")) {
    return "Not enough G$ in your wallet for that amount.";
  }
  return raw || "Couldn't top up. Try again.";
}

/**
 * Top up is its own action. A button on the card opens an amount sheet.
 * It is not part of the photo, and it is not limited to the moment before a proof.
 */
export function BoostCard({ bingo, onBoosted, className }: { bingo: BingoView; onBoosted: () => void | Promise<void>; className?: string }) {
  const me = bingo.me;
  const boost = me?.boost;
  const ended = !me || me.phase === "ended" || me.missedDay;
  const { address } = useAuth();
  const chainId = useChainId();
  const publicClient = usePublicClient();
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
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"idle" | "boosting" | "saving">("idle");
  const [raw, setRaw] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!boost || ended) return null;

  const balance = Math.floor(Number(formatted) || 0);
  const amount = /^\d+$/.test(raw) ? Number(raw) : 0;
  const busy = step !== "idle";

  const run = async () => {
    if (!address || !market) {
      setFormError("Connect your wallet to top up.");
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
      setOpen(false);
      showAppToast(`Added ${k(amount)} G$ to your stake.`);
      void refetch();
      await onBoosted();
    } catch (e) {
      const text = topUpError(e instanceof Error ? e.message : String(e));
      setFormError(text);
      showAppToast(text);
    } finally {
      setStep("idle");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFormError(null);
          setOpen(true);
        }}
        className={cn(
          "press-edge flex h-12 w-full items-center justify-center rounded-2xl border-2 border-ink bg-white text-[14px] font-extrabold uppercase text-ink shadow-[0_3px_0_#000]",
          className,
        )}
      >
        Top up
      </button>
      <ResponsiveSheet open={open} onOpenChange={(o) => !busy && setOpen(o)} title="Top up your stake" sheetClassName="rounded-t-3xl pb-10" modalClassName="max-w-md">
        <div className="flex flex-col gap-3 px-5 pt-1">
          <p className="m-0 text-[13px] font-semibold text-muted-foreground">
            Add G$ from your wallet to this card. The higher your stake, the higher your reward. You have {k(balance)} G$.
          </p>
          <label className="block">
            <span className="label-mono text-[10px] text-muted-foreground">Amount in G$</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={raw}
              disabled={busy}
              placeholder="0"
              autoFocus
              onChange={(e) => {
                setRaw(e.target.value.replace(/\D/g, ""));
                setFormError(null);
              }}
              className="mt-1 h-12 w-full rounded-2xl border-2 border-ink bg-paper px-3 text-[16px] font-extrabold outline-none"
            />
          </label>
          <button
            type="button"
            disabled={busy || balance <= 0}
            onClick={() => {
              setRaw(String(balance));
              setFormError(null);
            }}
            className="self-start rounded-full bg-ink px-2.5 py-1 text-[11px] font-extrabold text-white disabled:opacity-40"
          >
            Max
          </button>
          {formError ? <p className="m-0 text-center text-[12px] font-bold text-orange">{formError}</p> : null}
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy || amount <= 0}
            className="press-edge flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-green text-[14px] font-extrabold uppercase text-white shadow-[0_3px_0_#1d8a52] disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {step === "boosting" ? "Topping up…" : step === "saving" ? "Saving…" : amount > 0 ? `Top up ${k(amount)} G$` : "Top up"}
          </button>
        </div>
      </ResponsiveSheet>
    </>
  );
}
