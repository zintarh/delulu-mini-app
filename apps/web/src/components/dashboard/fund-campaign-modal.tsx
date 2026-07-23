"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useReadContract, useChainId } from "wagmi";
import { DELULU_ABI } from "@/lib/abi";
import { getDeluluContractAddress } from "@/lib/constant";
import { useFundCommunityChallenge } from "@/hooks/use-fund-community-challenge";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useTokenBalance } from "@/hooks/use-token-balance";
import {
  DashboardModal,
  DashboardField,
  DashboardPrimaryButton,
  dashboardInputClass,
} from "@/components/dashboard/dashboard-ui";
import { useConfirmCampaignFund } from "@/hooks/dashboard/use-dashboard-campaigns";

type FundCampaign = {
  id: string;
  title: string;
  proposed_pool_amount: number;
  content_hash: string | null;
  on_chain_challenge_id: number | null;
};

export function FundCampaignModal({
  open,
  onOpenChange,
  campaign,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: FundCampaign | null;
  onSuccess?: () => void;
}) {
  const chainId = useChainId();
  const contractAddress = getDeluluContractAddress(chainId);
  const confirmFund = useConfirmCampaignFund();
  const [poolInput, setPoolInput] = useState("");
  const [step, setStep] = useState<"idle" | "signing" | "confirming" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const { data: currencyAddress } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "currency",
  });

  const token = currencyAddress as string | undefined;
  const poolAmount = Number(poolInput);

  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    refetchAllowance,
  } = useTokenApproval(token);

  const balance = useTokenBalance(token);
  const {
    fundCommunityChallenge,
    hash,
    isPending: isFunding,
    isSuccess: isTxSuccess,
    isError: isTxError,
    errorMessage,
  } = useFundCommunityChallenge();

  const isCreating = isFunding;
  const isConfirming = false;

  useEffect(() => {
    if (!open) {
      setStep("idle");
      setError(null);
      setPoolInput("");
    } else if (campaign) {
      setPoolInput(
        campaign.proposed_pool_amount > 0 ? String(campaign.proposed_pool_amount) : "",
      );
    }
  }, [open, campaign]);

  useEffect(() => {
    if (isTxSuccess && hash && campaign && poolAmount > 0) {
      setStep("confirming");
      confirmFund
        .mutateAsync({ id: campaign.id, txHash: hash, poolAmount })
        .then(() => {
          setStep("done");
          onSuccess?.();
        })
        .catch((err) => {
          setStep("error");
          setError(err instanceof Error ? err.message : "Failed to confirm funding");
        });
    }
  }, [isTxSuccess, hash, campaign, confirmFund, onSuccess, poolAmount]);

  useEffect(() => {
    if (isTxError && errorMessage) {
      setStep("error");
      setError(errorMessage);
    }
  }, [isTxError, errorMessage]);

  const handleFund = async () => {
    if (!campaign?.content_hash) {
      setError("Campaign content is not ready.");
      return;
    }
    if (!Number.isFinite(poolAmount) || poolAmount <= 0) {
      setError("Prize pool must be greater than 0");
      return;
    }
    setError(null);
    setStep("signing");

    if (campaign.on_chain_challenge_id == null) {
      setError("Campaign must be deployed on-chain first. Complete the Approve step.");
      setStep("idle");
      return;
    }

    try {
      if (needsApproval(poolAmount) && !isApprovalSuccess) {
        await approve(poolAmount);
        await refetchAllowance();
      }
      await fundCommunityChallenge(campaign.on_chain_challenge_id, poolAmount);
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  const busy =
    step === "signing" ||
    isCreating ||
    isConfirming ||
    isApproving ||
    isApprovingConfirming ||
    confirmFund.isPending;

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title="Fund campaign"
      description={campaign?.title}
    >
      <div className="space-y-4 pt-2 text-sm">
        <DashboardField label="Prize pool (G$)" required>
          <input
            type="number"
            min={1}
            className={dashboardInputClass}
            value={poolInput}
            onChange={(e) => setPoolInput(e.target.value)}
            placeholder="100"
            required
          />
        </DashboardField>

        <p className="text-xs text-muted-foreground">
          Funds are escrowed on-chain. After the campaign ends, winners in the prize
          zone can claim their share of the pool.
        </p>

        {balance.formatted ? (
          <p className="text-xs text-muted-foreground">
            Wallet balance: {balance.formatted} G$
          </p>
        ) : null}

        {step === "done" ? (
          <p className="text-sm font-semibold text-emerald-700">Campaign is now live.</p>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {step !== "done" ? (
          <DashboardPrimaryButton
            className="w-full"
            disabled={busy || !campaign?.content_hash || !poolInput.trim()}
            onClick={() => void handleFund()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {step === "confirming" ? "Confirming…" : "Sign & fund"}
          </DashboardPrimaryButton>
        ) : null}
      </div>
    </DashboardModal>
  );
}
