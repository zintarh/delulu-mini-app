import { nextReferralRound, referralOpensLabel } from "@/lib/referral/campaign";
import type { SlotsView } from "@/lib/referral/slots";

/** "12 of 50 spots left" · "All spots taken — new spots open 2 Dec" (never says payments stop). */
export function slotsLine(v: SlotsView | undefined | null): string | null {
  if (!v?.live || v.slots <= 0 && v.used <= 0) return null;
  if (v.left > 0) return `${v.left.toLocaleString("en-US")} of ${v.slots.toLocaleString("en-US")} spots left`;
  const next = nextReferralRound();
  return next ? `All spots taken — new spots open ${referralOpensLabel(next)}` : "All spots taken this round";
}
