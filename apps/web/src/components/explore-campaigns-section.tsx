"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Lulu, MonoLabel, Segmented } from "@/components/ds";
import {
  CampaignFeaturedCard,
  CampaignTicketRow,
  CampaignTicketRowSkeleton,
  campaignDaysLeft,
  isCampaignOpen,
} from "@/components/community/campaign-explore-card";
import { useExploreCampaigns } from "@/hooks/use-explore-campaigns";

type Tab = "open" | "ending" | "joined";

const TABS: { value: Tab; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "ending", label: "Ending" },
  { value: "joined", label: "Joined" },
];

/** Campaign list (design: docs/redesign/screens/Campaigns.dc.html). */
export function ExploreCampaignsSection({ address }: { address?: string }) {
  const [tab, setTab] = useState<Tab>("open");
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error, refetch, isRefetching } =
    useExploreCampaigns(address, "recent", {});
  const sentinelRef = useRef<HTMLDivElement>(null);

  const campaigns = useMemo(() => data?.pages.flatMap((page) => page.campaigns) ?? [], [data]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && !isLoading) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  const { featured, rows, heading } = useMemo(() => {
    const open = campaigns.filter(isCampaignOpen);
    if (tab === "joined") {
      return { featured: null, rows: campaigns.filter((c) => c.isJoined), heading: "Joined" };
    }
    if (tab === "ending") {
      const ending = [...open].sort((a, b) => (campaignDaysLeft(a) ?? 1e9) - (campaignDaysLeft(b) ?? 1e9));
      return { featured: null, rows: ending, heading: "Ending soon" };
    }
    const pick = open.find((c) => c.isJoined) ?? open[0] ?? null;
    return { featured: pick, rows: open.filter((c) => c !== pick), heading: "Open now" };
  }, [campaigns, tab]);

  return (
    <div>
      <Segmented options={TABS} value={tab} onChange={setTab} ariaLabel="Campaign filter" />

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-3">
          <div className="h-[186px] animate-pulse rounded-3xl bg-[#fdf1c7]" />
          {Array.from({ length: 3 }).map((_, i) => (
            <CampaignTicketRowSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load campaigns. Try again.</p>
          <button type="button" onClick={() => void refetch()} disabled={isRefetching} className="text-sm font-bold text-blue">
            {isRefetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : !featured && rows.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <Lulu size={64} mood="dream" />
          <p className="mt-3 text-sm font-semibold text-muted-foreground">
            {tab === "joined" ? "You haven't joined a campaign yet" : "No open campaigns right now"}
          </p>
        </div>
      ) : (
        <>
          {featured ? <CampaignFeaturedCard campaign={featured} className="mt-6" /> : null}
          {rows.length > 0 ? (
            <div className="mt-6 flex flex-col gap-3">
              <MonoLabel>{heading}</MonoLabel>
              {rows.map((c, i) => (
                <CampaignTicketRow key={c.id} campaign={c} index={i} />
              ))}
            </div>
          ) : null}
        </>
      )}

      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  );
}
