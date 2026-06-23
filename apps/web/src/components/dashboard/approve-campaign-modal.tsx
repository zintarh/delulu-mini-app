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
import { useAddCommunityCampaignMilestones } from "@/hooks/use-add-community-campaign-milestones";
import {
  fetchDraftMilestones,
  publishDraftMilestonesOnChain,
} from "@/lib/community/publish-campaign-milestones-client";
import type { DashboardCampaign } from "@/hooks/dashboard/use-dashboard-campaigns";

type DeployStep =
  | "idle"
  | "approving"
  | "deploying_challenge"
  | "confirming_challenge"
  | "deploying_milestones"
  | "indexing"
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
  idle: "Approve uploads metadata and deploys the campaign on-chain with milestones.",
  approving: "Preparing approval…",
  deploying_challenge: "Sign transaction 1 of 2 — create campaign on-chain.",
  confirming_challenge: "Confirming campaign on-chain…",
  deploying_milestones: "Sign transaction 2 of 2 — publish milestones on-chain.",
  indexing: "Waiting for indexer — almost ready for members to join.",
  done: "Campaign is live. Members can join and submit proof.",
  error: "",
};

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
  const { addCommunityCampaignMilestones } = useAddCommunityCampaignMilestones();
  const { show } = useDashboardToast();
  const [step, setStep] = useState<DeployStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !campaign) {
      setStep("idle");
      setError(null);
      setDraftCount(null);
      return;
    }
    void fetchDraftMilestones(campaign.id)
      .then((rows) => setDraftCount(rows.length))
      .catch(() => setDraftCount(0));
  }, [open, campaign]);

  const handleApprove = async () => {
    if (!campaign) return;
    setError(null);
    try {
      setStep("approving");
      const json = await approve.mutateAsync(campaign.id);
      const contentHash = json.campaign?.content_hash as string | undefined;
      if (!contentHash) {
        throw new Error("Campaign content hash missing after approval");
      }

      const drafts = await fetchDraftMilestones(campaign.id);
      if (drafts.length < 1) {
        throw new Error("Add at least one milestone before approving.");
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
      if (!challengeId) {
        throw new Error("On-chain challenge ID missing after deploy.");
      }

      setStep("deploying_milestones");
      await publishDraftMilestonesOnChain({
        campaignId: campaign.id,
        challengeId,
        durationDays: campaign.duration_days ?? 30,
        draftRows: drafts,
        addOnChain: addCommunityCampaignMilestones,
      });

      setStep("indexing");
      setStep("done");
      show(`${campaign.title} is live — members can join`);
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

  const canApprove = Boolean(campaign) && draftCount !== null && draftCount > 0;

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title="Approve & deploy"
      description={campaign?.title}
    >
      <div className="space-y-4 pt-2 text-sm">
        <p className="text-muted-foreground">
          {STEP_LABEL[step === "error" ? "idle" : step]}
        </p>

        {draftCount === 0 ? (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
            This campaign has no milestones. Add milestones in the draft before approving.
          </p>
        ) : null}

        {step === "done" ? (
          <p className="font-semibold text-emerald-700">
            Campaign approved, milestones published, and indexed on-chain.
          </p>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {step !== "done" ? (
          <DashboardPrimaryButton
            className="w-full"
            disabled={busy || !canApprove || approve.isPending}
            onClick={() => void handleApprove()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Working…" : "Approve & deploy"}
          </DashboardPrimaryButton>
        ) : null}
      </div>
    </DashboardModal>
  );
}
