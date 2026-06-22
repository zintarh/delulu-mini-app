"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ProofModal } from "@/components/proof-modal";
import {
  CampaignExploreCard,
  CampaignExploreCardSkeleton,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import type { CommunityCampaignFeedItem } from "@/lib/community/campaign-types";
import {
  homeCampaignKeys,
  useHomeCampaignsFeed,
} from "@/hooks/use-home-campaigns-feed";
import {
  joinedDashboardKeys,
  useJoinedCampaignDashboard,
} from "@/hooks/use-user-campaign-milestones";
import {
  joinCommunityCampaignWithWallet,
  submitCommunityProofWithWallet,
} from "@/lib/community/join-campaign-client";
import {
  useJoinCommunityCampaignOnChain,
  useSubmitCommunityMilestoneProofOnChain,
} from "@/hooks/use-community-campaign-onchain";
import { useAuth } from "@/hooks/use-auth";

function feedItemToCardData(c: CommunityCampaignFeedItem): CampaignExploreCardData {
  return {
    id: c.id,
    title: c.title,
    proposedPoolAmount: c.proposed_pool_amount,
    durationDays: c.duration_days,
    coverImageUrl: c.cover_image_url,
    displayEndsAt: c.display_ends_at,
    status: c.status,
    participantCount: 0,
    milestoneCount: c.milestone_count ?? 0,
    isJoined: c.participant_state === "joined",
    community: { name: c.community.name, slug: c.community.slug },
  };
}

function MissionCard({
  campaign,
  onSubmit,
  isBusy,
}: {
  campaign: ReturnType<typeof useJoinedCampaignDashboard>["data"] extends (infer T)[] | undefined
    ? T
    : never;
  onSubmit: () => void;
  isBusy: boolean;
}) {
  const milestone = campaign.next_milestones[0];
  if (!milestone) return null;

  const progress =
    campaign.milestone_count > 0
      ? `${campaign.completed_count} of ${campaign.milestone_count} done`
      : null;

  return (
    <div className="relative h-44 overflow-hidden rounded-2xl">
      {/* Background */}
      {campaign.cover_image_url ? (
        <Image
          src={campaign.cover_image_url}
          alt=""
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #4f46e5 0%, #1e1b4b 50%, #1a1a19 100%)",
          }}
        />
      )}

      {/* Overlay — heavy at bottom, light at top */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/15" />

      {/* Scanline texture for that editorial feel */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 3px)",
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">
              {campaign.community.name}
            </p>
            <p className="truncate text-[11px] font-semibold text-white/70">
              {campaign.title}
            </p>
          </div>
          {progress ? (
            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/70 backdrop-blur-sm">
              {progress}
            </span>
          ) : null}
        </div>

        {/* Bottom */}
        <div>
          <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
            Today&apos;s milestone
          </p>
          <p className="mb-3.5 line-clamp-2 text-[17px] font-black leading-tight text-white">
            {milestone.label}
          </p>
          <button
            type="button"
            disabled={isBusy}
            onClick={onSubmit}
            className="w-full rounded-full bg-white py-2.5 text-sm font-black text-[#1a1a19] transition-opacity disabled:opacity-60 active:opacity-80"
          >
            {isBusy ? "Uploading…" : "Submit proof →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Immersive mission cards — one per joined campaign with a pending milestone.
 * Proof modal state lives here so submissions happen without page navigation.
 */
function TodaysMilestonesSection({ address }: { address: string }) {
  const queryClient = useQueryClient();
  const { submitCommunityCampaignMilestoneProofAndWait } =
    useSubmitCommunityMilestoneProofOnChain();
  const { data, isLoading } = useJoinedCampaignDashboard(address);

  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [activeProof, setActiveProof] = useState<{
    campaignId: string;
    challengeId: number;
    milestoneId: number;
  } | null>(null);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
  }, [address, queryClient]);

  const handleProofSubmit = async (imageUrl: string) => {
    if (!activeProof) return;
    setProofBusy(true);
    setProofError(null);
    try {
      await submitCommunityProofWithWallet({
        campaignId: activeProof.campaignId,
        walletAddress: address,
        proofUrl: imageUrl,
        milestoneId: activeProof.milestoneId,
        submitOnChain: submitCommunityCampaignMilestoneProofAndWait,
      });
      setProofSuccess(true);
      invalidate();
    } catch (err) {
      setProofError(err instanceof Error ? err.message : "Proof failed");
    } finally {
      setProofBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 px-4 py-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  const active = (data ?? []).filter((c) => c.next_milestones.length > 0);
  if (active.length === 0) return null;

  const SHOW_MAX = 3;
  const visible = active.slice(0, SHOW_MAX);
  const hiddenCount = active.length - SHOW_MAX;

  return (
    <div className="px-4 py-2">
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between">
        <p
          className="text-[11px] font-black uppercase tracking-[0.16em] text-foreground/60"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Your missions
        </p>
        {active.length > 1 && (
          <Link
            href="/communities"
            className="text-[11px] font-semibold text-delulu-blue hover:underline"
          >
            {active.length} active →
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {visible.map((c) => (
          <MissionCard
            key={c.campaign_id}
            campaign={c}
            isBusy={proofBusy && activeProof?.campaignId === c.campaign_id}
            onSubmit={() => {
              const milestone = c.next_milestones[0];
              if (!milestone) return;
              setActiveProof({
                campaignId: c.campaign_id,
                challengeId: c.challenge_id,
                milestoneId: milestone.milestone_id,
              });
              setProofSuccess(false);
              setProofError(null);
              setProofOpen(true);
            }}
          />
        ))}
      </div>

      {hiddenCount > 0 && (
        <Link
          href="/communities"
          className="mt-2.5 flex w-full items-center justify-center rounded-xl border border-border/50 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          +{hiddenCount} more campaign{hiddenCount !== 1 ? "s" : ""} →
        </Link>
      )}

      <ProofModal
        open={proofOpen}
        onOpenChange={setProofOpen}
        onSubmit={handleProofSubmit}
        isSubmitting={proofBusy}
        submitSuccess={proofSuccess}
        submitError={proofError ? new Error(proofError) : null}
        onDone={() => {
          setProofOpen(false);
          setProofSuccess(false);
          setActiveProof(null);
        }}
        isOnChain
      />
    </div>
  );
}

function DiscoverCampaignsSection({
  address,
  onJoin,
  joiningId,
  joinError,
}: {
  address: string;
  onJoin: (campaign: CommunityCampaignFeedItem) => void;
  joiningId: string | null;
  joinError: string | null;
}) {
  const { data, isLoading } = useHomeCampaignsFeed("ongoing", address);
  const campaigns = (data?.pages.flatMap((p) => p.campaigns) ?? []).slice(0, 4);

  if (isLoading) {
    return (
      <div className="px-4 py-2 space-y-3">
        <div className="h-4 w-36 animate-pulse rounded-lg bg-muted" />
        {[1, 2].map((i) => (
          <CampaignExploreCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) return null;

  return (
    <div className="px-4 py-2">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Discover campaigns
        </p>
        <Link
          href="/explore?tab=campaigns"
          className="text-[11px] font-semibold text-delulu-blue hover:underline"
        >
          See all →
        </Link>
      </div>

      {joinError ? (
        <p className="mb-2 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {joinError}
        </p>
      ) : null}

      <div className="space-y-4">
        {campaigns.map((c) => (
          <CampaignExploreCard
            key={c.id}
            campaign={feedItemToCardData(c)}
            joining={joiningId === c.id}
            onJoin={() => onJoin(c)}
          />
        ))}
      </div>
    </div>
  );
}

export function HomeCampaignsSection() {
  const { address } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { joinCommunityCampaignAndWait } = useJoinCommunityCampaignOnChain();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const invalidateFeeds = useCallback(() => {
    if (!address) return;
    void queryClient.invalidateQueries({ queryKey: homeCampaignKeys.feed("ongoing", address) });
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
  }, [address, queryClient]);

  const runJoin = useCallback(
    async (campaign: CommunityCampaignFeedItem) => {
      if (!address) return;
      setJoiningId(campaign.id);
      setJoinError(null);
      try {
        const result = await joinCommunityCampaignWithWallet(
          campaign.id,
          address,
          joinCommunityCampaignAndWait,
        );
        invalidateFeeds();
        if (result.joinedCampaign || result.alreadyJoined) {
          router.push(`/communities/${campaign.community.slug}/campaigns/${campaign.id}`);
        }
      } catch (err) {
        setJoinError(err instanceof Error ? err.message : "Join failed");
      } finally {
        setJoiningId(null);
      }
    },
    [address, invalidateFeeds, joinCommunityCampaignAndWait, router],
  );

  if (!address) return null;

  return (
    <>
      <TodaysMilestonesSection address={address} />
      <DiscoverCampaignsSection
        address={address}
        onJoin={runJoin}
        joiningId={joiningId}
        joinError={joiningId ? joinError : null}
      />
    </>
  );
}
