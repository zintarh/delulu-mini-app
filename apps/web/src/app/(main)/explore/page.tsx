"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { SocialFeedCardSkeleton } from "@/components/delulu-skeleton";
import { HomeSearch } from "@/components/home-search";
import { ExploreSocialFeed } from "@/components/explore-social-feed";
import { buildFeedCategories, type FeedCategoryId } from "@/lib/feed-categories";
import { recordSearchKeyword } from "@/lib/search-keywords";
import type { DeluluSearchResult } from "@/lib/search-types";
import { useAllDelulus } from "@/hooks/graph";
import type { FormattedDelulu } from "@/lib/types";
import { usePfps } from "@/hooks/use-profile-pfp";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

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
    isIpfsLoading,
    refetch: refetchFeed,
  } = useAllDelulus();

  const filteredFeed = useMemo(
    () => delulus.filter(isContentLoaded),
    [delulus],
  );

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

  const isDiscoverMode = !q && !category && !country;

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
    () => Array.from(new Set(filteredFeed.map((d) => d.creator.toLowerCase()))),
    [filteredFeed],
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

  const isDiscoverLoading =
    isDiscoverMode &&
    (isFeedLoading || (isIpfsLoading && filteredFeed.length === 0));

  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="lg:hidden sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-2 px-4 py-3">
          {!isDiscoverMode ? (
            <button
              type="button"
              onClick={() => router.push("/explore")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Back to explore"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <HomeSearch variant="default" placeholder="Search…" />
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="sticky top-0 z-20 h-[2px] w-full overflow-hidden pointer-events-none lg:top-0">
          {(isDiscoverLoading || isFilteredLoading) && (
            <div className="absolute inset-0 bg-border/30">
              <div className="h-full w-1/3 animate-[progress-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-delulu-blue" />
            </div>
          )}
        </div>

        <div
          className={cn(
            "mx-auto w-full px-4 sm:px-6",
            isDiscoverMode
              ? "max-w-lg pb-20 pt-3 lg:pb-12 lg:pt-4"
              : "max-w-lg py-6 lg:py-8",
          )}
        >
          {isDiscoverMode ? (
            isDiscoverLoading ? (
              <ExploreSocialFeed
                delulus={[]}
                isLoading
                creatorPfps={{}}
                address={address}
              />
            ) : filteredFeed.length > 0 ? (
              <ExploreSocialFeed
                delulus={filteredFeed}
                nowMs={feedNowMs}
                creatorPfps={creatorPfps}
                address={address}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <Search className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No delulus yet</p>
                <Link
                  href="/board"
                  className="text-sm font-semibold text-delulu-blue"
                >
                  Create the first one
                </Link>
              </div>
            )
          ) : (
            <>
              <header className="mb-4">
                <h1
                  className="text-lg font-black tracking-tight text-foreground"
                  style={{ fontFamily: '"Clash Display", sans-serif' }}
                >
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
              ) : isFilteredLoading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SocialFeedCardSkeleton key={i} />
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
                <ExploreSocialFeed
                  delulus={displayDelulus}
                  nowMs={feedNowMs}
                  creatorPfps={creatorPfps}
                  address={address}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
