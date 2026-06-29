"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCampaignSearch } from "@/hooks/use-campaign-search";
import type { CampaignSearchResult } from "@/hooks/use-campaign-search";
import { isCampaignEndedByDate } from "@/lib/community/campaign-types";

type HomeSearchProps = {
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  variant?: "default" | "hero";
};

function CampaignResultRow({
  result,
  onSelect,
}: {
  result: CampaignSearchResult;
  onSelect: () => void;
}) {
  const isClosed = isCampaignEndedByDate(result.display_ends_at);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-delulu-blue-light">
        {result.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Target className="h-4 w-4 text-delulu-blue" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{result.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {result.community_name}
          {isClosed ? " · Closed" : result.is_free_to_join ? " · Free" : " · Paid"}
        </p>
      </div>
    </button>
  );
}

export function HomeSearch({
  className,
  inputClassName,
  placeholder = "Search campaigns...",
  variant = "default",
}: HomeSearchProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const {
    query,
    setQuery,
    clearQuery,
    results,
    isSearching,
    hasSearched,
    searchError,
    hasQuery,
  } = useCampaignSearch();

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

  const openCampaign = (result: CampaignSearchResult) => {
    setOpen(false);
    router.push(`/communities/${result.community_slug}/campaigns/${result.id}`);
  };

  const handleSubmit = () => {
    const q = query.trim();
    if (q.length >= 2) {
      setOpen(false);
      router.push(`/explore?tab=campaigns&q=${encodeURIComponent(q)}`);
    } else if (results.length > 0 && results[0]) {
      openCampaign(results[0]);
    }
  };

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
          aria-label="Search campaigns"
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
            "max-h-[min(70vh,480px)] overflow-y-auto rounded-2xl border border-border bg-card shadow-[0_8px_40px_rgba(0,0,0,0.12)]",
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
                  Searching...
                </div>
              ) : null}

              {!searchError && hasSearched && results.length === 0 && !isSearching ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No campaigns found for &ldquo;{query.trim()}&rdquo;
                </p>
              ) : null}

              {results.length > 0 ? (
                <>
                  <div className="px-3 pb-1 pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      Campaigns
                    </p>
                  </div>
                  {results.slice(0, 8).map((r) => (
                    <CampaignResultRow
                      key={r.id}
                      result={r}
                      onSelect={() => openCampaign(r)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="mx-2 mb-2 mt-1 w-[calc(100%-1rem)] rounded-full bg-[#efefef] py-2.5 text-sm font-semibold text-foreground hover:bg-[#e2e2e2]"
                  >
                    See all results
                  </button>
                </>
              ) : null}
            </div>
          ) : (
            <div className="p-4">
              <p className="text-sm text-muted-foreground text-center py-4">
                Type to search campaigns
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
