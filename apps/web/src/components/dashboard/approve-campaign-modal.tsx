"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  DashboardModal,
  DashboardPrimaryButton,
  useDashboardToast,
} from "@/components/dashboard/dashboard-ui";
import { useApproveCampaign } from "@/hooks/dashboard/use-dashboard-campaigns";
import { useCreateCommunityChallenge } from "@/hooks/use-create-community-challenge";
import { useSetCommunityCampaignEconomics } from "@/hooks/use-community-campaign-onchain";
import { resolveJoinTokenAddress } from "@/lib/community/join-token";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { parseTokenAmount } from "@/lib/token-amounts";
import type { DashboardCampaign } from "@/hooks/dashboard/use-dashboard-campaigns";

type DeployStep =
  | "idle"
  | "approving"
  | "deploying_challenge"
  | "confirming_challenge"
  | "done"
  | "error";

async function confirmCreateOnChain(id: string, txHash: string) {
  const res = await fetch(`/api/dashboard/campaigns/${id}/confirm-create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Failed to confirm on-chain create");
  return json as { campaign?: { on_chain_challenge_id?: number } };
}

const STEP_LABEL: Record<DeployStep, string> = {
  idle: "This will upload campaign content to IPFS and deploy it on-chain. You'll need to sign one wallet transaction.",
  approving: "Preparing content hash…",
  deploying_challenge: "Sign the wallet transaction to create the campaign on-chain.",
  confirming_challenge: "Confirming on-chain deployment…",
  done: "",
  error: "",
};

const RETRY_IDLE_LABEL =
  "Campaign content is already prepared — it just never finished deploying on-chain. You'll need to sign one wallet transaction to finish deployment.";

export function ApproveCampaignModal({
  open,
  onOpenChange,
  campaign,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: DashboardCampaign | null;
  onSuccess?: () => void;
}) {
  const approve = useApproveCampaign();
  const { createCommunityChallengeAndWait } = useCreateCommunityChallenge();
  const { setCommunityCampaignEconomicsAndWait } = useSetCommunityCampaignEconomics();
  const { show } = useDashboardToast();
  const [step, setStep] = useState<DeployStep>("idle");
  const [error, setError] = useState<string | null>(null);

  // Content prep (and the IPFS upload it entails) may have already succeeded
  // on a prior attempt even if the on-chain deploy step then failed — resume
  // straight into deployment using the existing hash instead of re-running
  // (and re-uploading for) the DB approve step.
  const isRetryDeploy = Boolean(campaign?.content_hash);

  useEffect(() => {
    if (!open || !campaign) {
      setStep("idle");
      setError(null);
    }
  }, [open, campaign]);

  const handleApprove = async () => {
    if (!campaign) return;
    setError(null);
    try {
      let contentHash = campaign.content_hash ?? undefined;
      if (!isRetryDeploy) {
        setStep("approving");
        const json = await approve.mutateAsync(campaign.id);
        contentHash = json.campaign?.content_hash as string | undefined;
      }
      if (!contentHash) {
        throw new Error("Campaign content hash missing after approval");
      }

      setStep("deploying_challenge");
      const createTxHash = await createCommunityChallengeAndWait({
        contentHash,
        durationDays: campaign.duration_days ?? 30,
        proofCadence: campaign.proof_cadence === "weekly" ? "weekly" : "daily",
      });

      setStep("confirming_challenge");
      const confirmed = await confirmCreateOnChain(campaign.id, createTxHash);
      const challengeId = confirmed.campaign?.on_chain_challenge_id;
      if (challengeId == null) {
        throw new Error("On-chain challenge ID missing after deploy.");
      }

      const isFreeToJoin = campaign.is_free_to_join !== false;
      const joinAmount = Number(campaign.join_amount ?? 0);
      if (!isFreeToJoin && joinAmount > 0) {
        const joinToken = resolveJoinTokenAddress(campaign.join_token);
        const erc20Token =
          joinToken === "0x0000000000000000000000000000000000000000"
            ? (GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`)
            : joinToken;
        await setCommunityCampaignEconomicsAndWait({
          challengeId,
          isPaid: true,
          joinToken,
          joinAmountWei: parseTokenAmount(joinAmount, erc20Token),
          forfeitPct: Number(campaign.forfeit_pct ?? 0),
        });
      }

      setStep("done");
      show(`${campaign.title} deployed — add milestones on-chain from the campaign page`);
      onSuccess?.();
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Approve failed");
    }
  };

  const busy =
    step !== "idle" &&
    step !== "done" &&
    step !== "error";

  const canApprove = Boolean(campaign);

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title={isRetryDeploy ? "Deploy on-chain" : "Approve & deploy"}
      description={campaign?.title}
    >
      <div className="space-y-4 pt-2 text-sm">
        {step !== "done" ? (
          <p className="text-muted-foreground">
            {step === "idle" && isRetryDeploy ? RETRY_IDLE_LABEL : STEP_LABEL[step === "error" ? "idle" : step]}
          </p>
        ) : (
          <p className="font-semibold text-emerald-700">
            Campaign deployed on-chain. Open the campaign detail page to add milestones.
          </p>
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {step !== "done" ? (
          <DashboardPrimaryButton
            className="w-full"
            disabled={busy || !canApprove || approve.isPending}
            onClick={() => void handleApprove()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Working…" : isRetryDeploy ? "Deploy on-chain" : "Approve & deploy"}
          </DashboardPrimaryButton>
        ) : null}
      </div>
    </DashboardModal>
  );
}
