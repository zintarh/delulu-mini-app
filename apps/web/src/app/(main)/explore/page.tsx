"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { DeluluCard } from "@/components/delulu-card";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { HomeSearch } from "@/components/home-search";
import { buildFeedCategories, type FeedCategoryId } from "@/lib/feed-categories";
import { recordSearchKeyword } from "@/lib/search-keywords";
import type { DeluluSearchResult } from "@/lib/search-types";
import type { FormattedDeluluFeed } from "@/hooks/graph/useAllDelulus";
import { useAllDelulus } from "@/hooks/graph";
import type { FormattedDelulu } from "@/lib/types";
import { usePfps } from "@/hooks/use-profile-pfp";
import { useAuth } from "@/hooks/use-auth";

const BROWSE_PAGE_SIZE = 20;

const CATEGORY_TITLES: Record<FeedCategoryId, string> = {
  "on-a-roll": "On a roll 🔥",
  "for-you": "For you",
  "worth-a-look": "Worth a look",
};

function isContentLoaded(d: FormattedDelulu) {
  if (!d.content) return false;
  const isHash =
    d.content.startsWith("Qm") ||
    (d.content.length > 40 && /^[a-f0-9]+$/i.test(d.content));
  return !isHash;
}

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

  const {
    delulus,
    isLoading: isFeedLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useAllDelulus();

  const filteredFeed = useMemo(
    () => delulus.filter(isContentLoaded),
    [delulus],
  );

  const [apiResults, setApiResults] = useState<DeluluSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const fetchResults = useCallback(async () => {
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
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();
      setApiResults(data.results ?? []);
      if (q) recordSearchKeyword(q);
    } catch {
      setSearchError(true);
      setApiResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [q, country, category]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  const categoryItems = useMemo(() => {
    if (!category) return [];
    const cats = buildFeedCategories(filteredFeed, address);
    return cats.find((c) => c.id === category)?.items ?? [];
  }, [category, filteredFeed, address]);

  const countryFeedItems = useMemo(() => {
    if (!country || q || category) return [];
    return filteredFeed.filter(
      (d) => d.gatekeeper?.enabled && d.gatekeeper.value?.toUpperCase() === country,
    );
  }, [country, q, category, filteredFeed]);

  const allBrowseItems = useMemo(() => {
    if (q || category || country) return [];
    return [...filteredFeed].sort((a, b) => {
      const at = a.createdAt?.getTime() ?? 0;
      const bt = b.createdAt?.getTime() ?? 0;
      return bt - at;
    });
  }, [q, category, country, filteredFeed]);

  // Visible count for browse pagination
  const [visibleCount, setVisibleCount] = useState(BROWSE_PAGE_SIZE);
  // Reset when switching modes
  useEffect(() => {
    setVisibleCount(BROWSE_PAGE_SIZE);
  }, [q, category, country]);

  const displayDelulus: FormattedDelulu[] = useMemo(() => {
    if (category) return categoryItems;
    if (q || (country && apiResults.length > 0)) {
      return apiResults.map(searchResultToCardProps);
    }
    if (country) return countryFeedItems;
    return allBrowseItems.slice(0, visibleCount);
  }, [category, categoryItems, q, country, apiResults, countryFeedItems, allBrowseItems, visibleCount]);

  const isBrowseMode = !q && !category && !country;
  const hasMoreVisible = isBrowseMode && visibleCount < allBrowseItems.length;
  const canFetchMore = isBrowseMode && !hasMoreVisible && !!hasNextPage;

  // Infinite scroll for browse view
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (!isBrowseMode) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 400) {
        if (hasMoreVisible) {
          setVisibleCount((c) => c + BROWSE_PAGE_SIZE);
        } else if (canFetchMore && !isFetchingNextPage) {
          fetchNextPage();
        }
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isBrowseMode, hasMoreVisible, canFetchMore, isFetchingNextPage, fetchNextPage]);

  const creatorAddresses = useMemo(
    () => Array.from(new Set(displayDelulus.map((d) => d.creator.toLowerCase()))),
    [displayDelulus],
  );
  const creatorPfps = usePfps(creatorAddresses);


  const pageTitle = q
    ? `Results for "${q}"`
    : country
      ? country
      : category
        ? CATEGORY_TITLES[category] ?? "Explore"
        : "It's your world. Be delusional.";

  const isLoading =
    isSearching || (isFeedLoading && displayDelulus.length === 0 && !q);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="lg:hidden sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <HomeSearch variant="default" placeholder="Search…" />
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide pt-0 lg:pt-0">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mb-6 hidden lg:block">
            <HomeSearch variant="hero" />
          </div>

          <header className="mb-6">
            <Link
              href="/"
              className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {pageTitle}
            </h1>
          </header>

          {searchError ? (
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
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <DeluluCardSkeleton key={i} className="mb-0" />
              ))}
            </div>
          ) : displayDelulus.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Search className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nothing found</p>
              <Link
                href="/explore"
                className="text-sm font-semibold text-delulu-blue"
              >
                Browse all delulus
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {displayDelulus.map((delusion, index) => {
                  const feedDelusion = delusion as FormattedDeluluFeed;
                  return (
                    <DeluluCard
                      key={`explore-${delusion.onChainId || delusion.id}-${index}`}
                      delusion={delusion}
                      href={`/delulu/${delusion.id}`}
                      variant="feed"
                      className="mb-0"
                      disableMilestoneQuery
                      disableUsernameLookup
                      feedMilestones={feedDelusion.feedMilestones}
                      totalMilestoneCount={feedDelusion.totalMilestoneCount}
                      creatorPfpUrl={creatorPfps[delusion.creator.toLowerCase()]}
                    />
                  );
                })}
              </div>

              {(hasMoreVisible || canFetchMore || isFetchingNextPage) && isBrowseMode ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
