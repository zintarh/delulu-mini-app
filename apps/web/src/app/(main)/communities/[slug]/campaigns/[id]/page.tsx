"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  CommunityCampaignDetail,
  type CampaignLeaderboardRow,
  type CommunityCampaignDetailData,
} from "@/components/community/community-campaign-detail";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";
import { CampaignLeaderboardSkeleton } from "@/components/campaign-leaderboard-skeleton";
import {
  useJoinCommunityCampaignOnChain,
  useSubmitCommunityMilestoneProofOnChain,
} from "@/hooks/use-community-campaign-onchain";
import {
  joinCommunityCampaignWithWallet,
  submitCommunityProofWithWallet,
} from "@/lib/community/join-campaign-client";

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

export default function CommunityCampaignPage() {
  const params = useParams<{ slug: string; id: string }>();
  const { address, authenticated } = useAuth();
  const { joinCommunityCampaignAndWait } = useJoinCommunityCampaignOnChain();
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
  const [milestones, setMilestones] = useState<CommunityCampaignMilestoneRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofStep, setProofStep] = useState<ProofStep>("idle");
  const [activeMilestoneId, setActiveMilestoneId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      setIsJoined(Boolean(json.isJoined));
      setIsCommunityMember(Boolean(json.isCommunityMember));
      setParticipantCount(Number(json.participantCount ?? 0));
      if (json.myPoints != null) setMyPoints(Number(json.myPoints));
      if (json.myStreak != null) setMyStreak(Number(json.myStreak));
      setMilestoneCount(Number(json.milestoneCount ?? 0));
      setMilestones(json.milestones ?? []);
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

  const runJoin = async () => {
    if (!address) return;
    setJoining(true);
    setActionError(null);
    try {
      await joinCommunityCampaignWithWallet(params.id, address, joinCommunityCampaignAndWait);
      setIsJoined(true);
      await Promise.all([loadCampaign(), loadLeaderboard()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setJoining(false);
    }
  };

  const handleProofSubmit = async (imageUrl: string) => {
    if (!address || activeMilestoneId == null) return;
    setProofBusy(true);
    setProofError(null);
    setProofStep("uploading");
    try {
      const result = await submitCommunityProofWithWallet({
        campaignId: params.id,
        walletAddress: address,
        proofUrl: imageUrl,
        milestoneId: activeMilestoneId,
        submitOnChain: submitCommunityCampaignMilestoneProofAndWait,
        onStepChange: setProofStep,
      });
      setProofSuccess(true);
      setProofStep("idle");
      if (!result.onChain && result.pointsTotal != null) {
        setMyPoints(result.pointsTotal);
      }
      await loadLeaderboard();
      await loadCampaign();
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
    <main className="h-full overflow-y-auto scrollbar-hide bg-background">
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
      joining={joining}
      myPoints={myPoints}
      myStreak={myStreak}
      myRank={myRankInLeaderboard}
      milestoneCount={milestoneCount}
      milestones={milestones}
      proofOpen={proofOpen}
      proofBusy={proofBusy}
      proofSuccess={proofSuccess}
      proofError={proofError}
      proofStep={proofStep}
      activeMilestoneId={activeMilestoneId}
      actionError={actionError}
      onJoin={() => void runJoin()}
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
    </main>
  );
}
