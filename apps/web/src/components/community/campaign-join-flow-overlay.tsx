"use client";

import { CampaignJoinModal } from "@/components/community/campaign-join-modal";
import type { useCampaignJoinFlow } from "@/hooks/use-campaign-join-flow";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { resolveJoinTokenAddress } from "@/lib/community/join-token";

type JoinFlow = ReturnType<typeof useCampaignJoinFlow>;

export function CampaignJoinFlowOverlay({
  flow,
  address,
  onJoined,
}: {
  flow: JoinFlow;
  address?: string;
  onJoined?: (campaignId: string) => void | Promise<void>;
}) {
  // Resolve the actual ERC-20 address (zero address → G$ mainnet address)
  const rawTokenAddress = flow.joinInfo
    ? resolveJoinTokenAddress(flow.joinInfo.joinToken)
    : undefined;
  const tokenAddress =
    rawTokenAddress === "0x0000000000000000000000000000000000000000"
      ? GOODDOLLAR_ADDRESSES.mainnet
      : rawTokenAddress;

  const { formatted: balanceFormatted, isLoading: isLoadingBalance } =
    useTokenBalance(tokenAddress);

  const joinAmount = flow.joinInfo?.joinAmount ?? 0;
  const isFreeToJoin = flow.joinInfo?.isFreeToJoin ?? true;
  const insufficientBalance =
    !isFreeToJoin &&
    joinAmount > 0 &&
    !isLoadingBalance &&
    Number(balanceFormatted) < joinAmount;

  if (!flow.joinInfo) return null;

  return (
    <CampaignJoinModal
      open={flow.joinModalOpen}
      info={flow.joinInfo}
      joining={flow.joining}
      joiningLabel={flow.joiningLabel}
      joinError={flow.joinError}
      insufficientBalance={insufficientBalance}
      userBalance={isLoadingBalance ? undefined : Number(balanceFormatted)}
      onConfirm={() => {
        if (!address) return;
        void flow.confirmJoin(address, {
          onSuccess: (campaignId) => onJoined?.(campaignId),
        });
      }}
      onCancel={flow.closeJoinModal}
    />
  );
}
