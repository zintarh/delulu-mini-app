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
import type { DashboardCampaign } from "@/hooks/dashboard/use-dashboard-campaigns";

async function confirmCreateOnChain(id: string, txHash: string) {
  const res = await fetch(`/api/dashboard/campaigns/${id}/confirm-create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Failed to confirm on-chain create");
  return json;
}

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
  const {
    createCommunityChallenge,
    hash,
    isPending: isTxPending,
    isSuccess: isTxSuccess,
    errorMessage,
    reset: resetTx,
  } = useCreateCommunityChallenge();
  const { show } = useDashboardToast();
  const [step, setStep] = useState<"idle" | "approving" | "signing" | "confirming" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("idle");
      setError(null);
      resetTx();
    }
  }, [open, resetTx]);

  useEffect(() => {
    if (!isTxSuccess || !hash || !campaign || step !== "signing") return;
    setStep("confirming");
    confirmCreateOnChain(campaign.id, hash)
      .then(() => {
        setStep("done");
        show(`${campaign.title} approved and live on-chain`);
        onSuccess?.();
      })
      .catch((err) => {
        setStep("error");
        setError(err instanceof Error ? err.message : "Failed to confirm");
      });
  }, [isTxSuccess, hash, campaign, step, show, onSuccess]);

  useEffect(() => {
    if (errorMessage && step === "signing") {
      setStep("error");
      setError(errorMessage);
    }
  }, [errorMessage, step]);

  const handleApprove = async () => {
    if (!campaign) return;
    setError(null);
    setStep("approving");
    try {
      const json = await approve.mutateAsync(campaign.id);
      const contentHash = json.campaign?.content_hash as string | undefined;
      if (!contentHash) {
        throw new Error("Campaign content hash missing after approval");
      }
      setStep("signing");
      await createCommunityChallenge({
        contentHash,
        durationDays: campaign.duration_days ?? 30,
        proofCadence: campaign.proof_cadence === "weekly" ? "weekly" : "daily",
      });
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Approve failed");
    }
  };

  const busy = step === "approving" || step === "signing" || step === "confirming" || approve.isPending || isTxPending;

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title="Approve campaign"
      description={campaign?.title}
    >
      <div className="space-y-4 pt-2 text-sm">
        <p className="text-muted-foreground">
          Approving uploads campaign metadata to IPFS and creates a zero-pool on-chain challenge so
          Owner must add milestones on-chain before members can join.
        </p>

        {step === "done" ? (
          <p className="font-semibold text-emerald-700">Campaign approved and indexed on-chain.</p>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {step !== "done" ? (
          <DashboardPrimaryButton
            className="w-full"
            disabled={busy || !campaign}
            onClick={() => void handleApprove()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {step === "signing" || step === "confirming" ? "Confirming…" : "Approve & deploy"}
          </DashboardPrimaryButton>
        ) : null}
      </div>
    </DashboardModal>
  );
}
