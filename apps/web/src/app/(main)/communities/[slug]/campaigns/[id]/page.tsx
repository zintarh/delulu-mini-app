"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  CommunityCampaignDetail,
  type CampaignLeaderboardRow,
  type CommunityCampaignDetailData,
} from "@/components/community/community-campaign-detail";
import {
  useJoinCommunityCampaignOnChain,
  useSubmitCommunityProofOnChain,
} from "@/hooks/use-community-campaign-onchain";
import {
  joinCommunityCampaignWithWallet,
  submitCommunityProofWithWallet,
} from "@/lib/community/join-campaign-client";

export default function CommunityCampaignPage() {
  const params = useParams<{ slug: string; id: string }>();
  const { address, authenticated } = useAuth();
  const { joinCommunityCampaignAndWait } = useJoinCommunityCampaignOnChain();
  const { submitCommunityProofAndWait } = useSubmitCommunityProofOnChain();
  const [campaign, setCampaign] = useState<CommunityCampaignDetailData | null>(null);
  const [leaderboard, setLeaderboard] = useState<CampaignLeaderboardRow[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const [isCommunityMember, setIsCommunityMember] = useState(false);
  const [myPoints, setMyPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
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
    }
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
      await joinCommunityCampaignWithWallet(
        params.id,
        address,
        joinCommunityCampaignAndWait,
      );
      setIsJoined(true);
      await Promise.all([loadCampaign(), loadLeaderboard()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setJoining(false);
    }
  };

  const handleProofSubmit = async (imageUrl: string) => {
    if (!address) return;
    setProofBusy(true);
    setProofError(null);
    try {
      const result = await submitCommunityProofWithWallet({
        campaignId: params.id,
        walletAddress: address,
        proofUrl: imageUrl,
        submitOnChain: submitCommunityProofAndWait,
      });
      setProofSuccess(true);
      if (!result.onChain && result.pointsTotal != null) {
        setMyPoints(result.pointsTotal);
      }
      await loadLeaderboard();
      await loadCampaign();
    } catch (err) {
      setProofError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setProofBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-delulu-blue" />
      </main>
    );
  }

  if (!campaign) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted-foreground">
        Campaign not found
      </main>
    );
  }

  const communitySlug = campaign.communities?.slug ?? params.slug;

  return (
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
      proofOpen={proofOpen}
      proofBusy={proofBusy}
      proofSuccess={proofSuccess}
      proofError={proofError}
      actionError={actionError}
      onJoin={() => void runJoin()}
      onOpenProof={() => {
        setProofSuccess(false);
        setProofError(null);
        setProofOpen(true);
      }}
      onProofOpenChange={setProofOpen}
      onProofSubmit={handleProofSubmit}
      onProofDone={() => {
        setProofOpen(false);
        setProofSuccess(false);
      }}
    />
  );
}
