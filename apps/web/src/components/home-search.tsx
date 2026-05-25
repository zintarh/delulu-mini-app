"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeluluSearch } from "@/hooks/use-delulu-search";
import { getPopularSearchKeywords, recordSearchKeyword } from "@/lib/search-keywords";
import { SearchResultRow } from "@/components/search-result-row";
import type { DeluluSearchResult } from "@/lib/search-types";

type HomeSearchProps = {
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  /** Larger bar for desktop home header */
  variant?: "default" | "hero";
};

export function HomeSearch({
  className,
  inputClassName,
  placeholder = "Search Delulus, creators…",
  variant = "default",
}: HomeSearchProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);

  const {
    query,
    setQuery,
    clearQuery,
    results,
    bootstrap,
    isSearching,
    isBootstrapLoading,
    hasSearched,
    searchError,
    isIndexBuilding,
    hasQuery,
    loadBootstrap,
    runSearch,
  } = useDeluluSearch();

  useEffect(() => {
    setPopularKeywords(getPopularSearchKeywords(5));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void loadBootstrap();
  }, [open, loadBootstrap]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const goToExplore = (params: Record<string, string>) => {
    const sp = new URLSearchParams(params);
    const q = params.q?.trim();
    if (q) recordSearchKeyword(q);
    setOpen(false);
    router.push(`/explore?${sp.toString()}`);
  };

  const openDelulu = (result: DeluluSearchResult) => {
    if (hasQuery) recordSearchKeyword(query);
    setOpen(false);
    router.push(`/delulu/${result.id}`);
  };

  const handleSubmit = () => {
    const q = query.trim();
    if (q.length >= 2) {
      goToExplore({ q });
    } else if (results.length > 0) {
      openDelulu(results[0]!);
    }
  };

  const trending = bootstrap?.trending ?? [];
  const countries = bootstrap?.countries ?? [];

  const suggestionChips = useMemo(() => {
    const chips = new Set<string>();
    for (const kw of popularKeywords) chips.add(kw);
    for (const t of trending.slice(0, 3)) {
      const words = t.content.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
      if (words.length >= 3) chips.add(words);
    }
    return [...chips].slice(0, 5);
  }, [popularKeywords, trending]);

  const showDropdown = open;

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border bg-secondary transition-all",
          open ? "border-delulu-blue/40 ring-2 ring-delulu-blue/15" : "border-transparent",
          variant === "hero" ? "px-6 py-4 min-h-[52px]" : "px-4 py-3 min-h-[44px]",
          inputClassName,
        )}
      >
        {isSearching ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={placeholder}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none",
            variant === "hero" ? "text-base" : "text-sm",
          )}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          enterKeyHint="search"
          aria-label="Search Delulus"
          aria-expanded={showDropdown}
          aria-controls="home-search-dropdown"
        />
        {query ? (
          <button
            type="button"
            onClick={() => clearQuery()}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {showDropdown ? (
        <div
          id="home-search-dropdown"
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+8px)] z-[80]",
            "max-h-[min(70vh,520px)] overflow-y-auto rounded-2xl border border-border bg-card shadow-[0_8px_40px_rgba(0,0,0,0.12)]",
            "scrollbar-hide",
          )}
        >
          {hasQuery ? (
            <div className="p-2">
              {searchError ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Something went wrong. Try again.
                </p>
              ) : null}

              {!searchError && isSearching && results.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              ) : null}

              {!searchError && hasSearched && results.length === 0 && !isSearching ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {isIndexBuilding
                    ? "Still indexing — try again in a moment"
                    : `No results for “${query.trim()}”`}
                </p>
              ) : null}

              {results.length > 0 ? (
                <>
                  <div className="px-3 pb-1 pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      Delulus
                    </p>
                  </div>
                  {results.slice(0, 8).map((r) => (
                    <SearchResultRow
                      key={r.id}
                      result={r}
                      onSelect={() => openDelulu(r)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => goToExplore({ q: query.trim() })}
                    className="mx-2 mb-2 mt-1 w-[calc(100%-1rem)] rounded-full bg-[#efefef] py-2.5 text-sm font-semibold text-foreground hover:bg-[#e2e2e2]"
                  >
                    See all results
                  </button>
                </>
              ) : null}
            </div>
          ) : (
            <div className="p-4 space-y-5">
              {suggestionChips.length > 0 ? (
                <section>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Popular searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestionChips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setQuery(chip);
                        }}
                        className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary/80"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Trending delulus
                  </p>
                </div>
                {isBootstrapLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="-mx-1">
                    {trending.slice(0, 5).map((r) => (
                      <SearchResultRow
                        key={r.id}
                        result={r}
                        compact
                        onSelect={() => openDelulu(r)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <button
                type="button"
                onClick={() => goToExplore({})}
                className="w-full rounded-full bg-[#efefef] py-2.5 text-sm font-semibold text-foreground hover:bg-[#e2e2e2]"
              >
                Explore all delulus
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
