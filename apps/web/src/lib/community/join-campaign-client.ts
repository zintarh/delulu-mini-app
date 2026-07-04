"use client";

import { joinCommunityCampaign as joinCommunityCampaignApi } from "@/hooks/use-home-campaigns-feed";
import { celebrateCampaignJoin } from "@/lib/celebrate";
import { waitForMilestoneCompletionInGraph } from "@/lib/community/campaign-subgraph";

type JoinOnChain = (challengeId: number | bigint) => Promise<`0x${string}` | string>;

async function confirmJoinOnChain(
  campaignId: string,
  walletAddress: string,
  txHash: string,
) {
  const res = await fetch(`/api/community/campaigns/${campaignId}/confirm-join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash, walletAddress }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error ?? "Failed to sync join metadata");
  }
}

export async function joinCommunityCampaignWithWallet(
  campaignId: string,
  walletAddress: string,
  joinOnChain: JoinOnChain,
  options?: { campaignTitle?: string },
) {
  const result = await joinCommunityCampaignApi(campaignId, walletAddress);

  if (result.alreadyJoined) {
    return result;
  }

  if (result.requiresOnChain && result.challengeId != null) {
    const txHash = await joinOnChain(result.challengeId);
    await confirmJoinOnChain(campaignId, walletAddress, txHash);
    await celebrateCampaignJoin(options?.campaignTitle);
    return { ...result, joinedCampaign: true };
  }

  return result;
}

type ProofStep = "ai-verifying" | "wallet-sign" | "confirming";

export async function submitCommunityProofWithWallet(input: {
  campaignId: string;
  walletAddress: string;
  proofUrls: string[];
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
      proofUrls: input.proofUrls,
      milestoneId: input.milestoneId,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message ?? json.reason ?? json.error ?? "Proof not accepted");
  }

  if (json.requiresOnChain && json.challengeId != null) {
    input.onStepChange?.("wallet-sign");
    const canonicalProofUrl = json.proofUrl ?? input.proofUrls[0];
    await input.submitOnChain(json.challengeId, json.milestoneId, canonicalProofUrl);
    input.onStepChange?.("confirming");
    await waitForMilestoneCompletionInGraph(
      json.challengeId,
      input.walletAddress,
      json.milestoneId,
    );
    return { verified: true as const, onChain: true };
  }

  return {
    verified: true as const,
    onChain: false,
    pointsTotal: json.pointsTotal as number | undefined,
  };
}
