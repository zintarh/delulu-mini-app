// Browser: can this player cash out G$ to naira, and what is one G$ worth in
// their bank right now? Shared by the wallet card ("≈ ₦…") and the cash-out
// sheet. Asked once per page view; every caller shares the answer.

import { RATE_QUOTE_G, isNigeria, nairaPerGFromQuote } from "@/lib/cashout/goodcash";

export interface CashOutInfo {
  /** Cash out is switched on and GoodCash answers. */
  enabled: boolean;
  /** Visitor's connection is in Nigeria, or the device runs on Lagos time. */
  inNigeria: boolean;
  /** Naira per G$ after GoodCash's fees; null if unknown. */
  nairaPerG: number | null;
}

function deviceTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; }
}

let probe: Promise<{ enabled: boolean; inNigeria: boolean }> | null = null;
let rate: Promise<number | null> | null = null;
let known: { enabled: boolean; inNigeria: boolean } | null = null;
let knownRate: number | null = null;

/** What's already known this page view, without waiting. */
export function peekCashOutInfo(): CashOutInfo | null {
  return known ? { ...known, nairaPerG: knownRate } : null;
}

/** Is cash out on, and is this visitor in Nigeria? Fast (no rate). Never rejects. */
export function getCashOutAvailability(): Promise<{ enabled: boolean; inNigeria: boolean }> {
  if (known) return Promise.resolve(known);
  probe ??= fetch("/api/cashout/setup?probe=1")
    .then((r) => r.json() as Promise<{ enabled?: boolean; country?: string | null }>)
    .then((d) => (known = { enabled: !!d.enabled, inNigeria: isNigeria(d.country, deviceTimeZone()) }))
    .catch(() => { probe = null; return { enabled: false, inNigeria: isNigeria(null, deviceTimeZone()) }; });
  return probe;
}

/** Everything, including the live naira rate (one extra request, cached). Never rejects. */
export async function getCashOutInfo(): Promise<CashOutInfo> {
  const a = await getCashOutAvailability();
  if (!a.enabled) return { ...a, nairaPerG: null };
  rate ??= fetch(`/api/cashout/quote?amountG=${RATE_QUOTE_G}`)
    .then((r) => r.json())
    .then((q) => (knownRate = nairaPerGFromQuote(q)))
    .catch(() => { rate = null; return null; });
  return { ...a, nairaPerG: await rate };
}
