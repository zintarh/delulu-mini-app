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
import { CampaignJoinFlowOverlay } from "@/components/community/campaign-join-flow-overlay";
import { useSubmitCommunityMilestoneProofOnChain } from "@/hooks/use-community-campaign-onchain";
import { submitCommunityProofWithWallet } from "@/lib/community/join-campaign-client";
import { proofErrorMessage } from "@/lib/community/format-proof-error";
import { useCampaignJoinFlow } from "@/hooks/use-campaign-join-flow";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { MainPage } from "@/components/main-app-header";
import { cn } from "@/lib/utils";

/** Mirrors CommunityCampaignDetail: blue header, stats ticket, rules, standings, bottom CTA. */
function CommunityCampaignDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse pb-32 xl:max-w-3xl" aria-busy aria-label="Loading campaign">
      <div className="bg-[#fdf1c7] px-5 pb-12 pt-4">
        <div className="flex justify-between">
          <div className="h-11 w-11 rounded-full bg-white/80" />
          <div className="h-11 w-11 rounded-full bg-white/80" />
        </div>
        <div className="mt-4 aspect-[16/9] w-full rounded-3xl bg-white/80" />
        <div className="mt-6 h-3 w-32 rounded bg-[#8a6a00]/20" />
        <div className="mt-2.5 h-6 w-4/5 rounded-lg bg-white/80" />
        <div className="mt-2 h-6 w-1/2 rounded-lg bg-white/80" />
      </div>

      <div className="relative -mt-7 px-5">
        <div className="flex rounded-3xl border-2 border-line bg-white">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn("flex flex-1 flex-col items-center gap-1.5 p-4", i > 0 && "border-l-2 border-dashed border-line")}>
              <div className="h-7 w-12 rounded-md bg-muted" />
              <div className="h-2 w-8 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 pt-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3.5">
            <div className="h-5 w-6 rounded bg-muted" />
            <div className={cn("h-4 rounded bg-muted", i === 1 ? "w-2/3" : "w-4/5")} />
          </div>
        ))}
      </div>

      <div className="px-5 pt-6">
        <div className="mb-1.5 h-3 w-20 rounded bg-muted" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <div className="h-6 w-[26px] rounded bg-muted" />
            <div className="h-9 w-9 rounded-full bg-muted" />
            <div className="h-4 flex-1 rounded bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="fixed inset-x-0 z-40 mx-auto max-w-xl px-5" style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 24px)" }}>
        <div className="h-14 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

type ProofStep = "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming";

export function CommunityCampaignPageClient() {
  const params = useParams<{ slug: string; id: string }>();
  const { address, authenticated } = useAuth();
  const joinFlow = useCampaignJoinFlow();
  const { requireAuth } = useRedirectToSignIn();
  const { submitCommunityCampaignMilestoneProofAndWait } =
    useSubmitCommunityMilestoneProofOnChain();

  const [campaign, setCampaign] = useState<CommunityCampaignDetailData | null>(null);
  const [leaderboard, setLeaderboard] = useState<CampaignLeaderboardRow[]>([]);
  const [leaderboardPage, setLeaderboardPage] = useState(0);
  const [leaderboardHasMore, setLeaderboardHasMore] = useState(false);
  const [loadingLeaderboardPage, setLoadingLeaderboardPage] = useState(false);
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

  const fetchLeaderboardPage = useCallback(
    async (page: number) => {
      const res = await fetch(`/api/community/campaigns/${params.id}/leaderboard?page=${page}`);
      const json = await res.json();
      const rows = (json.leaderboard ?? []) as CampaignLeaderboardRow[];
      setLeaderboard(rows);
      setLeaderboardPage(page);
      setLeaderboardHasMore(Boolean(json.hasMore));
      if (address) {
        const me = rows.find((r) => r.wallet_address.toLowerCase() === address.toLowerCase());
        if (me) setMyPoints(me.points_total);
      }
    },
    [params.id, address],
  );

  const loadLeaderboard = useCallback(
    () => fetchLeaderboardPage(0),
    [fetchLeaderboardPage],
  );

  const goToLeaderboardPage = useCallback(
    async (page: number) => {
      setLoadingLeaderboardPage(true);
      try {
        await fetchLeaderboardPage(page);
      } finally {
        setLoadingLeaderboardPage(false);
      }
    },
    [fetchLeaderboardPage],
  );

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
    requireAuth(() => {
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
    });
  }, [campaign, joinFlow, milestoneCount, params.id, participantCount, poolStats, requireAuth]);

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
      setProofError(proofErrorMessage(err));
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
      <div className="mx-auto w-full max-w-3xl lg:pt-6">
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
            leaderboardPage={leaderboardPage}
            hasMoreLeaderboard={leaderboardHasMore}
            loadingLeaderboardPage={loadingLeaderboardPage}
            onPrevLeaderboardPage={() => void goToLeaderboardPage(Math.max(0, leaderboardPage - 1))}
            onNextLeaderboardPage={() => void goToLeaderboardPage(leaderboardPage + 1)}
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
