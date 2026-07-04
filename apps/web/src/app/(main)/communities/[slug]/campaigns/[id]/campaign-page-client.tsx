"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  CommunityCampaignDetail,
  type CampaignLeaderboardRow,
  type CampaignPoolStats,
  type CommunityCampaignDetailData,
} from "@/components/community/community-campaign-detail";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";
import { CampaignLeaderboardSkeleton } from "@/components/campaign-leaderboard-skeleton";
import { CampaignJoinFlowOverlay } from "@/components/community/campaign-join-flow-overlay";
import { useSubmitCommunityMilestoneProofOnChain } from "@/hooks/use-community-campaign-onchain";
import { submitCommunityProofWithWallet } from "@/lib/community/join-campaign-client";
import { useCampaignJoinFlow } from "@/hooks/use-campaign-join-flow";
import { MainPage } from "@/components/main-app-header";

function CommunityCampaignDetailSkeleton() {
  return (
    <div className="animate-pulse px-4 pb-32 pt-2">
      <div className="mb-3 h-8 w-28 rounded-full bg-muted" />
      <div className="aspect-[16/9] w-full rounded-3xl bg-muted sm:aspect-[2/1]" />
      <div className="-mt-5 rounded-2xl border border-border/60 bg-card p-4 shadow-lg">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="mt-3 h-10 w-full rounded-xl bg-muted" />
      </div>
      <div className="mt-4 flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 w-24 shrink-0 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <div className="h-24 rounded-2xl bg-muted" />
        <div className="h-24 rounded-2xl bg-muted" />
      </div>
      <div className="mt-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="mt-8">
        <CampaignLeaderboardSkeleton rows={4} />
      </div>
    </div>
  );
}

type ProofStep = "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming";

export function CommunityCampaignPageClient() {
  const params = useParams<{ slug: string; id: string }>();
  const { address, authenticated } = useAuth();
  const joinFlow = useCampaignJoinFlow();
  const { submitCommunityCampaignMilestoneProofAndWait } =
    useSubmitCommunityMilestoneProofOnChain();

  const [campaign, setCampaign] = useState<CommunityCampaignDetailData | null>(null);
  const [leaderboard, setLeaderboard] = useState<CampaignLeaderboardRow[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const [isCommunityMember, setIsCommunityMember] = useState(false);
  const [myPoints, setMyPoints] = useState(0);
  const [myStreak, setMyStreak] = useState(0);
  const [milestoneCount, setMilestoneCount] = useState(0);
  const [canJoin, setCanJoin] = useState(false);
  const [milestones, setMilestones] = useState<CommunityCampaignMilestoneRow[]>([]);
  const [poolStats, setPoolStats] = useState<CampaignPoolStats | null>(null);

  // Track local confirmations so reloads never regress the UI while the
  // indexer (The Graph) catches up after an on-chain tx.
  const optimisticallyJoinedRef = useRef(false);
  const optimisticallyCompletedRef = useRef<Set<number>>(new Set());

  const [loading, setLoading] = useState(true);
  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofStep, setProofStep] = useState<ProofStep>("idle");
  const [activeMilestoneId, setActiveMilestoneId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [joiningCommunity, setJoiningCommunity] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    const res = await fetch(`/api/community/campaigns/${params.id}/leaderboard`);
    const json = await res.json();
    const rows = (json.leaderboard ?? []) as CampaignLeaderboardRow[];
    setLeaderboard(rows);
    if (address) {
      const me = rows.find((r) => r.wallet_address.toLowerCase() === address.toLowerCase());
      if (me) setMyPoints(me.points_total);
    }
  }, [params.id, address]);

  const loadCampaign = useCallback(async () => {
    const qs = address ? `?address=${encodeURIComponent(address)}` : "";
    const res = await fetch(`/api/community/campaigns/${params.id}${qs}`);
    const json = await res.json();
    if (res.ok) {
      setCampaign(json.campaign);
      // Never regress a locally-confirmed join even if the indexer hasn't caught up
      setIsJoined(optimisticallyJoinedRef.current || Boolean(json.isJoined));
      setIsCommunityMember(Boolean(json.isCommunityMember));
      setParticipantCount(Number(json.participantCount ?? 0));
      if (json.myPoints != null) setMyPoints(Number(json.myPoints));
      if (json.myStreak != null) setMyStreak(Number(json.myStreak));
      setMilestoneCount(Number(json.milestoneCount ?? 0));
      setCanJoin(Boolean(json.canJoin));
      // Merge server milestones with any locally-confirmed completions
      const serverMilestones = (json.milestones ?? []) as CommunityCampaignMilestoneRow[];
      const optimistic = optimisticallyCompletedRef.current;
      setMilestones(
        optimistic.size > 0
          ? serverMilestones.map((m) =>
              optimistic.has(m.milestone_id) ? { ...m, completed: true, is_overdue: false } : m,
            )
          : serverMilestones,
      );
      setPoolStats(json.poolStats ?? null);
      return Boolean(json.isJoined);
    }
    return false;
  }, [params.id, address]);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadCampaign(), loadLeaderboard()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCampaign, loadLeaderboard]);

  const openJoinModal = useCallback(() => {
    if (!campaign) return;
    setActionError(null);
    joinFlow.openJoinModal(params.id, {
      title: campaign.title,
      community: campaign.communities ? { name: campaign.communities.name } : null,
      duration_days: campaign.duration_days,
      milestone_count: milestoneCount,
      is_free_to_join: campaign.is_free_to_join,
      join_token: campaign.join_token,
      join_amount: campaign.join_amount,
      forfeit_pct: campaign.forfeit_pct,
      proposed_pool_amount: campaign.proposed_pool_amount,
      prize_winner_count: campaign.prize_winner_count,
      proof_cadence: campaign.proof_cadence,
      proof_instructions: campaign.proof_instructions,
      status: campaign.status,
      display_ends_at: campaign.display_ends_at,
      funded_pool_amount: poolStats?.fundedPoolAmount,
      total_participant_stakes: poolStats?.totalParticipantStakes,
      total_prize_pool_amount: poolStats?.totalPrizePoolAmount,
      participant_count: participantCount,
    });
  }, [campaign, joinFlow, milestoneCount, params.id, participantCount, poolStats]);

  const handleJoined = useCallback(async () => {
    // Mark joined optimistically so loadCampaign can't reset it
    optimisticallyJoinedRef.current = true;
    setIsJoined(true);
    await Promise.all([loadCampaign(), loadLeaderboard()]);
  }, [loadCampaign, loadLeaderboard]);

  const handleJoinCommunity = useCallback(async () => {
    if (!address) return;
    setJoiningCommunity(true);
    try {
      const res = await fetch(`/api/community/campaigns/${params.id}/join-community`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      if (res.ok) setIsCommunityMember(true);
    } finally {
      setJoiningCommunity(false);
    }
  }, [address, params.id]);

  const handleLeave = useCallback(async () => {
    if (!address) return;
    setLeaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/community/campaigns/${params.id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(json.error ?? "Failed to leave campaign. Try again.");
        return;
      }
      setIsJoined(false);
      optimisticallyJoinedRef.current = false;
      void Promise.all([loadLeaderboard(), loadCampaign()]);
    } catch {
      setActionError("Failed to leave campaign. Try again.");
    } finally {
      setLeaving(false);
    }
  }, [address, params.id, loadLeaderboard, loadCampaign]);

  const handleProofSubmit = async (proofUrls: string[]) => {
    if (!address || activeMilestoneId == null) return;
    setProofBusy(true);
    setProofError(null);
    setProofStep("uploading");
    try {
      const result = await submitCommunityProofWithWallet({
        campaignId: params.id,
        walletAddress: address,
        proofUrls,
        milestoneId: activeMilestoneId,
        submitOnChain: submitCommunityCampaignMilestoneProofAndWait,
        onStepChange: setProofStep,
      });

      // Optimistically mark this milestone complete so the UI updates
      // immediately even if the indexer hasn't indexed the tx yet.
      optimisticallyCompletedRef.current.add(activeMilestoneId);
      setMilestones((prev) =>
        prev.map((m) =>
          m.milestone_id === activeMilestoneId
            ? { ...m, completed: true, is_overdue: false }
            : m,
        ),
      );

      if (!result.onChain && result.pointsTotal != null) {
        setMyPoints(result.pointsTotal);
      }

      setProofSuccess(true);
      setProofStep("idle");

      // Reload in background — if indexer catches up great, if not the
      // optimistic state above keeps the milestone showing as complete.
      void Promise.all([loadLeaderboard(), loadCampaign()]);
    } catch (err) {
      setProofError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setProofStep("idle");
    } finally {
      setProofBusy(false);
    }
  };

  const communitySlug = campaign?.communities?.slug ?? params.slug;

  const myRankInLeaderboard = (() => {
    if (!address || !campaign) return undefined;
    const idx = leaderboard.findIndex(
      (r) => r.wallet_address.toLowerCase() === address.toLowerCase(),
    );
    return idx >= 0 ? idx + 1 : undefined;
  })();

  return (
    <MainPage>
      <div className="mx-auto w-full max-w-2xl xl:max-w-3xl lg:pt-6">
        {loading ? (
          <CommunityCampaignDetailSkeleton />
        ) : !campaign ? (
          <p className="px-4 py-16 text-center text-sm text-muted-foreground">
            Campaign not found
          </p>
        ) : (
          <CommunityCampaignDetail
            campaign={campaign}
            communitySlug={communitySlug}
            leaderboard={leaderboard}
            participantCount={participantCount}
            isJoined={isJoined}
            isCommunityMember={isCommunityMember}
            address={address}
            authenticated={authenticated}
            joining={joinFlow.joining}
            myPoints={myPoints}
            myStreak={myStreak}
            myRank={myRankInLeaderboard}
            milestoneCount={milestoneCount}
            canJoin={canJoin}
            milestones={milestones}
            proofOpen={proofOpen}
            proofBusy={proofBusy}
            proofSuccess={proofSuccess}
            proofError={proofError}
            proofStep={proofStep}
            activeMilestoneId={activeMilestoneId}
            actionError={actionError}
            poolStats={poolStats}
            onJoin={openJoinModal}
            onJoinCommunity={handleJoinCommunity}
            joiningCommunity={joiningCommunity}
            onLeave={handleLeave}
            leaving={leaving}
            onOpenProof={(milestoneId) => {
              setActiveMilestoneId(milestoneId);
              setProofSuccess(false);
              setProofError(null);
              setProofStep("idle");
              setProofOpen(true);
            }}
            onProofOpenChange={setProofOpen}
            onProofSubmit={handleProofSubmit}
            onProofDone={() => {
              setProofOpen(false);
              setProofSuccess(false);
              setActiveMilestoneId(null);
            }}
          />
        )}
      </div>

      <CampaignJoinFlowOverlay
        flow={joinFlow}
        address={address}
        onJoined={handleJoined}
      />
    </MainPage>
  );
}
