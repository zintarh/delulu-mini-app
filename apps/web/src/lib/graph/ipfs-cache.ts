/**
 * Client-side IPFS content resolver with:
 * - L1 in-memory cache
 * - L2 localStorage persistence
 * - stale-while-revalidate reads
 *
 * Each delulu's `contentHash` points to a Pinata-hosted JSON blob containing:
 *   { text, username?, pfpUrl?, createdAt?, gatekeeper?, bgImageUrl? }
 *
 * IPFS content is immutable, but gateways can be flaky; SWR keeps UI fast
 * while allowing background refresh to heal partial/failed reads.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface DeluluIPFSMetadata {
  // Normalized primary text field used by the app.
  // When loading from IPFS, we accept both `text` and legacy `content`,
  // but always map the final value into this `text` property.
  text: string;
  // Optional legacy field for backwards compatibility with older uploads.
  content?: string;
  // Optional long-form description, written by newer uploads.
  description?: string;
  username?: string;
  pfpUrl?: string;
  createdAt?: string;
  gatekeeper?: {
    enabled: boolean;
    type?: string;
    value?: string;
    label?: string;
  };
  bgImageUrl?: string;
}

// ─── Cache ──────────────────────────────────────────────────────

type CacheEntry = {
  value: DeluluIPFSMetadata | null;
  cachedAt: number;
};

const metadataCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<DeluluIPFSMetadata | null>>();
const PERSIST_KEY = "delulu_ipfs_cache_v1";
const MAX_PERSIST_ENTRIES = 600;
const REVALIDATE_AFTER_MS = 24 * 60 * 60 * 1000; // 24h
let hasHydratedPersistentCache = false;

// ─── Gateways (fallback order) ──────────────────────────────────

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

// ─── Core Resolver ──────────────────────────────────────────────

async function fetchFromUrl(url: string): Promise<DeluluIPFSMetadata | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data) return null;
    const textSource =
      (typeof data.text === "string" ? data.text : "") ||
      (typeof data.content === "string" ? data.content : "");
    if (!textSource || textSource.trim() === "") return null;
    return { ...(data as object), text: textSource } as DeluluIPFSMetadata;
  } catch {
    return null;
  }
}

async function fetchFromGateways(
  contentHash: string
): Promise<DeluluIPFSMetadata | null> {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${gateway}${contentHash}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();

      if (!data || (typeof data.text !== "string" && typeof data.content !== "string")) {
        return null;
      }

      const textSource =
        (typeof data.text === "string" ? data.text : "") ||
        (typeof data.content === "string" ? data.content : "");

      if (!textSource || textSource.trim() === "") {
        return null;
      }

      const normalized: DeluluIPFSMetadata = {
        ...(data as object),
        text: textSource,
      };

      return normalized;
    } catch {
      // Try next gateway
      continue;
    }
  }

  return null;
}

function hydratePersistentCache(): void {
  if (hasHydratedPersistentCache || typeof window === "undefined") return;
  hasHydratedPersistentCache = true;
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    const entries = Object.entries(parsed);
    for (const [hash, entry] of entries) {
      if (!hash || !entry || typeof entry.cachedAt !== "number") continue;
      metadataCache.set(hash, {
        value: entry.value ?? null,
        cachedAt: entry.cachedAt,
      });
    }
  } catch {
    // Ignore malformed persisted cache payloads.
  }
}

function persistCacheToStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const items = Array.from(metadataCache.entries())
      .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
      .slice(0, MAX_PERSIST_ENTRIES);

    const payload: Record<string, CacheEntry> = {};
    for (const [hash, entry] of items) {
      payload[hash] = entry;
    }
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

function setCacheEntry(contentHash: string, value: DeluluIPFSMetadata | null): void {
  metadataCache.set(contentHash, {
    value,
    cachedAt: Date.now(),
  });
  persistCacheToStorage();
}

function shouldRevalidate(entry: CacheEntry | undefined): boolean {
  if (!entry) return true;
  return Date.now() - entry.cachedAt > REVALIDATE_AFTER_MS;
}

/** Retry failed reads sooner than successful cache entries. */
const NULL_RETRY_MS = 5 * 60 * 1000;

function needsResolve(contentHash: string): boolean {
  if (!contentHash) return false;
  hydratePersistentCache();
  const entry = metadataCache.get(contentHash);
  if (!entry) return true;
  if (entry.value !== null) return shouldRevalidate(entry);
  return Date.now() - entry.cachedAt > NULL_RETRY_MS;
}

function revalidateInBackground(contentHash: string): void {
  if (!contentHash || pendingRequests.has(contentHash)) return;
  const fetcher =
    contentHash.startsWith("https://") || contentHash.startsWith("http://")
      ? fetchFromUrl(contentHash)
      : fetchFromGateways(contentHash);
  const promise = fetcher
    .then((result) => {
      setCacheEntry(contentHash, result);
      return result;
    })
    .finally(() => {
      pendingRequests.delete(contentHash);
    });
  pendingRequests.set(contentHash, promise);
}

/**
 * Resolve a single contentHash → metadata.
 * Returns from cache if available, deduplicates in-flight requests.
 */
export async function resolveIPFSContent(
  contentHash: string
): Promise<DeluluIPFSMetadata | null> {
  if (!contentHash) return null;

  // Supabase / direct URL — fetch straight from the source
  if (contentHash.startsWith("https://") || contentHash.startsWith("http://")) {
    hydratePersistentCache();
    const cachedEntry = metadataCache.get(contentHash);
    if (cachedEntry) {
      if (shouldRevalidate(cachedEntry)) revalidateInBackground(contentHash);
      return cachedEntry.value ?? null;
    }
    const result = await fetchFromUrl(contentHash);
    setCacheEntry(contentHash, result);
    return result;
  }

  hydratePersistentCache();

  // Return from cache
  const cachedEntry = metadataCache.get(contentHash);
  if (cachedEntry) {
    if (shouldRevalidate(cachedEntry)) {
      revalidateInBackground(contentHash);
    }
    return cachedEntry.value ?? null;
  }

  // Deduplicate concurrent requests for the same hash
  if (pendingRequests.has(contentHash)) {
    return pendingRequests.get(contentHash)!;
  }

  const promise = fetchFromGateways(contentHash)
    .then((result) => {
      setCacheEntry(contentHash, result);
      return result;
    })
    .finally(() => {
      pendingRequests.delete(contentHash);
    });

  pendingRequests.set(contentHash, promise);
  return promise;
}

/**
 * Batch-resolve an array of contentHashes in parallel.
 * Returns a Map of contentHash → metadata.
 */
/**
 * Resolve content hashes with optional cap (for prioritizing above-the-fold feed items).
 */
export async function batchResolveIPFS(
  contentHashes: string[],
  options?: { maxHashes?: number },
): Promise<Map<string, DeluluIPFSMetadata | null>> {
  hydratePersistentCache();
  const capped =
    options?.maxHashes != null
      ? contentHashes.slice(0, options.maxHashes)
      : contentHashes;
  const uniqueHashes = [...new Set(capped)].filter(needsResolve);

  const CONCURRENCY = 6;
  for (let i = 0; i < uniqueHashes.length; i += CONCURRENCY) {
    const batch = uniqueHashes.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(resolveIPFSContent));
  }

  const results = new Map<string, DeluluIPFSMetadata | null>();
  for (const hash of contentHashes) {
    results.set(hash, metadataCache.get(hash)?.value ?? null);
  }
  return results;
}

/** Fire-and-forget IPFS resolution for hashes not needed on first paint. */
export function scheduleBatchResolveIPFS(
  contentHashes: string[],
  onSettled?: () => void,
): void {
  if (contentHashes.length === 0) return;
  const run = () => {
    void batchResolveIPFS(contentHashes).finally(() => onSettled?.());
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    window.setTimeout(run, 200);
  }
}

/**
 * Check if a contentHash has already been resolved and cached.
 */
export function isContentCached(contentHash: string): boolean {
  hydratePersistentCache();
  return metadataCache.has(contentHash);
}

/**
 * Get cached metadata synchronously (returns undefined if not cached).
 */
export function getCachedContent(
  contentHash: string
): DeluluIPFSMetadata | null | undefined {
  hydratePersistentCache();
  return metadataCache.get(contentHash)?.value;
}

/** True once content has been fetched at least once (value may still be null). */
export function hasContentResolved(contentHash: string): boolean {
  if (!contentHash) return false;
  hydratePersistentCache();
  return metadataCache.has(contentHash);
}
