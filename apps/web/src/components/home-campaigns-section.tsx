"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import {
  CampaignExploreCard,
  CampaignExploreCardSkeleton,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import { CampaignJoinFlowOverlay } from "@/components/community/campaign-join-flow-overlay";
import type { CommunityCampaignFeedItem } from "@/lib/community/campaign-types";
import { homeCampaignKeys, useHomeCampaignsFeed } from "@/hooks/use-home-campaigns-feed";
import { useExploreCampaigns } from "@/hooks/use-explore-campaigns";
import { joinedDashboardKeys } from "@/hooks/use-user-campaign-milestones";
import { useCampaignJoinFlow } from "@/hooks/use-campaign-join-flow";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { useAuth } from "@/hooks/use-auth";
import { isValidOnChainChallengeId } from "@/lib/community/campaign-milestone-counts";
import { cn } from "@/lib/utils";
import { FEED_CARD_EYEBROW_CLASS } from "@/components/feed-card-layout";

/** Desktop side rail — three compact cards sized to the viewport. */
const DISCOVER_SIDE_LIMIT = 3;

function ExploreLink() {
  return (
    <Link
      href="/explore"
      className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-muted/40 py-1 pl-2.5 pr-2 text-[10px] font-semibold text-foreground transition-colors hover:bg-muted/70"
    >
      Explore
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

function feedItemToCardData(c: CommunityCampaignFeedItem): CampaignExploreCardData {
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

function DiscoverCampaignsSection({
  address,
  onJoin,
  joiningId,
  rail,
}: {
  address: string;
  onJoin: (campaign: CommunityCampaignFeedItem) => void;
  joiningId: string | null;
  rail?: boolean;
}) {
  const { data, isLoading } = useHomeCampaignsFeed("ongoing", address, "participants");
  const limit = rail ? DISCOVER_SIDE_LIMIT : 3;
  const campaigns = (data?.pages.flatMap((p) => p.campaigns) ?? []).slice(0, limit);
  const railRows = Math.max(campaigns.length, 1);

  if (isLoading) {
    return (
      <div
        className={cn(
          rail ? "flex min-h-0 flex-col py-0 lg:h-full" : "px-4 py-4",
        )}
      >
        <div className="mb-2.5 h-4 w-36 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div
          className={cn(
            "grid min-h-0",
            rail
              ? "flex-1 grid-cols-1 gap-2.5 lg:grid-rows-3"
              : "grid-cols-1 gap-5",
          )}
        >
          {Array.from({ length: limit }, (_, i) => (
            <CampaignExploreCardSkeleton key={i} compact={rail} />
          ))}
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) return null;

  return (
    <div
      className={cn(
        rail ? "flex min-h-0 flex-col py-0 lg:h-full" : "px-4 py-4",
      )}
    >
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className={FEED_CARD_EYEBROW_CLASS}>
          Campaigns
        </p>
        <ExploreLink />
      </div>

      <div
        className={cn(
          "grid min-h-0",
          rail ? "flex-1 grid-cols-1 gap-2.5" : "grid-cols-1 gap-5",
        )}
        style={
          rail
            ? { gridTemplateRows: `repeat(${railRows}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {campaigns.map((c) => (
          <CampaignExploreCard
            key={c.id}
            campaign={feedItemToCardData(c)}
            joining={joiningId === c.id}
            onJoin={() => onJoin(c)}
            compact={rail}
          />
        ))}
      </div>
    </div>
  );
}

function GuestDiscoverCampaignsSection({ rail }: { rail?: boolean }) {
  const joinFlow = useCampaignJoinFlow();
  const { requireAuth } = useRedirectToSignIn();
  const { data, isLoading } = useExploreCampaigns(undefined, "participants");
  const limit = rail ? DISCOVER_SIDE_LIMIT : 3;
  const campaigns = (data?.pages.flatMap((p) => p.campaigns) ?? []).slice(0, limit);
  const railRows = Math.max(campaigns.length, 1);

  const openJoin = useCallback(
    (campaign: CampaignExploreCardData) => {
      requireAuth(() => {
        joinFlow.openJoinModal(campaign.id, {
          title: campaign.title,
          community: campaign.community ? { name: campaign.community.name } : null,
          durationDays: campaign.durationDays,
          milestoneCount: campaign.milestoneCount,
          isFreeToJoin: campaign.isFreeToJoin,
          joinToken: campaign.joinToken,
          joinAmount: campaign.joinAmount,
          forfeitPct: campaign.forfeitPct,
          proposedPoolAmount: campaign.proposedPoolAmount,
          prizeWinnerCount: campaign.prizeWinnerCount,
          proofCadence: campaign.proofCadence,
          proofInstructions: campaign.proofInstructions,
          status: campaign.status,
        });
      });
    },
    [joinFlow, requireAuth],
  );

  if (isLoading) {
    return (
      <div
        className={cn(
          rail ? "flex min-h-0 flex-col py-0 lg:h-full" : "px-4 py-2",
        )}
      >
        <div className="mb-2.5 h-4 w-36 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div
          className={cn(
            "grid min-h-0",
            rail
              ? "flex-1 grid-cols-1 gap-2.5 lg:grid-rows-3"
              : "grid-cols-1 gap-4 lg:grid-cols-3",
          )}
        >
          {Array.from({ length: limit }, (_, i) => (
            <CampaignExploreCardSkeleton key={i} compact={rail} />
          ))}
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) return null;

  return (
    <div
      className={cn(
        rail ? "flex min-h-0 flex-col py-0 lg:h-full" : "px-4 py-2",
      )}
    >
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className={FEED_CARD_EYEBROW_CLASS}>
          Discover campaigns
        </p>
        <ExploreLink />
      </div>

      <div
        className={cn(
          "grid min-h-0",
          rail ? "flex-1 grid-cols-1 gap-2.5" : "grid-cols-1 gap-4 lg:grid-cols-3",
        )}
        style={
          rail
            ? { gridTemplateRows: `repeat(${railRows}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {campaigns.map((c) => (
          <CampaignExploreCard
            key={c.id}
            campaign={c}
            joining={joinFlow.pendingCampaignId === c.id && joinFlow.joining}
            onJoin={() => openJoin(c)}
            compact={rail}
          />
        ))}
      </div>

      <CampaignJoinFlowOverlay flow={joinFlow} onJoined={() => {}} />
    </div>
  );
}

export function HomeCampaignsSection({
  layout = "stack",
}: {
  /** `rail` = side column layout on desktop home */
  layout?: "stack" | "rail";
}) {
  const { address } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const joinFlow = useCampaignJoinFlow();
  const { requireAuth } = useRedirectToSignIn();
  const pendingJoinRef = useRef<CommunityCampaignFeedItem | null>(null);
  const rail = layout === "rail";

  const invalidateFeeds = useCallback(() => {
    if (!address) return;
    void queryClient.invalidateQueries({ queryKey: homeCampaignKeys.feed("ongoing", address) });
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
  }, [address, queryClient]);

  const openJoin = useCallback(
    (campaign: CommunityCampaignFeedItem) => {
      requireAuth(() => {
        pendingJoinRef.current = campaign;
        joinFlow.openJoinModal(campaign.id, {
          title: campaign.title,
          community: { name: campaign.community.name },
          duration_days: campaign.duration_days,
          milestone_count: campaign.milestone_count,
          is_free_to_join: campaign.is_free_to_join,
          join_token: campaign.join_token,
          join_amount: campaign.join_amount,
          forfeit_pct: campaign.forfeit_pct,
          proposed_pool_amount: campaign.proposed_pool_amount,
          prize_winner_count: campaign.prize_winner_count,
          proof_cadence: campaign.proof_cadence,
          proof_instructions: campaign.proof_instructions,
          status: campaign.status,
        });
      });
    },
    [joinFlow, requireAuth],
  );

  const handleJoined = useCallback(
    async (campaignId: string) => {
      invalidateFeeds();
      const campaign = pendingJoinRef.current;
      pendingJoinRef.current = null;
      if (campaign && campaign.id === campaignId) {
        router.push(`/communities/${campaign.community.slug}/campaigns/${campaignId}`);
      }
    },
    [invalidateFeeds, router],
  );

  if (!address) {
    return (
      <div className={cn(rail && "h-full min-h-0")}>
        <GuestDiscoverCampaignsSection rail={rail} />
      </div>
    );
  }

  return (
    <div className={cn(rail && "h-full min-h-0")}>
      <DiscoverCampaignsSection
        address={address}
        onJoin={openJoin}
        joiningId={joinFlow.joining ? joinFlow.pendingCampaignId : null}
        rail={rail}
      />

      <CampaignJoinFlowOverlay
        flow={joinFlow}
        address={address}
        onJoined={handleJoined}
      />
    </div>
  );
}
