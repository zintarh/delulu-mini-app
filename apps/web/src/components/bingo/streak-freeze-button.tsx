"use client";

import { useEffect, useState } from "react";
import { parseUnits } from "viem";
import { Snowflake } from "lucide-react";
import { GameButton } from "@/components/ds";
import { PURCHASE, useVaultStake } from "@/hooks/use-vault-stake";
import { useResolveForfeitCommitmentSuccess } from "@/hooks/use-create-forfeit-commitment";
import { fmtG } from "@/lib/bingo/format";

/**
 * Can't post today? Pay a small streak freeze into the reward pot (on-chain)
 * and today's day is kept — once per card, never on day 1, no photo reward.
 * The G$ funds the rewards of everyone who finishes.
 */
export function StreakFreezeButton({ attemptId, onFrozen }: { attemptId: string; onFrozen: () => void | Promise<void> }) {
  const [offer, setOffer] = useState<{ price: number; ref: `0x${string}`; day: number; signDay: boolean; commitmentId: number } | null>(null);
  const [paidTx, setPaidTx] = useState<`0x${string}` | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { purchaseAndWait } = useVaultStake();
  const { resolveCommitmentSuccessAndWait } = useResolveForfeitCommitmentSuccess();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bingo/attempts/${attemptId}/freeze`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setOffer(j.available ? { price: j.price, ref: j.ref, day: j.day, signDay: !!j.signDay, commitmentId: Number(j.commitmentId) } : null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [attemptId]);

  if (!offer) return null;

  const freeze = async () => {
    setBusy(true);
    setError(null);
    try {
      const txHash = paidTx ?? await purchaseAndWait(parseUnits(String(offer.price), 18), PURCHASE.STREAK_FREEZE, offer.ref);
      setPaidTx(txHash);
      const resolveTxHash = offer.signDay ? await resolveCommitmentSuccessAndWait(offer.commitmentId) : undefined;
      const res = await fetch(`/api/bingo/attempts/${attemptId}/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, resolveTxHash }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't freeze today. Try again.");
      setOffer(null);
      await onFrozen();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/user (rejected|denied)|rejected the request|cancel/i.test(msg) ? null : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <GameButton variant="line" size="sm" full onClick={() => void freeze()} disabled={busy}>
        <Snowflake className="h-4 w-4" />
        {busy ? "Freezing…" : `Freeze day ${offer.day} · ${fmtG(offer.price)} G$`}
      </GameButton>
      {error ? <p className="mt-1.5 text-center text-[12px] font-semibold text-orange">{error}</p> : null}
    </div>
  );
}
