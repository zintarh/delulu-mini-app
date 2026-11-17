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
 * Live Bingos — one shared, cached fetch for Home, Explore and the success
 * card (no waterfall per screen); refreshes in the background.
 */
export function useBingoList() {
  const { address } = useAuth();
  const q = useQuery({
    queryKey: listKey(address),
    queryFn: () => getJson<{ bingos: BingoView[] }>(withAddress("/api/bingo", address)).then((j) => j.bingos),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
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
