"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ExternalLink, Search, X, Loader2, ChevronRight } from "lucide-react";
import { useDeluluLeaderboard } from "@/hooks/graph";
import { useRouter } from "next/navigation";
import { cn, formatGAmountInt } from "@/lib/utils";
import { usePfps } from "@/hooks/use-profile-pfp";
import { UserAvatar } from "@/components/ui/user-avatar";

const DELULU_MONDAY_NOTION_URL =
  "https://flower-pilot-b9a.notion.site/Delulu-Monday-Apr-6-13-2026-4781ca0e2d024b65b97fd3222dcac9b4?source=copy_link";

type SearchResult = {
  id: string;
  creator: string;
  content: string;
  username: string | null;
  bgImageUrl: string | null;
  totalSupportCollected: number;
};

function tileGradient(creator: string) {
  const hex = creator.replace("0x", "").toLowerCase();
  const h1 = parseInt(hex.slice(0, 6), 16) % 360;
  const h2 = (h1 + 55) % 360;
  return `linear-gradient(140deg, hsl(${h1},50%,25%) 0%, hsl(${h2},55%,15%) 100%)`;
}

export function RightSidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [flyerImageError, setFlyerImageError] = useState(false);
  const { entries: topEntries, isLoading: isLeaderboardLoading } =
    useDeluluLeaderboard(6, 0);

  const leaderboardAddresses = topEntries.map((e) => e.creatorAddress.toLowerCase());
  const pfpMap = usePfps(leaderboardAddresses);

  const router = useRouter();

  // ── Search state ──────────────────────────────────────────────────────────
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const runSearch = useCallback(async (q: string, silent = false) => {
    if (q.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setIsIndexBuilding(false);
      if (pollRef.current) clearTimeout(pollRef.current);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (!silent) setIsSearching(true);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q.trim().toLowerCase())}`,
        { signal: ctrl.signal },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.results ?? []);
      setHasSearched(true);
      setIsIndexBuilding(data.isBuilding ?? false);
      setIndexedCount(data.indexedCount ?? 0);
      setTotalCount(data.totalCount ?? 0);

      if (data.isBuilding) {
        if (pollRef.current) clearTimeout(pollRef.current);
        pollRef.current = setTimeout(() => runSearch(q, true), 1500);
      }
    } catch (err: any) {
      // AbortError is expected on every new keystroke — ignore silently
    } finally {
      if (!ctrl.signal.aborted) setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);


  const hasQuery = searchQuery.trim().length > 0;

  return (
    <aside className="h-screen sticky top-0 px-5 py-4 overflow-y-auto scrollbar-hide bg-background border-l border-border text-foreground">

      {/* ── Search bar ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search Delulus..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoComplete="off"
            autoCorrect="off"
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
      </div>

      {/* ── Search results ── */}
      {hasQuery ? (
        <div>
          {/* Result count + indexing indicator */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">
              {hasSearched ? `${results.length} result${results.length !== 1 ? "s" : ""}` : "Searching…"}
            </span>
            {isIndexBuilding && totalCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {indexedCount}/{totalCount}
              </span>
            )}
          </div>

          {hasSearched && results.length === 0 && !isSearching ? (
            isIndexBuilding ? (
              <p className="text-xs text-muted-foreground/60 text-center py-6">
                Still indexing… results will appear automatically
              </p>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">
                No results for &ldquo;{searchQuery}&rdquo;
              </p>
            )
          ) : (
            <div className="space-y-px">
              {results.map((d) => {
                const handle = d.username
                  ? `@${d.username}`
                  : `${d.creator.slice(0, 6)}…${d.creator.slice(-4)}`;
                return (
                  <button
                    key={d.id}
                    onClick={() => router.push(`/delulu/${d.id}`)}
                    className="w-full flex items-center gap-2.5 py-2.5 hover:bg-muted/50 rounded-xl px-2 -mx-2 transition-colors text-left"
                  >
                    <div
                      className="shrink-0 w-10 h-10 rounded-lg overflow-hidden"
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
                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
                        {d.content || "Untitled"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{handle}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── Flyer ── */}
          <div className="rounded-2xl border border-border bg-card p-3 mb-6 shadow-sm">
            <div className="rounded-xl overflow-hidden border border-border/70 bg-muted/20 min-h-[240px]">
              {!flyerImageError ? (
                <img
                  src="/flyer.png"
                  alt="Delulu Monday campaign flyer"
                  className="w-full h-full object-cover"
                  onError={() => setFlyerImageError(true)}
                />
              ) : (
                <div className="w-full min-h-[180px] bg-gradient-to-br from-delulu-yellow-reserved/30 via-background to-delulu-green/20 p-4">
                  <h3 className="mt-2 text-lg font-black leading-tight text-foreground">
                    Join the weekly campaign and compete for rewards.
                  </h3>
                </div>
              )}
            </div>
            <div className="mt-3 px-1">
              <p className="mt-1 text-xs text-muted-foreground">
                Read the full participation guide and rules.
              </p>
              <a
                href={DELULU_MONDAY_NOTION_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted"
              >
                How to participate
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* ── Delulu Monday leaderboard ── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-sm font-semibold text-foreground"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Delulu Monday
              </h2>
              <button
                type="button"
                onClick={() => router.push("/leaderboard?tab=campaign")}
                className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors font-medium"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                See all
              </button>
            </div>

            <div className="space-y-1">
              {isLeaderboardLoading ? (
                <>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={`lb-skel-${i}`} className="flex items-center gap-2.5 px-2 py-2 rounded-xl animate-pulse">
                      <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
                      <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 bg-muted rounded w-3/4" />
                        <div className="h-2 bg-muted rounded w-1/2" />
                      </div>
                      <div className="h-2.5 bg-muted rounded w-8" />
                    </div>
                  ))}
                </>
              ) : topEntries.length > 0 ? (
                topEntries.map((entry, idx) => {
                  const rank = idx + 1;
                  const handle = entry.creatorUsername
                    ? `@${entry.creatorUsername}`
                    : `${entry.creatorAddress.slice(0, 6)}…${entry.creatorAddress.slice(-4)}`;
                  const headline = entry.title?.trim() || "Untitled delulu";
                  const pfpEntry = pfpMap[entry.creatorAddress.toLowerCase()];

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => router.push(`/delulu/${entry.id}`)}
                      className={cn(
                        "group w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left",
                        rank === 1
                          ? "bg-[#fcff52]/5 hover:bg-[#fcff52]/8 border border-[#fcff52]/10"
                          : "bg-card/30 hover:bg-card/70 border border-border/30",
                      )}
                    >
                      {/* Rank badge — matches leaderboard page */}
                      {rank === 1 ? (
                        <div className="w-6 h-6 rounded-full bg-[#fcff52] flex items-center justify-center shadow-[0_0_8px_rgba(252,255,82,0.4)] shrink-0">
                          <span className="text-[10px] font-bold text-black" style={{ fontFamily: "'Clash Display', sans-serif" }}>1</span>
                        </div>
                      ) : rank === 2 ? (
                        <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-zinc-200" style={{ fontFamily: "'Clash Display', sans-serif" }}>2</span>
                        </div>
                      ) : rank === 3 ? (
                        <div className="w-6 h-6 rounded-full bg-[#35d07f]/20 border border-[#35d07f]/30 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#35d07f]" style={{ fontFamily: "'Clash Display', sans-serif" }}>3</span>
                        </div>
                      ) : (
                        <div className="w-6 h-6 flex items-center justify-center shrink-0">
                          <span className="text-[10px] text-muted-foreground/40 tabular-nums" style={{ fontFamily: "'Clash Display', sans-serif" }}>{rank}</span>
                        </div>
                      )}

                      <UserAvatar
                        address={entry.creatorAddress}
                        username={entry.creatorUsername}
                        pfpUrl={pfpEntry}
                        size={28}
                      />

                      <div className="flex-1 min-w-0">
                        {/* L1: title */}
                        <p className="text-xs font-semibold text-white truncate leading-tight" style={{ fontFamily: "var(--font-manrope)" }}>
                          {headline}
                        </p>
                        {/* L3: creator handle */}
                        <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5" style={{ fontFamily: "var(--font-manrope)" }}>
                          {handle}
                        </p>
                      </div>

                      {/* UB — primary metric in yellow */}
                      <span className="shrink-0 text-[11px] font-bold text-[#fcff52] tabular-nums" style={{ fontFamily: "var(--font-manrope)" }}>
                        {entry.uniqueBuyerCount}
                        <span className="text-[9px] font-normal text-muted-foreground/40 ml-0.5">UB</span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="py-6 text-center text-[11px] text-muted-foreground/50" style={{ fontFamily: "var(--font-manrope)" }}>
                  No entries this week yet.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
