import type { ProofRewardKind } from "@/lib/proof-reward/grant";

/**
 * Fire-and-forget: ask the server to grant the proof reward once the on-chain
 * proof has landed. The grant is idempotent server-side, and an unclaimed
 * reward stays in the vault for the rewards banner to pick up, so the caller
 * never waits on (or shows) the outcome.
 */
export function startProofReward(input: { kind: ProofRewardKind; proofTxHash: string }) {
  void fetch("/api/proof-reward/grant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => {});
}
