"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { SocialFeedCardSkeleton } from "@/components/delulu-skeleton";
import { ExploreSocialFeed } from "@/components/explore-social-feed";
import { buildFeedCategories, type FeedCategoryId } from "@/lib/feed-categories";
import { recordSearchKeyword } from "@/lib/search-keywords";
import type { DeluluSearchResult } from "@/lib/search-types";
import { useAllDelulus } from "@/hooks/graph";
import { useNavigateToCreate } from "@/hooks/use-navigate-to-create";
import { FeedErrorState } from "@/components/feed-error-state";
import { ExploreCampaignsSection } from "@/components/explore-campaigns-section";
import {
  CampaignExploreCard,
  CampaignExploreCardSkeleton,
} from "@/components/community/campaign-explore-card";
import type { CampaignSearchResult } from "@/hooks/use-campaign-search";
import type { FormattedDelulu } from "@/lib/types";
import { usePfps } from "@/hooks/use-profile-pfp";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const CATEGORY_TITLES: Record<FeedCategoryId, string> = {
  "on-a-roll": "On a roll 🔥",
  "for-you": "For you",
  "worth-a-look": "Worth a look",
};

function searchResultToCardProps(r: DeluluSearchResult): FormattedDelulu {
  return {
    id: Number(r.id),
    onChainId: r.onChainId,
    creator: r.creator,
    tokenAddress: r.tokenAddress ?? "",
    contentHash: "",
    content: r.content,
    username: r.username ?? undefined,
    pfpUrl: r.pfpUrl ?? undefined,
    bgImageUrl: r.bgImageUrl ?? undefined,
    stakingDeadline: new Date(),
    resolutionDeadline: new Date(),
    totalBelieverStake: 0,
    totalDoubterStake: 0,
    totalStake: 0,
    creatorStake: r.creatorStake,
    totalSupportCollected: r.totalSupportCollected,
    totalSupporters: r.totalSupporters,
    outcome: false,
    isResolved: r.isResolved ?? false,
    isCancelled: false,
    gatekeeper:
      r.countryCode && r.countryLabel
        ? {
            enabled: true,
            type: "country",
            value: r.countryCode,
            label: r.countryLabel,
          }
        : undefined,
  };
}

export default function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useAuth();

  const q = searchParams.get("q")?.trim() ?? "";
  const country = searchParams.get("country")?.trim().toUpperCase() ?? "";
  const category = searchParams.get("category") as FeedCategoryId | null;
  const tab = searchParams.get("tab") ?? "campaigns";
  const isCampaignSearch = !!q && !country && !category;
  const isDiscoverMode = !q && !category && !country;
  const isCampaignsTab = isDiscoverMode && tab === "campaigns";

  const {
    delulus,
    isLoading: isFeedLoading,
    isIpfsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchFeed,
    error: feedError,
  } = useAllDelulus({ enabled: !isCampaignsTab });
  const { navigateToCreate } = useNavigateToCreate();

  const [feedNowMs, setFeedNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setFeedNowMs(Date.now()), 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") setFeedNowMs(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const onCreated = () => refetchFeed();
    if (typeof window !== "undefined") {
      window.addEventListener("delulu:created", onCreated);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("delulu:created", onCreated);
      }
    };
  }, [refetchFeed]);

  const [apiResults, setApiResults] = useState<DeluluSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const [campaignResults, setCampaignResults] = useState<CampaignSearchResult[]>([]);
  const [isCampaignSearching, setIsCampaignSearching] = useState(false);
  const [campaignSearchError, setCampaignSearchError] = useState(false);

  const fetchCampaignResults = useCallback(async (signal?: AbortSignal) => {
    if (!q) { setCampaignResults([]); return; }
    setIsCampaignSearching(true);
    setCampaignSearchError(false);
    try {
      const res = await fetch(`/api/search/campaigns?q=${encodeURIComponent(q)}`, { signal });
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
  }, [q]);

  useEffect(() => {
    if (!isCampaignSearch) return;
    const controller = new AbortController();
    void fetchCampaignResults(controller.signal);
    return () => controller.abort();
  }, [isCampaignSearch, fetchCampaignResults]);

  const fetchResults = useCallback(async (signal?: AbortSignal) => {
    if (category) {
      setApiResults([]);
      return;
    }
    if (!q && !country) {
      setApiResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(false);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q.toLowerCase());
      if (country) params.set("country", country);
      const res = await fetch(`/api/search?${params.toString()}`, { signal });
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();
      setApiResults(data.results ?? []);
      if (q) recordSearchKeyword(q);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSearchError(true);
      setApiResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [q, country, category]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchResults(controller.signal);
    return () => controller.abort();
  }, [fetchResults]);

  const categoryItems = useMemo(() => {
    if (!category) return [];
    const cats = buildFeedCategories(delulus, address);
    return cats.find((c) => c.id === category)?.items ?? [];
  }, [category, delulus, address]);

  const countryFeedItems = useMemo(() => {
    if (!country || q || category) return [];
    return delulus.filter(
      (d) => d.gatekeeper?.enabled && d.gatekeeper.value?.toUpperCase() === country,
    );
  }, [country, q, category, delulus]);

  const displayDelulus: FormattedDelulu[] = useMemo(() => {
    if (isDiscoverMode) return [];
    if (category) return categoryItems;
    if (q || (country && apiResults.length > 0)) {
      return apiResults.map(searchResultToCardProps);
    }
    if (country) return countryFeedItems;
    return [];
  }, [
    isDiscoverMode,
    category,
    categoryItems,
    q,
    country,
    apiResults,
    countryFeedItems,
  ]);

  const creatorAddresses = useMemo(
    () => Array.from(new Set(displayDelulus.map((d) => d.creator.toLowerCase()))),
    [displayDelulus],
  );
  const discoverCreatorAddresses = useMemo(
    () => Array.from(new Set(delulus.map((d) => d.creator.toLowerCase()))),
    [delulus],
  );
  const creatorPfps = usePfps(
    isDiscoverMode ? discoverCreatorAddresses : creatorAddresses,
  );

  const pageTitle = q
    ? `Results for "${q}"`
    : country
      ? country
      : category
        ? CATEGORY_TITLES[category] ?? "Explore"
        : "Explore delulus";

  const isFilteredLoading =
    isSearching || (isFeedLoading && displayDelulus.length === 0 && !q);

  const isDiscoverLoading = isDiscoverMode && isFeedLoading && delulus.length === 0;

  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshExplore = useCallback(async () => {
    setFeedNowMs(Date.now());
    if (!isCampaignsTab) {
      await refetchFeed();
    }
    if (!isDiscoverMode) {
      await fetchResults();
    }
  }, [refetchFeed, fetchResults, isDiscoverMode, isCampaignsTab]);

  useEffect(() => {
    const onPullRefresh = (event: Event) => {
      const path = (event as CustomEvent<{ pathname?: string }>).detail?.pathname;
      if (path !== "/explore") return;
      void refreshExplore();
    };
    window.addEventListener("delulu:pull-refresh", onPullRefresh);
    return () => window.removeEventListener("delulu:pull-refresh", onPullRefresh);
  }, [refreshExplore]);

  useEffect(() => {
    if (!isDiscoverMode || isCampaignsTab) return;
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (
        distanceFromBottom < 240 &&
        hasNextPage &&
        !isFetchingNextPage &&
        !isFeedLoading
      ) {
        fetchNextPage();
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [
    isDiscoverMode,
    isCampaignsTab,
    hasNextPage,
    isFetchingNextPage,
    isFeedLoading,
    fetchNextPage,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="sticky top-0 z-20 h-[2px] w-full overflow-hidden pointer-events-none lg:top-0">
          {(isDiscoverLoading ||
            isFilteredLoading ||
            (isDiscoverMode && isIpfsLoading && delulus.length > 0)) && (
            <div className="absolute inset-0 bg-border/30">
              <div className="h-full w-1/3 animate-[progress-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-delulu-blue" />
            </div>
          )}
        </div>

        <div
          className={cn(
            "mx-auto w-full px-4 sm:px-6 lg:px-8",
            isDiscoverMode
              ? "max-w-[1600px] pb-20 pt-3 lg:pb-12 lg:pt-4"
              : "max-w-[1600px] py-6 lg:py-8",
          )}
        >
          {/* Tab switcher — only in discover mode */}
          {isDiscoverMode && (
            <div className="mb-4 flex gap-1 w-fit rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => router.push("/explore?tab=campaigns")}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-bold transition-colors",
                  tab === "campaigns" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Campaigns
              </button>
              <button
                type="button"
                onClick={() => router.push("/explore?tab=goals")}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-bold transition-colors",
                  tab === "goals" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Goals
              </button>
            </div>
          )}

          {isDiscoverMode && tab === "campaigns" ? (
            <ExploreCampaignsSection address={address} />
          ) : isDiscoverMode ? (
            isDiscoverLoading ? (
              <ExploreSocialFeed
                delulus={[]}
                isLoading
                creatorPfps={{}}
              />
            ) : feedError && delulus.length === 0 ? (
              <FeedErrorState
                title="Couldn't load the feed"
                message="We had trouble reaching the network. Pull down to refresh or try again."
                onRetry={() => void refetchFeed()}
                isRetrying={isFeedLoading}
              />
            ) : delulus.length > 0 ? (
              <>
                <ExploreSocialFeed
                  delulus={delulus}
                  nowMs={feedNowMs}
                  creatorPfps={creatorPfps}
                />
                {isFetchingNextPage ? (
                  <div className="columns-1 gap-x-5 sm:columns-2 lg:columns-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SocialFeedCardSkeleton key={`more-${i}`} index={i} />
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <Search className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No delulus yet</p>
                <button
                  type="button"
                  onClick={() => void navigateToCreate()}
                  className="text-sm font-semibold text-delulu-blue"
                >
                  Create the first one
                </button>
              </div>
            )
          ) : (
            <>
              <header className="mb-4">
                <h1
                  className="text-lg font-black tracking-tight text-foreground"
                  style={{ fontFamily: '"Clash Display", sans-serif' }}
                >
                  {q ? `Results for "${q}"` : pageTitle}
                </h1>
              </header>

              {isCampaignSearch ? (
                campaignSearchError ? (
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
                    <p className="text-sm text-muted-foreground">No campaigns found</p>
                    <Link
                      href="/explore?tab=campaigns"
                      className="text-sm font-semibold text-delulu-blue"
                    >
                      Browse all campaigns
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {campaignResults.map((c) => (
                      <CampaignExploreCard
                        key={c.id}
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
                          community: { name: c.community_name, slug: c.community_slug },
                        }}
                        joining={false}
                        onJoin={() => {
                          router.push(`/communities/${c.community_slug}/campaigns/${c.id}`);
                        }}
                      />
                    ))}
                  </div>
                )
              ) : searchError ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <Search className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Search failed</p>
                  <button
                    type="button"
                    onClick={() => void fetchResults()}
                    className="text-sm font-semibold text-delulu-blue underline"
                  >
                    Try again
                  </button>
                </div>
              ) : isFilteredLoading ? (
                <div className="columns-1 gap-x-5 sm:columns-2 lg:columns-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <SocialFeedCardSkeleton key={i} index={i} />
                  ))}
                </div>
              ) : displayDelulus.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <Search className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nothing found</p>
                  <Link
                    href="/explore?tab=goals"
                    className="text-sm font-semibold text-delulu-blue"
                  >
                    Browse all delulus
                  </Link>
                </div>
              ) : (
                <ExploreSocialFeed
                  delulus={displayDelulus}
                  nowMs={feedNowMs}
                  creatorPfps={creatorPfps}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
