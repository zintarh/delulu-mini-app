"use client";

import { useCallback, useState } from "react";
import type { CampaignJoinInfo } from "@/components/community/campaign-join-modal";
import { buildCampaignJoinInfo, type CampaignJoinSource } from "@/lib/community/campaign-join-info";
import { joinCommunityCampaignWithWallet } from "@/lib/community/join-campaign-client";
import { useJoinCommunityCampaignOnChain } from "@/hooks/use-community-campaign-onchain";
import { useCommunityCampaignTokenApproval } from "@/hooks/use-community-campaign-token-approval";

export function useCampaignJoinFlow() {
  const { joinCommunityCampaignAndWait } = useJoinCommunityCampaignOnChain();
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinInfo, setJoinInfo] = useState<CampaignJoinInfo | null>(null);
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [approvalStep, setApprovalStep] = useState(false);

  const { approve, needsApproval, isPending: isApproving, isConfirming: isConfirmingApproval } =
    useCommunityCampaignTokenApproval(joinInfo?.joinToken);

  const openJoinModal = useCallback((campaignId: string, source: CampaignJoinSource) => {
    setPendingCampaignId(campaignId);
    setJoinInfo(buildCampaignJoinInfo(source));
    setJoinError(null);
    setApprovalStep(false);
    setJoinModalOpen(true);
  }, []);

  const closeJoinModal = useCallback(() => {
    if (joining || isApproving || isConfirmingApproval) return;
    setJoinModalOpen(false);
    setPendingCampaignId(null);
    setJoinInfo(null);
    setJoinError(null);
    setApprovalStep(false);
  }, [joining, isApproving, isConfirmingApproval]);

  const confirmJoin = useCallback(
    async (walletAddress: string, options?: {
      campaignTitle?: string;
      onSuccess?: (campaignId: string) => void | Promise<void>;
    }) => {
      if (!pendingCampaignId || !joinInfo) return;
      setJoining(true);
      setJoinError(null);
      try {
        const joinAmount = joinInfo.joinAmount ?? 0;
        if (!joinInfo.isFreeToJoin && joinAmount > 0) {
          if (needsApproval(joinAmount)) {
            setApprovalStep(true);
            await approve(joinAmount);
            setApprovalStep(false);
          }
        }

        await joinCommunityCampaignWithWallet(
          pendingCampaignId,
          walletAddress,
          joinCommunityCampaignAndWait,
          { campaignTitle: options?.campaignTitle ?? joinInfo.title },
        );
        const joinedCampaignId = pendingCampaignId;
        await options?.onSuccess?.(joinedCampaignId);
        setJoinModalOpen(false);
        setPendingCampaignId(null);
        setJoinInfo(null);
      } catch (err) {
        const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
        const isUserRejection =
          raw.includes("user rejected") ||
          raw.includes("user denied") ||
          raw.includes("rejected the request") ||
          raw.includes("transaction was cancelled") ||
          raw.includes("request rejected");
        const isWalletError =
          raw.includes("connector not connected") ||
          raw.includes("not connected") ||
          raw.includes("no connector") ||
          raw.includes("account not found");
        setJoinError(
          isUserRejection
            ? "Transaction cancelled."
            : isWalletError
              ? "Wallet not ready — please retry or reconnect your wallet."
              : "Something went wrong. Please try again.",
        );
        setApprovalStep(false);
      } finally {
        setJoining(false);
      }
    },
    [
      pendingCampaignId,
      joinInfo,
      needsApproval,
      approve,
      joinCommunityCampaignAndWait,
    ],
  );

  const busy = joining || isApproving || isConfirmingApproval;
  const joiningLabel = approvalStep || isApproving || isConfirmingApproval
    ? "Approving stake…"
    : joining
      ? "Joining…"
      : undefined;

  return {
    joinModalOpen,
    joinInfo,
    pendingCampaignId,
    joining: busy,
    joiningLabel,
    joinError,
    openJoinModal,
    closeJoinModal,
    confirmJoin,
    clearJoinError: () => setJoinError(null),
  };
}
