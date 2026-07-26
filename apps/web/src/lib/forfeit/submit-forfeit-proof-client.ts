import { formatProofError } from "@/lib/community/format-proof-error";

type ProofStep = "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming";

/**
 * Orchestrates forfeit proof submission end to end: AI pre-flight (skipped for
 * self/friend commitments), submitProof on-chain, and - only for self/ai
 * commitments, where the creator is themselves authorized to resolve - an
 * immediate resolveCommitmentSuccess right after, mirroring the campaign
 * proof flow (submitCommunityProofWithWallet) but split across ForfeitMarket's
 * two separate on-chain calls instead of one combined one.
 *
 * Throws on failure with a human-readable Error.message (AI rejection reasons
 * are preserved so the upload modal can show why the proof bounced).
 */
export async function submitForfeitProofWithWallet(input: {
  onChainCommitmentId: number;
  walletAddress: string;
  proofUrls: string[];
  submitProofOnChain: (commitmentId: number, proofLink: string) => Promise<`0x${string}`>;
  resolveSuccessOnChain: (commitmentId: number) => Promise<`0x${string}`>;
  onStepChange?: (step: ProofStep) => void;
}): Promise<{ commitmentEnded: boolean; awaitingVerifier: boolean }> {
  input.onStepChange?.("ai-verifying");
  const res = await fetch("/api/forfeit/submit-proof", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      onChainCommitmentId: input.onChainCommitmentId,
      walletAddress: input.walletAddress,
      proofUrls: input.proofUrls,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Prefer AI `reason` (specific) over generic `error`.
    const raw = String(json.reason ?? json.error ?? "Proof not accepted").trim();
    throw new Error(raw || "Proof not accepted");
  }

  input.onStepChange?.("wallet-sign");
  let proofTxHash: `0x${string}`;
  try {
    proofTxHash = await input.submitProofOnChain(input.onChainCommitmentId, json.proofUrl);
  } catch (err) {
    throw new Error(formatProofError(err).message);
  }

  let resolveTxHash: `0x${string}` | null = null;
  if (json.canAutoResolve) {
    try {
      resolveTxHash = await input.resolveSuccessOnChain(input.onChainCommitmentId);
    } catch (err) {
      throw new Error(formatProofError(err).message);
    }
  }

  input.onStepChange?.("confirming");
  const confirmRes = await fetch("/api/forfeit/confirm-proof", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proofTxHash,
      resolveTxHash,
      walletAddress: input.walletAddress,
    }),
  });
  const confirmJson = await confirmRes.json().catch(() => ({}));
  if (!confirmRes.ok) {
    throw new Error(
      String(confirmJson?.error ?? "Proof confirmed on-chain, but saving details failed"),
    );
  }

  return {
    commitmentEnded: Boolean(confirmJson.commitmentEnded),
    awaitingVerifier: !json.canAutoResolve,
  };
}
