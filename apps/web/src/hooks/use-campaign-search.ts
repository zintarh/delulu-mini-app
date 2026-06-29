"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CampaignSearchResult } from "@/app/api/search/campaigns/route";

const DEBOUNCE_MS = 280;

export type { CampaignSearchResult };

export function useCampaignSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CampaignSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      abortRef.current?.abort();
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setSearchError(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsSearching(true);
    setSearchError(false);

    try {
      const res = await fetch(
        `/api/search/campaigns?q=${encodeURIComponent(trimmed)}`,
        { signal: ctrl.signal },
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results ?? []);
      setHasSearched(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSearchError(true);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(query), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const clearQuery = useCallback(() => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setSearchError(false);
  }, []);

  return {
    query,
    setQuery,
    clearQuery,
    results,
    isSearching,
    hasSearched,
    searchError,
    hasQuery: query.trim().length >= 2,
  };
}
