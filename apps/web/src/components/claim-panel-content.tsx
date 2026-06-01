"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Gift, Loader2, X } from "lucide-react";
import { formatUnits } from "viem";
import { cn, formatGAmount } from "@/lib/utils";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useClaimPanel } from "@/contexts/right-panel-context";
import { WHITELIST_CLAIM_MESSAGES } from "@/lib/gooddollar-whitelist";

const IdentityFlow = dynamic(() => import("@/app/(main)/daily-claim/IdentityFlow"), {
  ssr: false,
});

interface ClaimPanelContentProps {
  onClose: () => void;
}

export function ClaimPanelContent({ onClose }: ClaimPanelContentProps) {
  const { address, authenticated, isReady } = useAuth();
  const router = useRouter();
  const { whitelistIntent, clearWhitelistIntent } = useClaimPanel();
  const {
    isLoading: isClaimDataLoading,
    isClaiming,
    isWhitelisted,
    entitlement,
    hasClaimed,
    nextClaimTime,
    claim,
    isInitialized,
  } = useGoodDollarClaim();

  const [showIdentityFlow, setShowIdentityFlow] = useState(false);

  const { formatted: gDollarBalance, isLoading: isGdLoading } = useTokenBalance(
    GOODDOLLAR_ADDRESSES.mainnet
  );

  const formattedEntitlement = useMemo(() => {
    if (entitlement === null) return null;
    return formatUnits(entitlement, 18);
  }, [entitlement]);

  const entitlementDisplay = useMemo(() => {
    if (formattedEntitlement === null) return "—";
    const n = parseFloat(formattedEntitlement);
    return Number.isFinite(n) ? n.toFixed(2) : "—";
  }, [formattedEntitlement]);

  const handleClaim = async () => {
    if (!authenticated) {
      router.push("/sign-in");
      return;
    }
    if (!address) return;
    if (!isWhitelisted) {
      setShowIdentityFlow(true);
      return;
    }
    await claim();
  };

  const canClaim =
    authenticated &&
    address &&
    !hasClaimed &&
    !isClaimDataLoading &&
    isInitialized &&
    entitlement !== null &&
    entitlement > 0n;

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-6 pb-3 shrink-0">
        <h2
          className="text-[26px] font-bold text-foreground tracking-tight"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Claim G$
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-10 h-10 rounded-full text-foreground hover:bg-secondary transition-colors"
          aria-label="Close claim"
        >
          <X className="w-6 h-6" strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-8">
        {whitelistIntent ? (
          <div
            className="mb-4 rounded-xl border border-delulu-yellow-reserved/40 bg-delulu-yellow-reserved/15 px-4 py-3"
            role="status"
          >
            <p className="text-sm font-bold text-foreground">
              {WHITELIST_CLAIM_MESSAGES[whitelistIntent].title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {WHITELIST_CLAIM_MESSAGES[whitelistIntent].body}
            </p>
            <button
              type="button"
              onClick={clearWhitelistIntent}
              className="mt-2 text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="relative rounded-2xl overflow-hidden border border-border/80 bg-gradient-to-b from-delulu-yellow-reserved/25 via-background to-background px-5 py-8 text-center mb-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(246,195,36,0.35),transparent_55%)] pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 border border-border/60 shadow-sm">
              <img
                src="/gooddollar-logo.png"
                alt="GoodDollar"
                className="h-9 w-9 object-contain"
              />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Today&apos;s UBI
            </p>
            {isClaimDataLoading || !isReady || !isInitialized ? (
              <div className="h-12 w-32 mx-auto bg-secondary rounded-lg animate-pulse" />
            ) : (
              <p className="text-5xl font-black text-foreground tracking-tight tabular-nums">
                {entitlementDisplay}
                <span className="text-2xl font-bold text-muted-foreground ml-1">G$</span>
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
              Free daily income on Celo. Claim once every 24 hours.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-border/70 mb-6">
          <span className="text-sm text-muted-foreground">Your balance</span>
          <span className="text-sm font-bold text-foreground tabular-nums">
            {isGdLoading
              ? "…"
              : gDollarBalance && Number(gDollarBalance) > 0
                ? `${formatGAmount(Number(gDollarBalance))} G$`
                : "0 G$"}
          </span>
        </div>

        {!authenticated ? (
          <button
            type="button"
            onClick={() => router.push("/sign-in")}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Sign in to claim
          </button>
        ) : isClaimDataLoading || !isInitialized ? (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking eligibility…
          </div>
        ) : hasClaimed ? (
          <div className="rounded-xl bg-secondary px-4 py-4 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">
              {nextClaimTime ? (() => {
                const now = new Date();
                const timeStr = nextClaimTime.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                const isToday = nextClaimTime.toDateString() === now.toDateString();
                const isTomorrow = nextClaimTime.toDateString() === new Date(now.getTime() + 86_400_000).toDateString();
                if (isToday) return `Come back at ${timeStr} today`;
                if (isTomorrow) return `Come back at ${timeStr} tomorrow`;
                return `Come back at ${timeStr}`;
              })() : "Already claimed"}
            </p>
            {nextClaimTime && (
              <p className="text-xs text-muted-foreground">
                Next claim {nextClaimTime.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClaim}
            disabled={isClaiming || !canClaim}
            className={cn(
              "w-full py-4 rounded-xl text-sm font-bold transition-all",
              "bg-delulu-yellow-reserved text-primary",
              "hover:brightness-95 active:scale-[0.99]",
              "disabled:opacity-45 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2"
            )}
          >
            {isClaiming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Claiming…
              </>
            ) : (
              <>
                <Gift className="w-4 h-4" strokeWidth={2} />
                {entitlement !== null && entitlement > 0n
                  ? `Claim ${entitlementDisplay} G$`
                  : "Claim G$"}
              </>
            )}
          </button>
        )}
      </div>

      <IdentityFlow
        open={showIdentityFlow}
        onOpenChange={setShowIdentityFlow}
        onVerified={() => {
          setShowIdentityFlow(false);
          void claim();
        }}
      />
    </>
  );
}
