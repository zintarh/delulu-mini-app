const STORAGE_KEY = "delulu-search-keywords:v1";
const MAX_ENTRIES = 50;

type KeywordEntry = { term: string; count: number; lastUsed: number };

function readStore(): KeywordEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as KeywordEntry[]) : [];
  } catch {
    return [];
  }
}

function writeStore(entries: KeywordEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // quota / private mode
  }
}

/** Record a search term (normalized lowercase). */
export function recordSearchKeyword(term: string) {
  const normalized = term.trim().toLowerCase();
  if (normalized.length < 2) return;

  const entries = readStore();
  const existing = entries.find((e) => e.term === normalized);
  if (existing) {
    existing.count += 1;
    existing.lastUsed = Date.now();
  } else {
    entries.push({ term: normalized, count: 1, lastUsed: Date.now() });
  }

  entries.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
  writeStore(entries);
}
