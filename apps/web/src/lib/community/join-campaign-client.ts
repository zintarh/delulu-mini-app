"use client";

import { joinCommunityCampaign as joinCommunityCampaignApi } from "@/hooks/use-home-campaigns-feed";

type JoinOnChain = (challengeId: number | bigint) => Promise<unknown>;

export async function joinCommunityCampaignWithWallet(
  campaignId: string,
  walletAddress: string,
  joinOnChain: JoinOnChain,
) {
  const result = await joinCommunityCampaignApi(campaignId, walletAddress);

  if (result.requiresOnChain && result.challengeId) {
    await joinOnChain(result.challengeId);
    return { ...result, joinedCampaign: true };
  }

  return result;
}

type ProofStep = "ai-verifying" | "wallet-sign" | "confirming";

export async function submitCommunityProofWithWallet(input: {
  campaignId: string;
  walletAddress: string;
  proofUrl: string;
  milestoneId: number;
  submitOnChain: (
    challengeId: number | bigint,
    milestoneId: number | bigint,
    proofUrl: string,
  ) => Promise<unknown>;
  onStepChange?: (step: ProofStep) => void;
}) {
  input.onStepChange?.("ai-verifying");
  const res = await fetch(`/api/community/campaigns/${input.campaignId}/proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: input.walletAddress,
      proofUrl: input.proofUrl,
      milestoneId: input.milestoneId,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message ?? json.reason ?? json.error ?? "Proof not accepted");
  }

  if (json.requiresOnChain && json.challengeId) {
    input.onStepChange?.("wallet-sign");
    await input.submitOnChain(json.challengeId, json.milestoneId, input.proofUrl);
    input.onStepChange?.("confirming");
    return { verified: true as const, onChain: true };
  }

  return {
    verified: true as const,
    onChain: false,
    pointsTotal: json.pointsTotal as number | undefined,
  };
}
