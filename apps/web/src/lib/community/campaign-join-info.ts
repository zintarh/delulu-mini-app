import { isCampaignFunded } from "@/lib/community/campaign-types";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";
import type { CampaignJoinInfo } from "@/components/community/campaign-join-modal";
import { formatJoinTokenLabel } from "@/lib/community/join-token";

export type CampaignJoinSource = {
  title: string;
  community?: { name: string } | null;
  duration_days?: number;
  durationDays?: number;
  milestone_count?: number;
  milestoneCount?: number;
  is_free_to_join?: boolean;
  isFreeToJoin?: boolean;
  join_token?: string | null;
  joinToken?: string | null;
  join_amount?: number | null;
  joinAmount?: number | null;
  forfeit_pct?: number | null;
  forfeitPct?: number | null;
  proposed_pool_amount?: number;
  proposedPoolAmount?: number;
  prize_winner_count?: number;
  prizeWinnerCount?: number;
  proof_cadence?: string;
  proofCadence?: string;
  proof_instructions?: string | null;
  proofInstructions?: string | null;
  status?: string;
  display_ends_at?: string | null;
  funded_pool_amount?: number;
  total_participant_stakes?: number;
  total_prize_pool_amount?: number;
  participant_count?: number;
};

/** Paid join = not free and requires a positive stake amount. */
export function isPaidJoinCampaign(campaign: {
  is_free_to_join?: boolean | null;
  isFreeToJoin?: boolean | null;
  join_amount?: number | null;
  joinAmount?: number | null;
}): boolean {
  const isFreeToJoin =
    (campaign.is_free_to_join ?? campaign.isFreeToJoin) !== false;
  const joinAmount = Number(campaign.join_amount ?? campaign.joinAmount ?? 0);
  return !isFreeToJoin && joinAmount > 0;
}

export function buildCampaignJoinInfo(campaign: CampaignJoinSource): CampaignJoinInfo {
  const isFreeToJoin =
    (campaign.is_free_to_join ?? campaign.isFreeToJoin) !== false;
  const joinAmount = Number(campaign.join_amount ?? campaign.joinAmount ?? 0);
  const forfeitPct = Number(campaign.forfeit_pct ?? campaign.forfeitPct ?? 0);
  const joinToken = formatJoinTokenLabel(campaign.join_token ?? campaign.joinToken);
  const milestoneCount =
    campaign.milestone_count ?? campaign.milestoneCount ?? 0;
  const proposedPoolAmount = Number(
    campaign.proposed_pool_amount ?? campaign.proposedPoolAmount ?? 0,
  );
  const maxForfeitTotal =
    !isFreeToJoin && forfeitPct > 0 && joinAmount > 0
      ? (joinAmount * forfeitPct * milestoneCount) / 100
      : 0;

  return {
    title: campaign.title,
    communityName: campaign.community?.name ?? "Community",
    milestoneCount,
    durationDays: campaign.duration_days ?? campaign.durationDays ?? 30,
    endsAt: campaign.display_ends_at ?? null,
    isFreeToJoin,
    joinToken,
    joinAmount,
    forfeitPct,
    proposedPoolAmount,
    prizeWinnerCount:
      campaign.prize_winner_count ?? campaign.prizeWinnerCount ?? 10,
    isFunded: isCampaignFunded(campaign.status ?? "approved"),
    proofCadence: campaign.proof_cadence ?? campaign.proofCadence ?? "daily",
    proofInstructions:
      campaign.proof_instructions ?? campaign.proofInstructions ?? null,
    pointsPerMilestone: BASE_PROOF_POINTS,
    maxForfeitTotal,
    fundedPoolAmount: campaign.funded_pool_amount,
    totalParticipantStakes: campaign.total_participant_stakes,
    totalPrizePoolAmount: campaign.total_prize_pool_amount,
    participantCount: campaign.participant_count,
  };
}
