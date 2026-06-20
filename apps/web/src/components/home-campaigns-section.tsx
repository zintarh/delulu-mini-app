"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Target } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type {
  CommunityCampaignFeedItem,
  HomeCampaignFeedSection,
} from "@/lib/community/campaign-types";
import {
  homeCampaignKeys,
  useHomeCampaignsFeed,
} from "@/hooks/use-home-campaigns-feed";
import { joinCommunityCampaignWithWallet } from "@/lib/community/join-campaign-client";
import { useJoinCommunityCampaignOnChain } from "@/hooks/use-community-campaign-onchain";

function CampaignFeedCard({
  campaign,
  onJoin,
  joiningId,
  isJoinedSection,
}: {
  campaign: CommunityCampaignFeedItem;
  onJoin: (campaign: CommunityCampaignFeedItem) => void;
  joiningId: string | null;
  isJoinedSection: boolean;
}) {
  const href = `/communities/${campaign.community.slug}/campaigns/${campaign.id}`;
  const isJoining = joiningId === campaign.id;
  const showPool =
    campaign.is_funded && campaign.proposed_pool_amount > 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm">
      <Link href={href} className="block min-w-0">
        <div className="flex items-start gap-2.5">
          {campaign.cover_image_url ? (
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl">
              <Image
                src={campaign.cover_image_url}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-delulu-blue-light text-delulu-blue">
              <Target className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-foreground leading-snug line-clamp-2">
              {campaign.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Hosted by {campaign.community.name}
            </p>
            {showPool ? (
              <p className="mt-1 text-xs font-semibold tabular-nums text-foreground">
                {campaign.proposed_pool_amount} G$ pool
              </p>
            ) : null}
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </Link>
      {isJoinedSection ? (
        <Link
          href={href}
          className={cn(
            "mt-3 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-bold transition-colors",
            "bg-delulu-blue-light text-delulu-blue hover:bg-delulu-blue-light/80",
          )}
        >
          Submit proof
        </Link>
      ) : (
        <button
          type="button"
          disabled={isJoining}
          onClick={(e) => {
            e.preventDefault();
            onJoin(campaign);
          }}
          className={cn(
            "mt-3 w-full rounded-xl py-2.5 text-sm font-bold transition-colors",
            "bg-delulu-blue text-white hover:bg-delulu-blue/90 disabled:opacity-50",
          )}
        >
          {isJoining ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Joining…
            </span>
          ) : (
            "Join"
          )}
        </button>
      )}
    </div>
  );
}

function CampaignSection({
  title,
  section,
  address,
  onJoin,
  joiningId,
}: {
  title: string;
  section: HomeCampaignFeedSection;
  address: string;
  onJoin: (campaign: CommunityCampaignFeedItem) => void;
  joiningId: string | null;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useHomeCampaignsFeed(section, address);

  const campaigns = data?.pages.flatMap((p) => p.campaigns) ?? [];

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, campaigns.length]);

  if (isLoading) {
    return (
      <div className="px-4 py-2">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <div className="space-y-2.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) return null;

  return (
    <div className="px-4 py-2">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="space-y-2.5">
        {campaigns.map((c) => (
          <CampaignFeedCard
            key={c.id}
            campaign={c}
            joiningId={joiningId}
            isJoinedSection={section === "joined"}
            onJoin={onJoin}
          />
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}
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
    void queryClient.invalidateQueries({ queryKey: homeCampaignKeys.feed("joined", address) });
    void queryClient.invalidateQueries({ queryKey: homeCampaignKeys.feed("ongoing", address) });
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
      <CampaignSection
        title="Your campaigns"
        section="joined"
        address={address}
        onJoin={runJoin}
        joiningId={joiningId}
      />
      <CampaignSection
        title="Ongoing campaigns"
        section="ongoing"
        address={address}
        onJoin={runJoin}
        joiningId={joiningId}
      />
      {joinError ? (
        <p className="px-4 pb-2 text-xs text-destructive">{joinError}</p>
      ) : null}
    </>
  );
}
