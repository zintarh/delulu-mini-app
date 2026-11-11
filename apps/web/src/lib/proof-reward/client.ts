import { create } from "zustand";
import type { ProofRewardKind } from "@/lib/proof-reward/grant";
import type { ProofRewardsResult } from "@/lib/rewards/engine";

export type ProofRewardState =
  | { startedAt: number; status: "checking" }
  | { startedAt: number; status: "done"; result: ProofRewardsResult }
  | { startedAt: number; status: "error" };

/** Outcome of the latest proof's reward request, for the proof success card. */
export const useProofRewardStore = create<{ current: ProofRewardState | null }>(() => ({ current: null }));

/**
 * Asks the server to run the Rewards Engine once the on-chain proof has
 * landed. Never blocks the proof flow: the success card shows "checking"
 * and then what was earned. The grant is idempotent server-side, and
 * anything unfinished is completed by the payout cron.
 */
export function startProofReward(input: { kind: ProofRewardKind; proofTxHash: string }) {
  const startedAt = Date.now();
  const isLatest = () => useProofRewardStore.getState().current?.startedAt === startedAt;
  useProofRewardStore.setState({ current: { startedAt, status: "checking" } });

  void fetch("/api/proof-reward/grant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
    .then(async (res) => {
      const result = (await res.json().catch(() => null)) as ProofRewardsResult | null;
      if (!isLatest()) return;
      useProofRewardStore.setState({
        current: res.ok && result && "status" in result ? { startedAt, status: "done", result } : { startedAt, status: "error" },
      });
    })
    .catch(() => {
      if (isLatest()) useProofRewardStore.setState({ current: { startedAt, status: "error" } });
    });
}
