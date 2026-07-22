"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { ExploreCampaignsSection } from "@/components/explore-campaigns-section";
import {
  CampaignExploreCard,
  CampaignExploreCardSkeleton,
} from "@/components/community/campaign-explore-card";
import type { CampaignSearchResult } from "@/hooks/use-campaign-search";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useAuth();

  const q = searchParams.get("q")?.trim() ?? "";
  const isSearchMode = !!q;

  const [campaignResults, setCampaignResults] = useState<
    CampaignSearchResult[]
  >([]);
  const [isCampaignSearching, setIsCampaignSearching] = useState(false);
  const [campaignSearchError, setCampaignSearchError] = useState(false);

  const fetchCampaignResults = useCallback(
    async (signal?: AbortSignal) => {
      if (!q) {
        setCampaignResults([]);
        return;
      }
      setIsCampaignSearching(true);
      setCampaignSearchError(false);
      try {
        const res = await fetch(
          `/api/search/campaigns?q=${encodeURIComponent(q)}`,
          { signal },
        );
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        setCampaignResults(data.results ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCampaignSearchError(true);
        setCampaignResults([]);
      } finally {
        setIsCampaignSearching(false);
      }
    },
    [q],
  );

  useEffect(() => {
    if (!isSearchMode) return;
    const controller = new AbortController();
    void fetchCampaignResults(controller.signal);
    return () => controller.abort();
  }, [isSearchMode, fetchCampaignResults]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPullRefresh = (event: Event) => {
      const path = (event as CustomEvent<{ pathname?: string }>).detail
        ?.pathname;
      if (path !== "/explore") return;
      if (isSearchMode) void fetchCampaignResults();
    };
    window.addEventListener("delulu:pull-refresh", onPullRefresh);
    return () =>
      window.removeEventListener("delulu:pull-refresh", onPullRefresh);
  }, [isSearchMode, fetchCampaignResults]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="sticky top-0 z-20 h-[2px] w-full overflow-hidden pointer-events-none lg:top-0">
          {isCampaignSearching && (
            <div className="absolute inset-0 bg-border/30">
              <div className="h-full w-1/3 animate-[progress-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-delulu-blue" />
            </div>
          )}
        </div>

        <div
          className={cn(
            "mx-auto w-full px-4 sm:px-6 lg:px-8",
            isSearchMode
              ? "max-w-[1600px] py-6 lg:py-8"
              : "max-w-[1600px] pb-20 pt-3 lg:pb-12 lg:pt-4",
          )}
        >
          {!isSearchMode ? (
            <ExploreCampaignsSection address={address} />
          ) : (
            <>
              <header className="mb-4">
                <h1
                  className="text-lg font-black tracking-tight text-foreground"
                >
                  {`Results for "${q}"`}
                </h1>
              </header>

              {campaignSearchError ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <Search className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Search failed</p>
                  <button
                    type="button"
                    onClick={() => void fetchCampaignResults()}
                    className="text-sm font-semibold text-delulu-blue underline"
                  >
                    Try again
                  </button>
                </div>
              ) : isCampaignSearching ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <CampaignExploreCardSkeleton key={i} />
                  ))}
                </div>
              ) : campaignResults.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <Search className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    No campaigns found
                  </p>
                  <Link
                    href="/explore"
                    className="text-sm font-semibold text-delulu-blue"
                  >
                    Browse all campaigns
                  </Link>
                </div>
              ) : (
                <div className=" max-w-4xl xl:max-w-6xl ">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {campaignResults.map((c) => (
                      <CampaignExploreCard
                        key={c.id}
                        className="shadow-sm hover:shadow-md"
                        campaign={{
                          id: c.id,
                          title: c.title,
                          description: c.description,
                          proposedPoolAmount: 0,
                          durationDays: c.duration_days,
                          coverImageUrl: c.cover_image_url,
                          displayEndsAt: c.display_ends_at,
                          status: "active",
                          participantCount: 0,
                          milestoneCount: 0,
                          isJoined: false,
                          isFreeToJoin: c.is_free_to_join,
                          community: {
                            name: c.community_name,
                            slug: c.community_slug,
                          },
                        }}
                        joining={false}
                        onJoin={() => {
                          router.push(
                            `/communities/${c.community_slug}/campaigns/${c.id}`,
                          );
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
