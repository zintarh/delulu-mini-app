/**
 * Supabase-first metadata cache for goal cards.
 *
 * Batch-loads title/image/description from the `delulu_metadata` table in one
 * request, then falls back to the IPFS cache for goals that have no Supabase row
 * (legacy goals whose contentHash is an IPFS CID).
 *
 * Returns DeluluIPFSMetadata objects so all existing transformers work unchanged.
 */

import type { DeluluIPFSMetadata } from "./ipfs-cache";
import { batchResolveIPFS, getCachedContent } from "./ipfs-cache";
import { normalizeDeluluImageSrc } from "@/lib/normalize-image-src";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const PERSIST_KEY = "delulu_meta_cache_v1";
const MAX_ENTRIES = 600;

type Entry = { value: DeluluIPFSMetadata | null; cachedAt: number };

const cache = new Map<string, Entry>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Entry>;
    for (const [k, v] of Object.entries(parsed)) {
      if (k && v && typeof v.cachedAt === "number") cache.set(k, v);
    }
  } catch {}
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const top = [...cache.entries()]
      .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
      .slice(0, MAX_ENTRIES);
    const payload: Record<string, Entry> = {};
    for (const [k, v] of top) payload[k] = v;
    localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
  } catch {}
}

function isStale(e: Entry) {
  return Date.now() - e.cachedAt > CACHE_TTL_MS;
}

/** Synchronous read — returns `undefined` if not yet loaded. */
export function getCachedMetadata(onChainId: string): DeluluIPFSMetadata | null | undefined {
  if (!onChainId) return undefined;
  hydrate();
  return cache.get(onChainId)?.value;
}

/** True once metadata has been attempted at least once for this goal. */
export function hasMetadataResolved(onChainId: string): boolean {
  if (!onChainId) return false;
  hydrate();
  return cache.has(onChainId);
}

export type MetadataItem = { onChainId: string; contentHash: string };

/**
 * Batch-load metadata for a list of goals.
 *
 * 1. Call `/api/goals/metadata/batch` with all onChainIds (1 request).
 * 2. Cache hits from Supabase immediately.
 * 3. For goals NOT in Supabase, fall back to batchResolveIPFS via contentHash.
 */
export async function batchLoadMetadata(items: MetadataItem[]): Promise<void> {
  hydrate();

  const toLoad = items.filter(({ onChainId }) => {
    if (!onChainId) return false;
    const e = cache.get(onChainId);
    return !e || isStale(e);
  });

  if (toLoad.length === 0) return;

  const ids = [...new Set(toLoad.map((i) => i.onChainId).filter(Boolean))];

  type SupabaseEntry = { title: string | null; bgImageUrl: string | null; description: string | null };
  let supabaseResults: Record<string, SupabaseEntry> = {};

  // Chunk into 200-id batches (API cap)
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    try {
      const chunk = ids.slice(i, i + CHUNK);
      const res = await fetch(
        `/api/goals/metadata/batch?onChainIds=${encodeURIComponent(chunk.join(","))}`,
      );
      if (res.ok) {
        const body = (await res.json()) as { metadata?: Record<string, SupabaseEntry> };
        Object.assign(supabaseResults, body.metadata ?? {});
      }
    } catch {}
  }

  const now = Date.now();
  const ipfsFallback: MetadataItem[] = [];

  for (const item of toLoad) {
    const sup = supabaseResults[item.onChainId];
    if (sup?.title) {
      cache.set(item.onChainId, {
        value: {
          text: sup.title,
          bgImageUrl: normalizeDeluluImageSrc(sup.bgImageUrl) ?? undefined,
          description: sup.description ?? undefined,
        },
        cachedAt: now,
      });
    } else {
      ipfsFallback.push(item);
    }
  }

  persist();

  if (ipfsFallback.length > 0) {
    const hashes = [...new Set(ipfsFallback.map((i) => i.contentHash).filter(Boolean))];
    await batchResolveIPFS(hashes);
    for (const { onChainId, contentHash } of ipfsFallback) {
      const ipfsMeta = getCachedContent(contentHash);
      if (ipfsMeta !== undefined) {
        cache.set(onChainId, { value: ipfsMeta ?? null, cachedAt: now });
      }
    }
    persist();
  }
}

/** Fire-and-forget wrapper for below-the-fold items. */
export function scheduleBatchLoadMetadata(
  items: MetadataItem[],
  onSettled?: () => void,
): void {
  if (items.length === 0) return;
  const run = () => {
    void batchLoadMetadata(items).finally(() => onSettled?.());
  };
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else if (typeof window !== "undefined") {
    window.setTimeout(run, 200);
  }
}
