/**
 * Client-side IPFS content resolver with in-memory caching.
 *
 * Each delulu's `contentHash` points to a Pinata-hosted JSON blob containing:
 *   { text, username?, pfpUrl?, createdAt?, gatekeeper?, bgImageUrl? }
 *
 * Since IPFS content is immutable, we cache resolved metadata forever
 * (within the browser session) to avoid redundant network calls.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface DeluluIPFSMetadata {
  text: string;
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

const metadataCache = new Map<string, DeluluIPFSMetadata | null>();
const pendingRequests = new Map<string, Promise<DeluluIPFSMetadata | null>>();

// ─── Gateways (fallback order) ──────────────────────────────────

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

// ─── Core Resolver ──────────────────────────────────────────────

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

      if (!data || typeof data.text !== "string" || data.text.trim() === "") {
        return null;
      }

      return data as DeluluIPFSMetadata;
    } catch {
      // Try next gateway
      continue;
    }
  }

  return null;
}

/**
 * Resolve a single contentHash → metadata.
 * Returns from cache if available, deduplicates in-flight requests.
 */
export async function resolveIPFSContent(
  contentHash: string
): Promise<DeluluIPFSMetadata | null> {
  if (!contentHash) return null;

  // Return from cache
  if (metadataCache.has(contentHash)) {
    return metadataCache.get(contentHash) ?? null;
  }

  // Deduplicate concurrent requests for the same hash
  if (pendingRequests.has(contentHash)) {
    return pendingRequests.get(contentHash)!;
  }

  const promise = fetchFromGateways(contentHash).then((result) => {
    metadataCache.set(contentHash, result);
    pendingRequests.delete(contentHash);
    return result;
  });

  pendingRequests.set(contentHash, promise);
  return promise;
}

/**
 * Batch-resolve an array of contentHashes in parallel.
 * Returns a Map of contentHash → metadata.
 */
export async function batchResolveIPFS(
  contentHashes: string[]
): Promise<Map<string, DeluluIPFSMetadata | null>> {
  // Filter to only unresolved hashes
  const uniqueHashes = [...new Set(contentHashes)].filter(
    (h) => h && !metadataCache.has(h)
  );

  // Resolve all in parallel (max 6 concurrent to avoid flooding)
  const CONCURRENCY = 6;
  for (let i = 0; i < uniqueHashes.length; i += CONCURRENCY) {
    const batch = uniqueHashes.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(resolveIPFSContent));
  }

  // Build result map from cache
  const results = new Map<string, DeluluIPFSMetadata | null>();
  for (const hash of contentHashes) {
    results.set(hash, metadataCache.get(hash) ?? null);
  }
  return results;
}

/**
 * Check if a contentHash has already been resolved and cached.
 */
export function isContentCached(contentHash: string): boolean {
  return metadataCache.has(contentHash);
}

/**
 * Get cached metadata synchronously (returns undefined if not cached).
 */
export function getCachedContent(
  contentHash: string
): DeluluIPFSMetadata | null | undefined {
  return metadataCache.get(contentHash);
}
