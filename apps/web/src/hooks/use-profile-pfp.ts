"use client";

import { useEffect, useReducer } from "react";

// ─── Module-level singleton ───────────────────────────────────────────────────
// Persists across all component instances and re-renders.

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

type CacheEntry = { value: string | null; ts: number };
const cache = new Map<string, CacheEntry>();
const subscribers = new Set<() => void>();

// Addresses queued for the next batch fetch
const pending = new Set<string>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  subscribers.forEach((cb) => cb());
}

async function flushBatch() {
  batchTimer = null;
  if (pending.size === 0) return;

  const batch = Array.from(pending);
  pending.clear();

  // Only fetch addresses not already fresh in cache
  const now = Date.now();
  const toFetch = batch.filter((a) => {
    const entry = cache.get(a);
    return !entry || now - entry.ts >= CACHE_TTL_MS;
  });
  if (toFetch.length === 0) {
    notify();
    return;
  }

  try {
    const url = `/api/profile?addresses=${encodeURIComponent(toFetch.join(","))}`;
    const res = await fetch(url);

    if (res.ok) {
      const data = await res.json();
      const profiles: Record<string, string | null> = data?.profiles ?? {};
      const cachedAt = Date.now();
      for (const addr of toFetch) {
        const val = profiles[addr] ?? null;
        cache.set(addr, { value: val, ts: cachedAt });
      }
    } else {
      const cachedAt = Date.now();
      for (const addr of toFetch) cache.set(addr, { value: null, ts: cachedAt });
    }
  } catch {
    const cachedAt = Date.now();
    for (const addr of toFetch) cache.set(addr, { value: null, ts: cachedAt });
  }

  notify();
}

function schedule(address: string) {
  const normalized = address.toLowerCase();
  const entry = cache.get(normalized);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return; // still fresh
  pending.add(normalized);
  if (batchTimer === null) {
    // 30ms window to collect addresses from all components mounting in the same tick
    batchTimer = setTimeout(flushBatch, 30);
  }
}

function getPfp(address: string): string | null | undefined {
  const entry = cache.get(address.toLowerCase());
  if (!entry) return undefined;
  return entry.value;
}

/** Force-refreshes a single address in the cache (call after pfp upload) */
export function invalidatePfpCache(address: string) {
  const normalized = address.toLowerCase();
  cache.delete(normalized);
  schedule(normalized);
  notify();
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Returns the pfp URL for a single address.
 * Returns `undefined` while loading (so callers can show a skeleton),
 * `null` if the user has no pfp, or the URL string if they do.
 */
export function usePfp(address?: string | null): string | null | undefined {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!address) return;
    schedule(address.toLowerCase());
    subscribers.add(forceUpdate);
    return () => {
      subscribers.delete(forceUpdate);
    };
  }, [address]);

  if (!address) return null;
  return getPfp(address);
}

/**
 * Returns a map of address → pfp URL for a list of addresses.
 * Values are `undefined` while loading, `null` for no pfp, or the URL string.
 */
export function usePfps(addresses: string[]): Record<string, string | null | undefined> {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  // Stable key so the effect doesn't re-run on every render with a new array ref
  const key = addresses
    .map((a) => a.toLowerCase())
    .sort()
    .join(",");

  useEffect(() => {
    if (!key) return;
    key.split(",").forEach((a) => a && schedule(a));
    subscribers.add(forceUpdate);
    return () => {
      subscribers.delete(forceUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return Object.fromEntries(addresses.map((a) => [a.toLowerCase(), getPfp(a)]));
}
