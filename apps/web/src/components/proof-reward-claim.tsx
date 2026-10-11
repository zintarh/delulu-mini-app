"use client";

import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { useHasGas } from "@/hooks/use-has-gas";
import { useClaimReward } from "@/hooks/use-reward-vault";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { retryProofReward, useProofReward } from "@/lib/proof-reward/client";
import { fireConfetti } from "@/lib/celebrate";

const GOOD_DOLLAR = GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`;

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 w-full rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-center text-xs font-semibold leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * "Claim your reward for today's proof" — reads the grant that the proof
 * submit helper kicked off (lib/proof-reward/client.ts) and lets the user pull
 * the G$ out of RewardVault right from the success card. Renders nothing when
 * no grant is in play (e.g. an off-chain proof).
 */
export function ProofRewardClaim() {
  const reward = useProofReward();
  const { claimReward, isPending } = useClaimReward();
  const { isLowGas } = useHasGas();
  const [claimed, setClaimed] = useState(false);
  const [gasTopupPending, setGasTopupPending] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  if (reward.phase === "idle") return null;

  if (reward.phase === "granting") {
    return (
      <div className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-xs font-bold text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing your G$ reward…
      </div>
    );
  }

  const { result } = reward;
  const amount = result.amount;

  switch (result.status) {
    case "capped":
      return (
        <Note>
          You&apos;ve earned today&apos;s max of {(result.cap * amount).toLocaleString()} G$ from proofs.
          Rewards reset at midnight.
        </Note>
      );
    case "not_verified":
      return <Note>Verify your face to earn {amount} G$ for every proof you submit.</Note>;
    case "self_verified":
      return (
        <Note>
          Self-verified Forfeits don&apos;t earn G$. Pick AI or a friend as your verifier to earn{" "}
          {amount} G$ per proof.
        </Note>
      );
    case "awaiting_verifier":
      return <Note>You&apos;ll get {amount} G$ once your friend approves this proof.</Note>;
    case "failed":
      return (
        <div className="mt-3 w-full rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-center">
          <p className="text-xs font-semibold text-muted-foreground">
            We couldn&apos;t prepare your G$ reward.
          </p>
          <button
            type="button"
            onClick={retryProofReward}
            className="mt-2 text-xs font-black text-foreground underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      );
    case "not_eligible":
      return null;
  }

  // status === "sent"
  const handleClaim = async () => {
    setClaimError(null);
    try {
      if (isLowGas) {
        setGasTopupPending(true);
        try {
          await fetch("/api/faucet/topup", { method: "POST" });
          // Give the top-up tx a moment to land before the claim needs the balance.
          await new Promise((resolve) => setTimeout(resolve, 4000));
        } catch {
          // The claim tx below surfaces its own "not enough CELO" error.
        } finally {
          setGasTopupPending(false);
        }
      }
      await claimReward(GOOD_DOLLAR);
      setClaimed(true);
      void fireConfetti();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Claim failed. Try again.");
    }
  };

  const busy = isPending || gasTopupPending;

  return (
    <div className="mt-3 w-full rounded-2xl border-2 border-[#1a1a19] bg-[#fff8e1] p-4 dark:bg-[#f6c324]/10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6c324]">
          <Gift className="h-5 w-5 text-[#1a1a19]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-foreground">
            {claimed ? `+${amount} G$ claimed!` : `Claim your ${amount} G$ for today's proof`}
          </p>
          <p className="text-[11px] font-semibold text-muted-foreground">
            {claimed
              ? "It's in your wallet. Keep showing up."
              : `${result.paidToday} of ${result.cap} proof rewards earned today`}
          </p>
        </div>
      </div>

      {!claimed ? (
        <button
          type="button"
          onClick={() => void handleClaim()}
          disabled={busy}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-[#1a1a19] bg-[#f6c324] text-sm font-black text-[#1a1a19] shadow-[3px_3px_0px_0px_#1a1a19] transition-all hover:translate-x-[1px] hover:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {gasTopupPending ? "Getting you set up…" : isPending ? "Claiming…" : `Claim ${amount} G$`}
        </button>
      ) : null}

      {claimError ? (
        <p className="mt-2 text-center text-xs font-semibold text-rose-500">{claimError}</p>
      ) : null}
    </div>
  );
}
