"use client";

import type { SupportIntentDto } from "@/lib/support/service";

/**
 * Broadcast-but-not-reported support txs. If the tab closes between the wallet
 * returning a hash and the server recording it, the next app load reports it.
 * (The server's reconciler can also find the transfer on-chain without this.)
 */
const KEY = "delulu_pending_support_v1";
const TTL_MS = 3 * 24 * 3600 * 1000;

type Pending = { supportId: string; txHash: string; wallet: string; savedAt: number };

function readAll(): Pending[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Pending[];
    return Array.isArray(list) ? list.filter((p) => Date.now() - p.savedAt < TTL_MS) : [];
  } catch {
    return [];
  }
}

function writeAll(list: Pending[]) {
  try {
    if (list.length) window.localStorage.setItem(KEY, JSON.stringify(list));
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage blocked
  }
}

export function rememberSupportTx(supportId: string, txHash: string, wallet: string) {
  writeAll([
    ...readAll().filter((p) => p.supportId !== supportId),
    { supportId, txHash, wallet: wallet.toLowerCase(), savedAt: Date.now() },
  ]);
}

export function forgetSupportTx(supportId: string) {
  writeAll(readAll().filter((p) => p.supportId !== supportId));
}

type Result = { ok: true; data: SupportIntentDto } | { ok: false; retryable: boolean; error: string };

async function call(url: string, init?: RequestInit): Promise<Result> {
  try {
    const res = await fetch(url, { credentials: "same-origin", ...init });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: body as SupportIntentDto };
    return { ok: false, retryable: body?.retryable === true || res.status >= 500, error: body?.error ?? "Failed" };
  } catch {
    return { ok: false, retryable: true, error: "Network error" };
  }
}

export function createIntent(body: { deluluId: number; amount: string; clientRequestId: string }) {
  return call("/api/support/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function reportTx(supportId: string, txHash: string) {
  return call(`/api/support/send/${supportId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  });
}

export function pollSupport(supportId: string) {
  return call(`/api/support/send/${supportId}`);
}

/** Report any stored hashes for this wallet (call on app load). */
export function flushPendingSupport(wallet: string | null | undefined) {
  if (!wallet) return;
  for (const p of readAll()) {
    if (p.wallet !== wallet.toLowerCase()) continue;
    void reportTx(p.supportId, p.txHash).then((r) => {
      // Once the server has the hash, its reconciler finishes the job.
      if (r.ok || !r.retryable) forgetSupportTx(p.supportId);
    });
  }
}
