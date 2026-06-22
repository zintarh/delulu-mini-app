"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ProofModal } from "@/components/proof-modal";
import type { CommunityCampaignFeedItem } from "@/lib/community/campaign-types";
import {
  CampaignActionButton,
  CampaignHorizontalCard,
  CampaignPoolMeta,
  CampaignSectionSkeleton,
} from "@/components/community/campaign-horizontal-card";
import {
  homeCampaignKeys,
  useHomeCampaignsFeed,
} from "@/hooks/use-home-campaigns-feed";
import {
  joinedDashboardKeys,
  useJoinedCampaignDashboard,
} from "@/hooks/use-user-campaign-milestones";
import { joinCommunityCampaignWithWallet, submitCommunityProofWithWallet } from "@/lib/community/join-campaign-client";
import {
  useJoinCommunityCampaignOnChain,
  useSubmitCommunityMilestoneProofOnChain,
} from "@/hooks/use-community-campaign-onchain";
import { useAuth } from "@/hooks/use-auth";

function JoinedCampaignSection({
  address,
  joinError,
}: {
  address: string;
  joinError: string | null;
}) {
  const queryClient = useQueryClient();
  const { submitCommunityCampaignMilestoneProofAndWait } =
    useSubmitCommunityMilestoneProofOnChain();
  const { data, isLoading } = useJoinedCampaignDashboard(address);
  const campaigns = data ?? [];

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

  if (isLoading) return <CampaignSectionSkeleton rows={2} />;
  if (campaigns.length === 0) return null;

  return (
    <div className="px-4 py-2">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Your campaigns
        </p>
        <span className="rounded-full bg-delulu-blue-light px-1.5 py-0.5 text-[10px] font-bold text-delulu-blue">
          {campaigns.length}
        </span>
      </div>
      {joinError ? (
        <p className="mb-2 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {joinError}
        </p>
      ) : null}
      <div className="space-y-3">
        {campaigns.map((c) => {
          const href = `/communities/${c.community.slug}/campaigns/${c.campaign_id}`;
          const nextDue = c.next_milestones[0];
          return (
            <CampaignHorizontalCard
              key={c.campaign_id}
              href={href}
              title={c.title}
              subtitle={c.community.name}
              coverImageUrl={c.cover_image_url}
              size="comfortable"
              thumbnailSize="lg"
              progress={{ completed: c.completed_count, total: c.milestone_count }}
              milestones={c.next_milestones.slice(0, 2)}
              action={
                nextDue ? (
                  <CampaignActionButton
                    onClick={() => {
                      setActiveProof({
                        campaignId: c.campaign_id,
                        challengeId: c.challenge_id,
                        milestoneId: nextDue.milestone_id,
                      });
                      setProofSuccess(false);
                      setProofError(null);
                      setProofOpen(true);
                    }}
                  >
                    Submit proof
                  </CampaignActionButton>
                ) : (
                  <CampaignActionButton href={href} variant="muted">
                    View →
                  </CampaignActionButton>
                )
              }
            />
          );
        })}
      </div>

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

function OngoingCampaignSection({
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
  const campaigns = (data?.pages.flatMap((p) => p.campaigns) ?? []).slice(0, 3);

  if (isLoading) return <CampaignSectionSkeleton rows={3} />;
  if (campaigns.length === 0) return null;

  return (
    <div className="px-4 py-2">
      <div className="mb-2 flex items-center justify-between">
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
      <div className="space-y-3">
        {campaigns.map((c) => {
          const href = `/communities/${c.community.slug}/campaigns/${c.id}`;
          const hasMilestones = (c.milestone_count ?? 0) > 0;
          return (
            <CampaignHorizontalCard
              key={c.id}
              href={href}
              title={c.title}
              subtitle={`${c.community.name} · ${c.duration_days}d`}
              coverImageUrl={c.cover_image_url}
              size="comfortable"
              thumbnailSize="lg"
              meta={
                <CampaignPoolMeta
                  amount={c.proposed_pool_amount}
                  funded={c.is_funded}
                  comfortable
                />
              }
              action={
                hasMilestones ? (
                  <CampaignActionButton
                    disabled={joiningId === c.id}
                    onClick={() => onJoin(c)}
                  >
                    Join
                  </CampaignActionButton>
                ) : (
                  <CampaignActionButton href={href} variant="muted" size="compact">
                    <span className="sm:hidden">Soon</span>
                    <span className="hidden sm:inline">Milestones soon</span>
                  </CampaignActionButton>
                )
              }
            />
          );
        })}
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
      <JoinedCampaignSection address={address} joinError={joiningId ? null : joinError} />
      <OngoingCampaignSection
        address={address}
        onJoin={runJoin}
        joiningId={joiningId}
        joinError={joiningId ? joinError : null}
      />
    </>
  );
}
