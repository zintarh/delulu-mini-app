import { NextRequest, NextResponse } from "next/server";
import { fetchBatchForfeitCommitmentState } from "@/lib/forfeit/forfeit-subgraph";
import { resolveCommitmentForfeitedAsKeeper } from "@/lib/celo/forfeit-keeper";

export const dynamic = "force-dynamic";

/**
 * Fast-path companion to the 5-minute forfeit-deadline-check cron — GitHub
 * Actions can't schedule more often than every 5 minutes, and for a
 * short-duration goal (15 min – 2 hr), up to 5 minutes of lag before a miss
 * actually resolves on-chain is a large fraction of the whole commitment.
 * The client calls this right around a near-term deadline (see
 * use-fast-resolve-forfeit) so a missed short goal resolves within seconds
 * instead of waiting for the next cron sweep.
 *
 * This is a convenience trigger for a call that's already fully permissionless
 * on-chain (anyone can call resolveCommitmentForfeited directly) — it doesn't
 * grant any new privilege, it just uses Delulu's own funded keeper wallet
 * instead of waiting for a third party or the next cron tick. No-ops
 * harmlessly if the commitment isn't actually overdue yet, was already
 * resolved, or doesn't exist.
 */
export async function POST(request: NextRequest) {
  let body: { onChainCommitmentId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const commitmentId = body.onChainCommitmentId;
  if (!Number.isInteger(commitmentId) || commitmentId! < 0) {
    return NextResponse.json({ error: "Valid onChainCommitmentId is required" }, { status: 400 });
  }

  try {
    const states = await fetchBatchForfeitCommitmentState([commitmentId!]);
    const state = states.get(commitmentId!);
    if (!state) {
      return NextResponse.json({ resolved: false, reason: "not_found" });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const deadlineSec = Number(state.currentPeriodDeadline);
    if (!state.active || state.cancelled || deadlineSec > nowSec) {
      return NextResponse.json({ resolved: false, reason: "not_overdue" });
    }

    const txHash = await resolveCommitmentForfeitedAsKeeper(BigInt(commitmentId!));
    return NextResponse.json({ resolved: true, txHash });
  } catch (err) {
    // Racing the cron (or a third-party keeper) to the same resolve is
    // expected and harmless — the contract itself rejects the loser with
    // NotActive/PeriodAlreadyResolved. Treat any failure here as best-effort.
    console.error("[forfeit/resolve-if-overdue]", err);
    return NextResponse.json(
      { resolved: false, error: err instanceof Error ? err.message : "Failed to resolve" },
      { status: 200 },
    );
  }
}
