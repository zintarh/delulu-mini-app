"use client";

/**
 * The "Make it public" choice is made on the success sheet, often before the
 * background confirm-create has saved the row. We keep the choice on-device,
 * keyed by the create tx, and apply it as soon as the row exists — also after
 * a refresh. The server enforces ownership; this is only delivery.
 */

const KEY = "delulu_pending_visibility_v1";
const TTL_MS = 7 * 24 * 3600 * 1000;

type PendingVisibility = { tx: string; wallet: string; isPublic: boolean; savedAt: number };

function readAll(): PendingVisibility[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) || "[]") as PendingVisibility[];
    return Array.isArray(list) ? list.filter((p) => Date.now() - p.savedAt < TTL_MS) : [];
  } catch {
    return [];
  }
}

function writeAll(list: PendingVisibility[]) {
  try {
    if (list.length) window.localStorage.setItem(KEY, JSON.stringify(list));
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage blocked — the in-memory apply below still runs this session
  }
}

export async function postVisibility(params: {
  id?: number;
  tx?: string;
  isPublic: boolean;
  category?: string | null;
  publicDescription?: string | null;
}): Promise<{ ok: true; data: VisibilityState } | { ok: false; retryable: boolean; error: string }> {
  try {
    const res = await fetch("/api/support/visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(params),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: body as VisibilityState };
    return { ok: false, retryable: body?.retryable !== false && res.status !== 400, error: body?.error ?? "Failed" };
  } catch {
    return { ok: false, retryable: true, error: "Network error" };
  }
}

export type VisibilityState = {
  onChainCommitmentId: number | null;
  isPublic: boolean;
  category: string | null;
  suggestedCategory: string;
  publicDescription: string | null;
  publicSince: string | null;
  canBePublic: boolean;
};

const inFlight = new Map<string, Promise<boolean>>();

/** Tries to apply one stored choice, with short backoff while the row is still saving. */
function applyOne(p: PendingVisibility): Promise<boolean> {
  const key = p.tx.toLowerCase();
  const existing = inFlight.get(key);
  if (existing) return existing;
  const work = (async () => {
    const delays = [0, 1_500, 3_000, 5_000, 8_000, 12_000];
    for (const d of delays) {
      if (d) await new Promise((r) => setTimeout(r, d));
      const r = await postVisibility({ tx: p.tx, isPublic: p.isPublic });
      if (r.ok || !r.retryable) {
        writeAll(readAll().filter((x) => x.tx.toLowerCase() !== key));
        return r.ok;
      }
    }
    return false; // stays stored; next app load retries
  })();
  inFlight.set(key, work);
  void work.finally(() => inFlight.delete(key));
  return work;
}

export function queueVisibilityChoice(tx: string, wallet: string, isPublic: boolean): Promise<boolean> {
  const p: PendingVisibility = { tx, wallet: wallet.toLowerCase(), isPublic, savedAt: Date.now() };
  writeAll([...readAll().filter((x) => x.tx.toLowerCase() !== tx.toLowerCase()), p]);
  return applyOne(p);
}

/** Apply any stored choices for this wallet (call after confirm-create or on app load). */
export function flushPendingVisibility(wallet: string | null | undefined): void {
  if (!wallet) return;
  for (const p of readAll()) {
    if (p.wallet === wallet.toLowerCase()) void applyOne(p);
  }
}
