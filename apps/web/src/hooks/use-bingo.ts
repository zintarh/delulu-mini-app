"use client";

import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { BingoCardView, BingoView } from "@/lib/bingo/view";

const withAddress = (url: string, address?: string | null) =>
  address ? `${url}${url.includes("?") ? "&" : "?"}address=${encodeURIComponent(address.toLowerCase())}` : url;

const listKey = (address?: string | null) => ["bingo", "list", address?.toLowerCase() ?? ""] as const;
const oneKey = (slug: string, address?: string | null) => ["bingo", "one", slug, address?.toLowerCase() ?? ""] as const;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Couldn't load Bingo");
  return json as T;
}

/**
 * Last Bingo list per wallet, kept on the device so reopening the app paints at
 * once instead of blank-then-pop; the live fetch replaces it moments later.
 * Bump the version when BingoView changes shape so an old copy is never drawn.
 */
const SAVED_VERSION = 1;
const SAVED_MAX_AGE_MS = 24 * 60 * 60_000;
const savedKey = (address?: string | null) => `delulu:bingo-list:v${SAVED_VERSION}:${address?.toLowerCase() ?? "guest"}`;

function readSaved(address?: string | null): { at: number; bingos: BingoView[] } | null {
  try {
    const raw = window.localStorage.getItem(savedKey(address));
    if (!raw) return null;
    const v = JSON.parse(raw) as { at?: unknown; bingos?: unknown };
    if (typeof v.at !== "number" || !Array.isArray(v.bingos) || Date.now() - v.at > SAVED_MAX_AGE_MS) return null;
    return { at: v.at, bingos: v.bingos as BingoView[] };
  } catch {
    return null;
  }
}

function writeSaved(address: string | null | undefined, bingos: BingoView[], at: number) {
  try {
    window.localStorage.setItem(savedKey(address), JSON.stringify({ at, bingos }));
  } catch {
    // Storage full or blocked (private mode): the live fetch still works.
  }
}

/**
 * Live Bingos — one shared, cached fetch for Home, Explore and the success
 * card (no waterfall per screen); refreshes in the background.
 */
export function useBingoList() {
  const { address } = useAuth();
  const qc = useQueryClient();
  const key = listKey(address);
  const q = useQuery({
    queryKey: key,
    queryFn: () => getJson<{ bingos: BingoView[] }>(withAddress("/api/bingo", address)).then((j) => j.bingos),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // Seed from the device after mount (never during render, so server and client HTML match).
  useEffect(() => {
    // Live data already here wins; otherwise the copy shows until the in-flight fetch replaces it.
    if (qc.getQueryData(key) !== undefined) return;
    const saved = readSaved(address);
    if (saved) qc.setQueryData(key, saved.bingos, { updatedAt: saved.at });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, address]);

  // Keep the device copy fresh — only real server results (not the seed or a placeholder).
  useEffect(() => {
    if (q.data && !q.isPlaceholderData && q.dataUpdatedAt && q.isFetchedAfterMount) writeSaved(address, q.data, q.dataUpdatedAt);
  }, [q.data, q.isPlaceholderData, q.dataUpdatedAt, q.isFetchedAfterMount, address]);

  return { bingos: q.data ?? (q.isError ? [] : null), reload: async () => void (await q.refetch()) };
}

export function useBingo(slug: string) {
  const { address } = useAuth();
  const qc = useQueryClient();
  const key = oneKey(slug, address);
  const q = useQuery({
    queryKey: key,
    queryFn: () => getJson<{ bingo: BingoView }>(withAddress(`/api/bingo/${slug}`, address)).then((j) => j.bingo),
    staleTime: 15_000,
    // Seed from the list so the page paints instantly when opened from a card.
    initialData: () => qc.getQueryData<BingoView[]>(listKey(address))?.find((b) => b.slug === slug),
    initialDataUpdatedAt: () => qc.getQueryState(listKey(address))?.dataUpdatedAt,
  });
  const setBingo = useCallback(
    (update: (prev: BingoView | null) => BingoView | null) => {
      qc.setQueryData<BingoView | undefined>(key, (prev) => update(prev ?? null) ?? undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, slug, address],
  );
  const reload = useCallback(async () => {
    await Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: ["bingo", "list"] })]);
  }, [q, qc]);
  return {
    bingo: q.data ?? null,
    setBingo,
    error: q.isError ? (q.error instanceof Error ? q.error.message : "Couldn't load this Bingo") : null,
    loading: q.isPending,
    reload,
  };
}

export type BoardCard = BingoCardView & { rank: number };

/** Players' cards: a weekly cycle's board, or a rolling Bingo's recent cards (`{ slug }`). */
export function useBingoBoard(source: string | { slug: string } | null | undefined) {
  const base = !source ? null : typeof source === "string" ? `/api/bingo/cycles/${source}/board` : `/api/bingo/${source.slug}/players`;
  const { address } = useAuth();
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (p = 0) => {
      if (!base) return;
      setLoading(true);
      try {
        const res = await fetch(withAddress(`${base}?page=${p}`, address), { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) return;
        setCards((prev) => (p === 0 ? json.cards : [...prev, ...json.cards]));
        setTotal(json.total ?? 0);
        setHasMore(Boolean(json.hasMore));
        setPage(p);
      } finally {
        setLoading(false);
      }
    },
    [base, address],
  );
  useEffect(() => {
    void load(0);
  }, [load]);
  return { cards, total, hasMore, loading, reload: () => load(0), loadMore: () => load(page + 1) };
}
