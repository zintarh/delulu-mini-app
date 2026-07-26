"use client";

const STORAGE_KEY = "delulu_pending_forfeit_confirm_v1";

export type PendingForfeitConfirm = {
  txHash: `0x${string}`;
  plaintextInviteCode?: `0x${string}`;
  walletAddress: string;
  title: string;
  description: string;
  evidenceType: string;
  verificationMethod: string;
  remindEnabled: boolean;
  verifierUsername: string | null;
  verifierEmail: string | null;
  isCharityIntent: boolean;
  destinationFriendUsername: string | null;
  destinationFriendEmail: string | null;
  /** Display / optimistic feed — set at stake time so UI never waits on indexing. */
  stakeAmountWei: string;
  token: string;
  destinationType: number;
  destinationAddr: string | null;
  firstDeadline: number;
  /** Needed so optimistic day-card calendar matches the real schedule. */
  totalPeriods: number;
  cadence: number;
  periodSeconds: number;
  savedAt: number;
};

/** How long we keep a pending confirm so refresh/crash can still finish the save. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function readPendingForfeitConfirm(
  walletAddress?: string | null,
): PendingForfeitConfirm | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingForfeitConfirm;
    if (!parsed?.txHash?.startsWith("0x") || !parsed.walletAddress) {
      clearPendingForfeitConfirm();
      return null;
    }
    if (Date.now() - (parsed.savedAt || 0) > TTL_MS) {
      clearPendingForfeitConfirm();
      return null;
    }
    if (
      walletAddress &&
      parsed.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingForfeitConfirm(payload: PendingForfeitConfirm) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // private mode / quota — in-memory path still covers same session
  }
}

export function clearPendingForfeitConfirm() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

type ConfirmResult = { ok: true } | { ok: false; retryable: boolean; error: string };

async function postConfirmCreate(pending: PendingForfeitConfirm): Promise<ConfirmResult> {
  try {
    const res = await fetch("/api/forfeit/confirm-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txHash: pending.txHash,
        walletAddress: pending.walletAddress,
        title: pending.title,
        description: pending.description,
        evidenceType: pending.evidenceType,
        verificationMethod: pending.verificationMethod,
        isPrivate: true,
        remindEnabled: pending.remindEnabled,
        verifierUsername: pending.verifierUsername,
        verifierEmail: pending.verifierEmail,
        verifierInviteCode: pending.plaintextInviteCode ?? null,
        isCharityIntent: pending.isCharityIntent,
        destinationFriendUsername: pending.destinationFriendUsername,
        destinationFriendEmail: pending.destinationFriendEmail,
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    return {
      ok: false,
      retryable: body?.retryable !== false,
      error: body?.error || "Still finishing your forfeit…",
    };
  } catch {
    return { ok: false, retryable: true, error: "Network hiccup — finishing your forfeit…" };
  }
}

const inFlightByTx = new Map<string, Promise<boolean>>();

/**
 * Persist the DB row for an already-staked forfeit. Retries quietly for a long
 * window so the user never needs to think about "save failed".
 * Deduped per txHash — safe to call from create page + profile at once.
 */
export async function ensurePendingForfeitConfirmed(
  pending: PendingForfeitConfirm,
  options?: { maxAttempts?: number },
): Promise<boolean> {
  const key = pending.txHash.toLowerCase();
  const existing = inFlightByTx.get(key);
  if (existing) return existing;

  const maxAttempts = options?.maxAttempts ?? 24;
  const work = (async () => {
    // Backoff stays under ~2–3 minutes total for typical RPC lag.
    const delays = [
      0, 600, 1_000, 1_500, 2_000, 2_500, 3_000, 4_000, 5_000, 6_000, 8_000, 10_000,
    ];
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const delay = delays[Math.min(attempt, delays.length - 1)] ?? 10_000;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      const result = await postConfirmCreate(pending);
      if (result.ok) {
        clearPendingForfeitConfirm();
        return true;
      }
      if (!result.retryable) {
        // Non-retryable after a verified stake is extremely rare (wrong wallet).
        // Keep pending so support / retry can still help; stop looping.
        return false;
      }
    }
    return false;
  })();

  inFlightByTx.set(key, work);
  try {
    return await work;
  } finally {
    inFlightByTx.delete(key);
  }
}
