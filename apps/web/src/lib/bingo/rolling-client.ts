"use client";

/**
 * After a 3-day Bingo stake is on-chain: save it as the player's AI-verified
 * goal (the same confirm-create every personal goal uses — rewards, reminders,
 * deadline keeper), then open the Bingo card. Both calls are retry-safe and the
 * tx is remembered locally, so a closed tab never strands a paid stake.
 */
const KEY = (slug: string, wallet: string) => `bingo-pending:${slug}:${wallet.toLowerCase()}`;

type Pending = { txHash: string; title: string; description: string };

function remember(slug: string, wallet: string, p: Pending | null) {
  try {
    if (p) localStorage.setItem(KEY(slug, wallet), JSON.stringify(p));
    else localStorage.removeItem(KEY(slug, wallet));
  } catch {
    /* storage unavailable — the in-memory retry still runs */
  }
}

export function pendingRollingStart(slug: string, wallet: string): Pending | null {
  try {
    const raw = localStorage.getItem(KEY(slug, wallet));
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

async function postWithRetry(url: string, body: unknown, tries = 6): Promise<Record<string, unknown>> {
  let last = "Couldn't finish setting up your card.";
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return json;
    last = String(json.error ?? last);
    if (!(res.status === 503 || json.retryable)) throw new Error(last);
    await new Promise((r) => setTimeout(r, 1200 + i * 1500));
  }
  throw new Error(`${last} Your stake is safe — reopen this Bingo to finish.`);
}

export async function finishRollingStart(slug: string, wallet: string, p: Pending) {
  remember(slug, wallet, p);
  await postWithRetry("/api/forfeit/confirm-create", {
    txHash: p.txHash,
    walletAddress: wallet.toLowerCase(),
    title: p.title,
    description: p.description,
    evidenceType: "photo",
    verificationMethod: "ai",
    remindEnabled: true,
  });
  const json = await postWithRetry(`/api/bingo/${slug}/start`, { txHash: p.txHash });
  remember(slug, wallet, null);
  return json.attemptId as string;
}
