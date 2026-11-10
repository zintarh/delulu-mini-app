import type { CampaignExploreCardData } from "@/components/community/campaign-explore-card";
import type { CommunityCampaignFeedItem } from "@/lib/community/campaign-types";
import { isValidOnChainChallengeId } from "@/lib/community/campaign-milestone-counts";

/** Feed API row → the card shape the campaign cards render. */
export function feedItemToCardData(c: CommunityCampaignFeedItem): CampaignExploreCardData {
  return {
    id: c.id,
    title: c.title,
    proposedPoolAmount: c.proposed_pool_amount,
    durationDays: c.duration_days,
    coverImageUrl: c.cover_image_url,
    displayEndsAt: c.display_ends_at,
    createdAt: c.created_at,
    status: c.status,
    participantCount: c.participant_count ?? 0,
    participantAvatars: c.participant_avatars ?? [],
    milestoneCount: c.milestone_count ?? 0,
    canJoin: c.can_join ?? false,
    isOnChain: isValidOnChainChallengeId(c.on_chain_challenge_id ?? null),
    isJoined: c.participant_state === "joined",
    isFreeToJoin: c.is_free_to_join,
    joinToken: c.join_token ?? "G$",
    joinAmount: Number(c.join_amount ?? 0),
    forfeitPct: Number(c.forfeit_pct ?? 0),
    proofInstructions: c.proof_instructions ?? null,
    proofCadence: c.proof_cadence,
    prizeWinnerCount: c.prize_winner_count,
    telegramLink: c.telegram_link ?? null,
    community: { name: c.community.name, slug: c.community.slug },
  };
}
