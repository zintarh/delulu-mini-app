"use client";

import { CampaignJoinModal } from "@/components/community/campaign-join-modal";
import type { useCampaignJoinFlow } from "@/hooks/use-campaign-join-flow";

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
  if (!flow.joinInfo) return null;

  return (
    <CampaignJoinModal
      open={flow.joinModalOpen}
      info={flow.joinInfo}
      joining={flow.joining}
      joiningLabel={flow.joiningLabel}
      joinError={flow.joinError}
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
