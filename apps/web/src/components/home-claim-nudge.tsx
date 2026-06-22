"use client";

import { Gift, Loader2, ShieldCheck } from "lucide-react";
import { useClaimAvailability } from "@/hooks/use-claim-availability";

export function HomeClaimNudge() {
  const { availability, entitlementDisplay, claimFromHome, isClaiming } =
    useClaimAvailability();

  if (availability !== "claimable" && availability !== "verify") {
    return null;
  }

  const isVerify = availability === "verify";

  return (
    <button
      type="button"
      onClick={() => void claimFromHome()}
      disabled={isClaiming}
      className="w-full rounded-2xl border border-[#f6c324]/40 bg-gradient-to-r from-[#fffbeb] to-[#fffbeb]/50 px-3.5 py-3 text-left transition-colors hover:from-[#fff8dc] hover:to-[#fff8dc]/60 disabled:opacity-70"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f6c324]/40 text-[#1a1a19]">
          {isVerify ? (
            <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
          ) : (
            <Gift className="h-4 w-4" strokeWidth={2.25} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a7b0a]"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {isVerify ? "GoodDollar" : "Daily UBI"}
          </p>
          <p
            className="mt-0.5 text-[13px] font-semibold leading-snug text-[#1a1a19]/90"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {isVerify
              ? "Verify your identity to claim G$"
              : entitlementDisplay
                ? `Claim ${entitlementDisplay} G$ today`
                : "Your daily G$ is ready to claim"}
          </p>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#f6c324] px-3 py-1.5 text-[11px] font-bold text-[#1a1a19]"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          {isClaiming ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Claiming…
            </>
          ) : (
            <>{isVerify ? "Verify" : "Claim"}</>
          )}
        </span>
      </div>
    </button>
  );
}
