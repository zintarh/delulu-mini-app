"use client";

/**
 * Sends a failed wallet action to the server log (Vercel), so a player stuck
 * on a screen leaves a trace we can read. Best-effort and quiet: no PII
 * beyond what the signed session already says, each message once per page
 * load, and cancellations are skipped.
 */
const sent = new Set<string>();
const SKIP = /user rejected|user denied|rejected the request|cancelled/i;

export function reportClientError(where: string, error: unknown, extra?: Record<string, string | number | boolean | null | undefined>) {
  try {
    const e = error as { name?: string; shortMessage?: string; message?: string; cause?: { message?: string } };
    const message = String(e?.shortMessage ?? e?.message ?? error).slice(0, 500);
    if (SKIP.test(message)) return;
    const key = `${where}:${message}`;
    if (sent.has(key) || sent.size > 20) return;
    sent.add(key);
    void fetch("/api/client-log", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        where,
        name: e?.name ?? null,
        message,
        cause: e?.cause?.message ? String(e.cause.message).slice(0, 300) : null,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
        ...extra,
      }),
    }).catch(() => {});
  } catch {
    /* never let reporting break the flow */
  }
}
