"use client";

import { useSyncExternalStore } from "react";
import type { ProofRewardKind, ProofRewardResult } from "@/lib/proof-reward/grant";

export type ProofRewardState =
  | { phase: "idle" }
  | { phase: "granting" }
  | { phase: "done"; result: ProofRewardResult };

/**
 * Module-level on purpose: the proof submit helpers (campaign + forfeit) kick
 * off the grant the moment the on-chain proof lands, and whichever success
 * card ends up rendering just reads the latest outcome — no need to thread a
 * tx hash through every modal that shows ProofSuccessCard.
 */
let state: ProofRewardState = { phase: "idle" };
let lastInput: { kind: ProofRewardKind; proofTxHash: string } | null = null;
const listeners = new Set<() => void>();

function setState(next: ProofRewardState) {
  state = next;
  listeners.forEach((l) => l());
}

export function startProofReward(input: { kind: ProofRewardKind; proofTxHash: string }) {
  lastInput = input;
  setState({ phase: "granting" });
  void (async () => {
    try {
      const res = await fetch("/api/proof-reward/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = (await res.json()) as ProofRewardResult;
      setState({ phase: "done", result });
    } catch {
      setState({ phase: "done", result: { status: "failed", amount: 0 } });
    }
  })();
}

/** Re-runs the last grant — safe, the server never pays the same proof twice. */
export function retryProofReward() {
  if (lastInput) startProofReward(lastInput);
}

export function resetProofReward() {
  lastInput = null;
  setState({ phase: "idle" });
}

export function useProofReward(): ProofRewardState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}
