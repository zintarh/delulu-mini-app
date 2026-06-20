"use client";

import { joinCommunityCampaign as joinCommunityCampaignApi } from "@/hooks/use-home-campaigns-feed";

type JoinOnChain = (challengeId: number) => Promise<void>;

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

export async function submitCommunityProofWithWallet(input: {
  campaignId: string;
  walletAddress: string;
  proofUrl: string;
  submitOnChain: (challengeId: number, proofUrl: string) => Promise<void>;
}) {
  const res = await fetch(`/api/community/campaigns/${input.campaignId}/proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: input.walletAddress,
      proofUrl: input.proofUrl,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.reason ?? json.error ?? "Proof not accepted");
  }

  if (json.requiresOnChain && json.challengeId) {
    await input.submitOnChain(json.challengeId, input.proofUrl);
    return { verified: true as const, onChain: true };
  }

  return {
    verified: true as const,
    onChain: false,
    pointsTotal: json.pointsTotal as number | undefined,
  };
}
