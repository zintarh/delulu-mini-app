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
  countryCode: string | null;
  countryLabel: string | null;
  tokenAddress: string;
};

type SubgraphRow = {
  id: string;
  onChainId: string;
  token: string;
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

    // Index: title + username + creator + country label
    const text = [
      doc.content,
      doc.username ?? "",
      doc.creator,
      doc.countryLabel ?? "",
      doc.countryCode ?? "",
    ].join(" ");
    for (const token of tokenize(text)) {
      let set = this.index.get(token);
      if (!set) { set = new Set(); this.index.set(token, set); }
      set.add(doc.id);
    }
    this.indexedCount++;
  }

  getTrending(limit = 8): Doc[] {
    return [...this.docs.values()]
      .sort((a, b) => b.totalSupportCollected - a.totalSupportCollected)
      .slice(0, limit);
  }

  getCountries(): { code: string; label: string; count: number }[] {
    const map = new Map<string, { label: string; count: number }>();
    for (const doc of this.docs.values()) {
      if (!doc.countryCode) continue;
      const existing = map.get(doc.countryCode);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(doc.countryCode, {
          label: doc.countryLabel ?? doc.countryCode,
          count: 1,
        });
      }
    }
    return [...map.entries()]
      .map(([code, { label, count }]) => ({ code, label, count }))
      .sort((a, b) => b.count - a.count);
  }

  search(query: string, countryCode?: string | null): Doc[] {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const terms = q
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ""))
      .filter((t) => t.length >= 2);

    if (terms.length === 0) return [];

    const country = countryCode?.trim().toUpperCase() ?? null;

    // Score each doc by how many terms match (OR union, ranked by coverage)
    const scores = new Map<string, number>();
    for (const term of terms) {
      const matches = this.index.get(term);
      if (!matches) continue;
      for (const id of matches) {
        scores.set(id, (scores.get(id) ?? 0) + 1);
      }
    }

    if (scores.size === 0) return [];

    return [...scores.entries()]
      .map(([id, score]) => ({ doc: this.docs.get(id)!, score }))
      .filter(({ doc }) => doc && (!country || doc.countryCode === country))
      .sort((a, b) => {
        // Full matches first, then by support collected
        if (b.score !== a.score) return b.score - a.score;
        return b.doc.totalSupportCollected - a.doc.totalSupportCollected;
      })
      .slice(0, MAX_RESULTS)
      .map(({ doc }) => doc);
  }

  filterByCountry(countryCode: string, limit = MAX_RESULTS): Doc[] {
    const code = countryCode.trim().toUpperCase();
    return [...this.docs.values()]
      .filter((doc) => doc.countryCode === code)
      .sort((a, b) => b.totalSupportCollected - a.totalSupportCollected)
      .slice(0, limit);
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

type IPFSMeta = {
  text: string;
  username?: string;
  pfpUrl?: string;
  bgImageUrl?: string;
  gatekeeper?: {
    enabled?: boolean;
    type?: string;
    value?: string;
    label?: string;
  };
};

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

function parseContentMeta(data: Record<string, unknown>): IPFSMeta | null {
  const text: string =
    (typeof data.text === "string" ? data.text : "") ||
    (typeof data.content === "string" ? data.content : "");
  if (!text.trim()) return null;
  return {
    text,
    username: typeof data.username === "string" ? data.username : undefined,
    pfpUrl: typeof data.pfpUrl === "string" ? data.pfpUrl : undefined,
    bgImageUrl: typeof data.bgImageUrl === "string" ? data.bgImageUrl : undefined,
    gatekeeper:
      data.gatekeeper && typeof data.gatekeeper === "object"
        ? (data.gatekeeper as IPFSMeta["gatekeeper"])
        : undefined,
  };
}

async function resolveContent(contentHash: string): Promise<IPFSMeta | null> {
  // Supabase / direct URL — fetch straight from the source
  if (contentHash.startsWith("https://") || contentHash.startsWith("http://")) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), IPFS_TIMEOUT_MS);
      const res = await fetch(contentHash, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return null;
      const data = await res.json();
      return parseContentMeta(data as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  // IPFS hash — try gateways in order
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), IPFS_TIMEOUT_MS);
      const res = await fetch(`${gateway}${contentHash}`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) continue;
      const data = await res.json();
      const meta = parseContentMeta(data as Record<string, unknown>);
      if (meta) return meta;
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
              id onChainId token creatorAddress contentHash
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
            meta = await resolveContent(row.contentHash);
            ipfsCache.set(row.contentHash, meta);
          }

          if (!meta?.text) return;

          // On-chain username takes priority over IPFS username
          const onChainUsername = row.creator?.username ?? null;
          const resolvedUsername = onChainUsername || meta.username || null;

          const gk = meta.gatekeeper;
          const countryCode =
            gk?.enabled && gk.type === "country" && gk.value
              ? gk.value.toUpperCase()
              : null;
          const countryLabel =
            gk?.enabled && gk.label ? gk.label : null;

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
            countryCode,
            countryLabel,
            tokenAddress: row.token ?? "",
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
  const bootstrap = req.nextUrl.searchParams.get("bootstrap") === "1";
  const country = req.nextUrl.searchParams.get("country");

  // Kick off background index build (non-blocking — don't await)
  buildIndex().catch(() => {});

  const meta = {
    isBuilding: searchIndex.isBuilding,
    indexedCount: searchIndex.indexedCount,
    totalCount: searchIndex.totalCount,
  };

  if (bootstrap) {
    return NextResponse.json({
      ...meta,
      trending: searchIndex.getTrending(8),
      countries: searchIndex.getCountries(),
    });
  }

  if (country && !q) {
    return NextResponse.json({
      ...meta,
      results: searchIndex.filterByCountry(country),
    });
  }

  if (q.length < 2) {
    return NextResponse.json({
      results: [],
      ...meta,
    });
  }

  const results = searchIndex.search(q, country);

  return NextResponse.json({
    results,
    ...meta,
  });
}
