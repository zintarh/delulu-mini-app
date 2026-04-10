import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL_MAINNET ||
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "";

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

const IPFS_TIMEOUT_MS = 4_000;
const IPFS_CONCURRENCY = 30;
const SUBGRAPH_REFRESH_MS = 60_000; // re-fetch subgraph list every 60s
const MAX_RESULTS = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Doc = {
  id: string;
  onChainId: string;
  creator: string;
  content: string;
  username: string | null;
  pfpUrl: string | null;
  bgImageUrl: string | null;
  totalSupportCollected: number;
  totalSupporters: number;
  creatorStake: number;
  createdAt: string;
  isResolved: boolean;
};

type SubgraphRow = {
  id: string;
  onChainId: string;
  creatorAddress: string;
  contentHash: string;
  totalSupportCollected: string | null;
  totalSupporters: string | null;
  creatorStake: string | null;
  createdAt: string;
  isResolved: boolean;
  creator?: { username?: string | null };
};

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer — splits into words and indexes every prefix of each word.
// "ethereum" → ["e","et","eth","ethe","ether","ethere","ethereu","ethereum"]
// This gives instant partial-match search.
// ─────────────────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_.,!?@#/\\]+/)
    .flatMap((word) => {
      const w = word.replace(/[^a-z0-9]/g, "");
      if (w.length < 2) return [];
      // Only index prefixes of length ≥ 2 to keep memory bounded
      return Array.from({ length: w.length - 1 }, (_, i) => w.slice(0, i + 2));
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory inverted index
// ─────────────────────────────────────────────────────────────────────────────

class SearchIndex {
  /** id → full doc */
  private docs = new Map<string, Doc>();
  /** token → Set<id> */
  private index = new Map<string, Set<string>>();

  indexedCount = 0;
  totalCount = 0;
  isBuilding = false;
  builtAt = 0;

  add(doc: Doc) {
    this.docs.set(doc.id, doc);

    // Index: title + username (both IPFS and on-chain) + creator address
    const text = [doc.content, doc.username ?? "", doc.creator].join(" ");
    for (const token of tokenize(text)) {
      let set = this.index.get(token);
      if (!set) { set = new Set(); this.index.set(token, set); }
      set.add(doc.id);
    }
    this.indexedCount++;
  }

  search(query: string): Doc[] {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const terms = q
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ""))
      .filter((t) => t.length >= 2);

    if (terms.length === 0) return [];

    // Intersect candidate sets for each query term
    let candidates: Set<string> | null = null;
    for (const term of terms) {
      const matches = this.index.get(term);
      if (!matches || matches.size === 0) return [];
      if (candidates === null) {
        candidates = new Set<string>(matches);
      } else {
        const next = new Set<string>();
        for (const id of candidates) {
          if (matches.has(id)) next.add(id);
        }
        candidates = next;
      }
      if (candidates.size === 0) return [];
    }

    if (!candidates) return [];

    return [...candidates]
      .map((id) => this.docs.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.totalSupportCollected - a.totalSupportCollected)
      .slice(0, MAX_RESULTS);
  }

  clear() {
    this.docs.clear();
    this.index.clear();
    this.indexedCount = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global state (persists across requests within the same process/instance)
// ─────────────────────────────────────────────────────────────────────────────

type IPFSMeta = { text: string; username?: string; pfpUrl?: string; bgImageUrl?: string };

const g = global as any;
if (!g.__deluluSearchIndex) g.__deluluSearchIndex = new SearchIndex();
// v2: stores full IPFSMeta, not just text — reset if old format detected
if (!g.__deluluIPFSCacheV2) g.__deluluIPFSCacheV2 = new Map<string, IPFSMeta | null>();
if (!g.__deluluSubgraphRows) g.__deluluSubgraphRows = { rows: [] as SubgraphRow[], fetchedAt: 0 };

const searchIndex: SearchIndex = g.__deluluSearchIndex;
const ipfsCache: Map<string, IPFSMeta | null> = g.__deluluIPFSCacheV2;
const subgraphStore: { rows: SubgraphRow[]; fetchedAt: number } = g.__deluluSubgraphRows;

// ─────────────────────────────────────────────────────────────────────────────
// IPFS resolver
// ─────────────────────────────────────────────────────────────────────────────

async function resolveIPFS(hash: string): Promise<{
  text: string; username?: string; pfpUrl?: string; bgImageUrl?: string;
} | null> {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), IPFS_TIMEOUT_MS);
      const res = await fetch(`${gateway}${hash}`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) continue;
      const data = await res.json();
      const text: string =
        (typeof data.text === "string" ? data.text : "") ||
        (typeof data.content === "string" ? data.content : "");
      if (!text.trim()) continue;
      return {
        text,
        username: typeof data.username === "string" ? data.username : undefined,
        pfpUrl: typeof data.pfpUrl === "string" ? data.pfpUrl : undefined,
        bgImageUrl: typeof data.bgImageUrl === "string" ? data.bgImageUrl : undefined,
      };
    } catch {
      continue;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subgraph fetcher
// ─────────────────────────────────────────────────────────────────────────────

async function fetchSubgraphRows(): Promise<SubgraphRow[]> {
  if (
    subgraphStore.rows.length > 0 &&
    Date.now() - subgraphStore.fetchedAt < SUBGRAPH_REFRESH_MS
  ) {
    return subgraphStore.rows;
  }

  const all: SubgraphRow[] = [];
  let skip = 0;
  const BATCH = 1000;

  while (true) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `{
            delulus(
              first: ${BATCH}
              skip: ${skip}
              orderBy: totalSupportCollected
              orderDirection: desc
              where: { isCancelled: false }
            ) {
              id onChainId creatorAddress contentHash
              totalSupportCollected totalSupporters creatorStake
              createdAt isResolved
              creator { username }
            }
          }`,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) break;
      const json = await res.json();
      const batch: SubgraphRow[] = json?.data?.delulus ?? [];
      all.push(...batch);
      if (batch.length < BATCH) break;
      skip += BATCH;
    } catch {
      break;
    }
  }

  subgraphStore.rows = all;
  subgraphStore.fetchedAt = Date.now();
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// Background index builder
// Runs once; subsequent calls are no-ops while building or already built fresh.
// ─────────────────────────────────────────────────────────────────────────────

async function buildIndex(): Promise<void> {
  if (searchIndex.isBuilding) return;
  // Rebuild if it's been more than 60s since last build
  if (searchIndex.builtAt > 0 && Date.now() - searchIndex.builtAt < SUBGRAPH_REFRESH_MS) return;

  searchIndex.isBuilding = true;
  searchIndex.clear();

  try {
    const rows = await fetchSubgraphRows();
    searchIndex.totalCount = rows.length;

    // Process in parallel batches
    for (let i = 0; i < rows.length; i += IPFS_CONCURRENCY) {
      const batch = rows.slice(i, i + IPFS_CONCURRENCY);

      await Promise.allSettled(
        batch.map(async (row) => {
          // Use cached full meta if available — avoids re-fetching IPFS
          let meta: IPFSMeta | null = null;
          if (ipfsCache.has(row.contentHash)) {
            meta = ipfsCache.get(row.contentHash) ?? null;
          } else {
            meta = await resolveIPFS(row.contentHash);
            ipfsCache.set(row.contentHash, meta); // store full meta, not just text
          }

          if (!meta?.text) return;

          // On-chain username takes priority over IPFS username
          const onChainUsername = row.creator?.username ?? null;
          const resolvedUsername = onChainUsername || meta.username || null;

          const doc: Doc = {
            id: row.id,
            onChainId: row.onChainId,
            creator: row.creatorAddress,
            content: meta.text,
            username: resolvedUsername,
            pfpUrl: meta.pfpUrl ?? null,
            bgImageUrl: meta.bgImageUrl ?? null,
            totalSupportCollected: Number(row.totalSupportCollected ?? 0),
            totalSupporters: Number(row.totalSupporters ?? 0),
            creatorStake: Number(row.creatorStake ?? 0),
            createdAt: row.createdAt,
            isResolved: row.isResolved,
          };

          searchIndex.add(doc);
        }),
      );
    }

    searchIndex.builtAt = Date.now();
  } finally {
    searchIndex.isBuilding = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  // Kick off background index build (non-blocking — don't await)
  // On first call this starts the build; subsequent calls are no-ops.
  buildIndex().catch(() => {});

  if (q.length < 2) {
    return NextResponse.json({
      results: [],
      isBuilding: searchIndex.isBuilding,
      indexedCount: searchIndex.indexedCount,
      totalCount: searchIndex.totalCount,
    });
  }

  // Search the index — instant O(1) lookup regardless of db size
  const results = searchIndex.search(q);

  return NextResponse.json({
    results,
    isBuilding: searchIndex.isBuilding,
    indexedCount: searchIndex.indexedCount,
    totalCount: searchIndex.totalCount,
  });
}
