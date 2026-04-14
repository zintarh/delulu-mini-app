"use client";

import { useEffect, useReducer } from "react";

// ─── Module-level singleton ───────────────────────────────────────────────────
// Persists across all component instances and re-renders.

type CacheEntry = string | null; // null = confirmed no pfp, undefined = not fetched
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

  // Only fetch addresses not already in cache
  const toFetch = batch.filter((a) => !cache.has(a));
  if (toFetch.length === 0) {
    console.log("[pfp] all addresses already cached, skipping fetch");
    notify();
    return;
  }

  console.log("[pfp] fetching pfps for addresses:", toFetch);

  try {
    const url = `/api/profile?addresses=${encodeURIComponent(toFetch.join(","))}`;
    console.log("[pfp] GET", url);
    const res = await fetch(url);
    console.log("[pfp] response status:", res.status);

    if (res.ok) {
      const data = await res.json();
      console.log("[pfp] raw API response:", JSON.stringify(data));
      const profiles: Record<string, string | null> = data?.profiles ?? {};
      for (const addr of toFetch) {
        const val = profiles[addr] ?? null;
        cache.set(addr, val);
        console.log(`[pfp] cached ${addr} →`, val ?? "(null/no pfp)");
      }
    } else {
      const text = await res.text().catch(() => "");
      console.error("[pfp] API error", res.status, text);
      for (const addr of toFetch) cache.set(addr, null);
    }
  } catch (err) {
    console.error("[pfp] fetch threw:", err);
    for (const addr of toFetch) cache.set(addr, null);
  }

  notify();
}

function schedule(address: string) {
  const normalized = address.toLowerCase();
  if (cache.has(normalized)) return; // already cached, no need to schedule
  pending.add(normalized);
  if (batchTimer === null) {
    // 30ms window to collect addresses from all components mounting in the same tick
    batchTimer = setTimeout(flushBatch, 30);
  }
}

function getPfp(address: string): CacheEntry | undefined {
  return cache.get(address.toLowerCase());
}

/** Force-refreshes a single address in the cache (call after pfp upload) */
export function invalidatePfpCache(address: string) {
  const normalized = address.toLowerCase();
  console.log("[pfp] invalidating cache for", normalized);
  cache.delete(normalized);
  // Re-schedule so it gets picked up on next render
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
    const normalized = address.toLowerCase();
    console.log("[pfp] usePfp scheduling", normalized);
    schedule(normalized);
    subscribers.add(forceUpdate);
    return () => { subscribers.delete(forceUpdate); };
  }, [address]);

  if (!address) return null;
  const val = getPfp(address);
  console.log(`[pfp] usePfp(${address.slice(0, 8)}…) →`, val === undefined ? "undefined(loading)" : val ?? "null(no pfp)");
  return val;
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
    console.log("[pfp] usePfps scheduling", key.split(",").length, "addresses");
    key.split(",").forEach((a) => a && schedule(a));
    subscribers.add(forceUpdate);
    return () => { subscribers.delete(forceUpdate); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const result = Object.fromEntries(
    addresses.map((a) => [a.toLowerCase(), getPfp(a)]),
  );
  console.log("[pfp] usePfps result:", Object.entries(result).map(([a, v]) => `${a.slice(0,8)}…→${v === undefined ? "loading" : v ?? "null"}`).join(", "));
  return result;
}
