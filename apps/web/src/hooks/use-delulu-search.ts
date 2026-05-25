"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DeluluSearchResult,
  SearchBootstrap,
} from "@/lib/search-types";

const DEBOUNCE_MS = 280;

export function useDeluluSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DeluluSearchResult[]>([]);
  const [bootstrap, setBootstrap] = useState<SearchBootstrap | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isBootstrapLoading, setIsBootstrapLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootstrapLoadedRef = useRef(false);

  const runSearch = useCallback(async (q: string, silent = false) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      abortRef.current?.abort();
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setSearchError(false);
      if (pollRef.current) clearTimeout(pollRef.current);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (!silent) setIsSearching(true);
    setSearchError(false);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed.toLowerCase())}`,
        { signal: ctrl.signal },
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results ?? []);
      setHasSearched(true);
      setIsIndexBuilding(data.isBuilding ?? false);

      if (data.isBuilding) {
        if (pollRef.current) clearTimeout(pollRef.current);
        pollRef.current = setTimeout(() => runSearch(trimmed, true), 1500);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setSearchError(true);
      }
    } finally {
      if (!ctrl.signal.aborted) setIsSearching(false);
    }
  }, []);

  const loadBootstrap = useCallback(async () => {
    if (bootstrapLoadedRef.current && bootstrap) return;
    setIsBootstrapLoading(true);
    try {
      const res = await fetch("/api/search?bootstrap=1");
      if (!res.ok) throw new Error("bootstrap failed");
      const data = (await res.json()) as SearchBootstrap;
      setBootstrap(data);
      bootstrapLoadedRef.current = true;
      setIsIndexBuilding(data.isBuilding ?? false);
    } catch {
      setBootstrap({
        trending: [],
        countries: [],
        isBuilding: false,
        indexedCount: 0,
        totalCount: 0,
      });
    } finally {
      setIsBootstrapLoading(false);
    }
  }, [bootstrap]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.trim().length < 2) {
        abortRef.current?.abort();
        setResults([]);
        setHasSearched(false);
        setIsSearching(false);
        setSearchError(false);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(() => runSearch(value), DEBOUNCE_MS);
    },
    [runSearch],
  );

  const clearQuery = useCallback(() => {
    handleQueryChange("");
  }, [handleQueryChange]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const hasQuery = query.trim().length >= 2;
  const showEmptyState = !hasQuery;

  return {
    query,
    setQuery: handleQueryChange,
    clearQuery,
    results,
    bootstrap,
    isSearching,
    isBootstrapLoading,
    hasSearched,
    searchError,
    isIndexBuilding,
    hasQuery,
    showEmptyState,
    loadBootstrap,
    runSearch,
  };
}
