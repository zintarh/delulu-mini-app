"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, ArrowLeft, TrendingUp, ChevronRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useAllDelulus } from "@/hooks/graph";
import type { FormattedDelulu } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────────

type SearchResult = {
  id: string;
  onChainId: string;
  creator: string;
  content: string;
  username: string | null;
  pfpUrl: string | null;
  bgImageUrl: string | null;
  totalSupportCollected: number;
  totalSupporters: number;
  creatorStake: number;
  createdAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function tileGradient(creator: string) {
  const hex = creator.replace("0x", "").toLowerCase();
  const h1 = parseInt(hex.slice(0, 6), 16) % 360;
  const h2 = (h1 + 55) % 360;
  return `linear-gradient(140deg, hsl(${h1},50%,25%) 0%, hsl(${h2},55%,15%) 100%)`;
}

function isContentLoaded(d: FormattedDelulu) {
  if (!d.content) return false;
  const isHash =
    d.content.startsWith("Qm") ||
    (d.content.length > 40 && /^[a-f0-9]+$/i.test(d.content));
  return !isHash;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated } = useAuth();

  // Trending uses the already-loaded feed data (fast, no extra fetch)
  const { delulus, isLoading: isFeedLoading } = useAllDelulus();
  const trendingDelulus = delulus
    .filter(isContentLoaded)
    .sort(
      (a, b) =>
        (b.totalSupportCollected ?? b.totalStake ?? 0) -
        (a.totalSupportCollected ?? a.totalStake ?? 0),
    )
    .slice(0, 8);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Search ────────────────────────────────────────────────────────────────

  const runSearch = useCallback(async (q: string, silent = false) => {
    if (q.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setIsIndexBuilding(false);
      if (pollRef.current) clearTimeout(pollRef.current);
      return;
    }

    // Cancel previous in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (!silent) setIsSearching(true);
    setSearchError(false);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q.trim().toLowerCase())}`,
        { signal: ctrl.signal },
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results ?? []);
      setHasSearched(true);
      setIsIndexBuilding(data.isBuilding ?? false);
      setIndexedCount(data.indexedCount ?? 0);
      setTotalCount(data.totalCount ?? 0);

      // While the index is still building, poll for updated results every 1.5s
      if (data.isBuilding) {
        if (pollRef.current) clearTimeout(pollRef.current);
        pollRef.current = setTimeout(() => runSearch(q, true), 1500);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setSearchError(true);
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      abortRef.current?.abort();
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(() => runSearch(value), 300);
  };

  // Seed from ?q= param
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuery(q);
      runSearch(q);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!authenticated) router.replace("/");
  }, [authenticated, router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  if (!authenticated) return null;

  const hasQuery = query.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search goals, creators..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            {hasQuery && (
              <button
                onClick={() => handleQueryChange("")}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {hasQuery && (
            <button
              onClick={() => handleQueryChange("")}
              className="shrink-0 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4">

        {/* ── Results ── */}
        {hasQuery && (
          <>
            {searchError && (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <p className="text-sm text-muted-foreground">Something went wrong</p>
                <button
                  onClick={() => runSearch(query)}
                  className="text-xs text-foreground underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            )}

            {!searchError && !isSearching && hasSearched && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Search className="w-10 h-10 text-muted-foreground/30" />
                {isIndexBuilding ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Still indexing content…
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {indexedCount} of {totalCount} indexed — results will appear automatically
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      No results for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Try different keywords
                    </p>
                  </>
                )}
              </div>
            )}

            {!searchError && results.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">
                    {results.length} result{results.length !== 1 ? "s" : ""}
                  </p>
                  {isIndexBuilding && totalCount > 0 && (
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Indexing {indexedCount}/{totalCount}
                    </span>
                  )}
                </div>
                <div className="space-y-px">
                  {results.map((d) => {
                    const handle = d.username
                      ? `@${d.username}`
                      : `${d.creator.slice(0, 6)}…${d.creator.slice(-4)}`;
                    return (
                      <button
                        key={d.id}
                        onClick={() => router.push(`/delulu/${d.id}`)}
                        className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-xl px-2 -mx-2 transition-colors text-left"
                      >
                        <div
                          className="shrink-0 w-12 h-12 rounded-xl overflow-hidden"
                          style={{ background: tileGradient(d.creator) }}
                        >
                          {d.bgImageUrl && (
                            <img
                              src={d.bgImageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                            {d.content || "Untitled"}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {handle}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Trending (empty state) ── */}
        {!hasQuery && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Trending
              </span>
            </div>

            {isFeedLoading ? (
              <div className="space-y-px">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-3 animate-pulse">
                    <div className="w-5 h-3 bg-muted rounded" />
                    <div className="flex-1 h-3 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-px">
                {trendingDelulus.map((d, i) => {
                  const handle = d.username
                    ? `@${d.username}`
                    : `${d.creator.slice(0, 6)}…${d.creator.slice(-4)}`;
                  return (
                    <button
                      key={d.id}
                      onClick={() => router.push(`/delulu/${d.id}`)}
                      className="w-full flex items-center gap-4 py-3 hover:bg-muted/50 rounded-xl px-2 -mx-2 transition-colors text-left group"
                    >
                      <span
                        className={cn(
                          "shrink-0 w-6 text-center text-sm font-black tabular-nums",
                          i === 0 && "text-delulu-yellow",
                          i === 1 && "text-amber-400",
                          i === 2 && "text-orange-400",
                          i > 2 && "text-muted-foreground/50",
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground line-clamp-1">
                          {d.content || "Untitled"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {handle}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
