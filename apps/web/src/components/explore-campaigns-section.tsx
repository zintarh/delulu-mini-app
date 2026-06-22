"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CampaignExploreCard,
  CampaignExploreCardSkeleton,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import { joinCommunityCampaignWithWallet } from "@/lib/community/join-campaign-client";
import { useJoinCommunityCampaignOnChain } from "@/hooks/use-community-campaign-onchain";

async function fetchActive(cursor?: string, address?: string) {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  if (address) params.set("address", address);
  const res = await fetch(`/api/community/campaigns/active?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load campaigns");
  return res.json() as Promise<{ campaigns: CampaignExploreCardData[]; nextCursor: string | null }>;
}

export function ExploreCampaignsSection({ address }: { address?: string }) {
  const router = useRouter();
  const { joinCommunityCampaignAndWait } = useJoinCommunityCampaignOnChain();
  const [campaigns, setCampaigns] = useState<CampaignExploreCardData[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = cursor !== null;

  const load = useCallback(
    async (replace = false) => {
      try {
        replace ? setLoading(true) : setLoadingMore(true);
        setError(null);
        const data = await fetchActive(replace ? undefined : cursor ?? undefined, address);
        setCampaigns((prev) => (replace ? data.campaigns : [...prev, ...data.campaigns]));
        setCursor(data.nextCursor);
      } catch {
        setError("Couldn't load campaigns. Try again.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [cursor, address],
  );

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          void load(false);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, load]);

  const runJoin = useCallback(
    async (campaign: CampaignExploreCardData) => {
      if (!address) return;
      setJoiningId(campaign.id);
      setJoinError(null);
      try {
        const result = await joinCommunityCampaignWithWallet(
          campaign.id,
          address,
          joinCommunityCampaignAndWait,
        );
        await load(true);
        if (result.joinedCampaign || result.alreadyJoined) {
          router.push(`/communities/${campaign.community?.slug ?? ""}/campaigns/${campaign.id}`);
        }
      } catch (err) {
        setJoinError(err instanceof Error ? err.message : "Join failed");
      } finally {
        setJoiningId(null);
      }
    },
    [address, joinCommunityCampaignAndWait, load, router],
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <CampaignExploreCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => void load(true)}
          className="text-sm font-semibold text-delulu-blue"
        >
          Retry
        </button>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Target className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No active campaigns yet</p>
      </div>
    );
  }

  return (
    <div>
      {joinError ? (
        <p className="mb-3 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {joinError}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {campaigns.map((c) => (
          <CampaignExploreCard
            key={c.id}
            campaign={c}
            joining={joiningId === c.id}
            onJoin={() => void runJoin(c)}
          />
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {loadingMore ? (
        <div className="flex justify-center py-4">
          <Loader2 className={cn("h-5 w-5 animate-spin text-muted-foreground")} />
        </div>
      ) : null}
    </div>
  );
}
