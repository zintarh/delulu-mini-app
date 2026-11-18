import { nextReferralRound, referralOpensLabel } from "@/lib/referral/campaign";
import type { SlotsView } from "@/lib/referral/slots";

/**
 * "12 of 30 spots left · more every Tuesday" · "All spots taken — 30 new spots Tue 24 Nov".
 * Spots refresh (and grow) every week; never says payouts stop.
 */
export function slotsLine(v: SlotsView | undefined | null): string | null {
  if (!v?.live || (v.slots <= 0 && v.used <= 0)) return null;
  const next = nextReferralRound();
  if (v.left > 0) return `${v.left.toLocaleString("en-US")} of ${v.slots.toLocaleString("en-US")} spots left${next ? " · more every Tuesday" : ""}`;
  if (!next) return "All spots taken this round";
  return `All spots taken — ${v.nextSlots ? `${v.nextSlots.toLocaleString("en-US")} new spots` : "new spots"} ${referralOpensLabel(next)}`;
}
