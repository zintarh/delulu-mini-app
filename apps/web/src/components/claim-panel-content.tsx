"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { SIGN_IN_BUTTON_LABEL } from "@/lib/auth-redirect";
import dynamic from "next/dynamic";
import { Gift, Loader2, ShieldCheck, X } from "lucide-react";
import { formatUnits } from "viem";
import { formatGAmount } from "@/lib/utils";
import { CheckDot, CoinStack, GameCard, MonoLabel, gameButtonClass } from "@/components/ds";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useClaimPanel } from "@/contexts/right-panel-context";
import { WHITELIST_CLAIM_MESSAGES } from "@/lib/gooddollar-whitelist";
import { useOnboardingGiftRecheck } from "@/contexts/onboarding-gift-context";

const IdentityFlow = dynamic(() => import("@/app/(main)/daily-claim/IdentityFlow"), {
  ssr: false,
});

const primaryButtonClass = gameButtonClass({ variant: "green", size: "lg", full: true });
const verifyButtonClass = gameButtonClass({ variant: "blue", size: "lg", full: true });

interface ClaimPanelContentProps {
  onClose: () => void;
  /** Hide the close button — used when this is a mandatory onboarding step with nowhere to close back to. */
  showCloseButton?: boolean;
  /** Fired once GoodDollar identity verification is confirmed, regardless of claim outcome. */
  onWhitelisted?: () => void;
  /**
   * Renders identity verification as a plain inline block in place of the
   * button, instead of a fixed-overlay modal on top of this content — used
   * on the sign-in page, which is already a full standalone screen and
   * shouldn't pop another layer on top of itself.
   */
  inlineIdentityFlow?: boolean;
}

export function ClaimPanelContent({
  onClose,
  showCloseButton = true,
  onWhitelisted,
  inlineIdentityFlow = false,
}: ClaimPanelContentProps) {
  const { address, isReady } = useAuth();
  const { redirectToSignIn, authenticated } = useRedirectToSignIn();
  const { whitelistIntent, clearWhitelistIntent } = useClaimPanel();
  const { requestRecheck } = useOnboardingGiftRecheck();
  const {
    isLoading: isClaimDataLoading,
    isClaiming,
    isWhitelisted,
    entitlement,
    hasClaimed,
    nextClaimTime,
    claim,
    refreshStatus,
    startVerifying,
    stopVerifying,
    isInitialized,
  } = useGoodDollarClaim();

  const [showIdentityFlow, setShowIdentityFlow] = useState(false);
  const autoOpenedForIntentRef = useRef<string | null>(null);

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

  const needsWhitelist =
    authenticated &&
    isInitialized &&
    !isWhitelisted &&
    !isClaimDataLoading;

  const canClaimUbi =
    authenticated &&
    isInitialized &&
    isWhitelisted &&
    !hasClaimed &&
    entitlement !== null &&
    entitlement > 0n;

  const openIdentityFlow = useCallback(() => {
    startVerifying();
    setShowIdentityFlow(true);
  }, [startVerifying]);

  const closeIdentityFlow = useCallback(
    (open: boolean) => {
      setShowIdentityFlow(open);
      if (!open) stopVerifying();
    },
    [stopVerifying],
  );

  const verifyButtonLabel = whitelistIntent
    ? whitelistIntent === "tip"
      ? "Verify to tip"
      : "Verify to create"
    : "Verify & claim";

  useEffect(() => {
    if (!isInitialized || !whitelistIntent || isWhitelisted) return;
    const key = `${whitelistIntent}-${address ?? ""}`;
    if (autoOpenedForIntentRef.current === key) return;
    autoOpenedForIntentRef.current = key;
    openIdentityFlow();
  }, [isInitialized, whitelistIntent, isWhitelisted, address, openIdentityFlow]);

  const handleClaimUbi = async () => {
    if (!authenticated) {
      redirectToSignIn();
      return;
    }
    if (!address || !canClaimUbi) return;
    await claim();
  };

  const handleVerified = async () => {
    setShowIdentityFlow(false);
    stopVerifying();

    const status = await refreshStatus();
    if (status.isWhitelisted) onWhitelisted?.();
    // The daily G$ claim itself now happens together with the onboarding
    // gift in OnboardingGiftModal (one combined claim moment), not silently
    // here — this just refreshes status so the panel shows the right state.

    // Verification may be the condition that newly completes onboarding
    // (profile-setup-before-verify is the common order for new users via
    // sign-in, but an existing user can also hit this from the claim panel
    // mid-session) — awaited so requestRecheck() below reflects the actual
    // outcome instead of firing before the grant lands.
    if (status.isWhitelisted && address) {
      try {
        await fetch("/api/onboarding/gift/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
      } catch {
        // Non-critical — OnboardingGiftModal's own self-heal re-check covers this too.
      }
      // Nudges OnboardingGiftModal to re-check right now instead of waiting
      // for its next fresh mount — matters for an existing user verifying
      // mid-session, since the modal already ran its one-time check earlier.
      requestRecheck();
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-6 pb-3 shrink-0">
        <h2 className="m-0 text-2xl font-bold tracking-[-0.02em]">Free daily money</h2>
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            className="press-edge flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white shadow-edge-sm"
            aria-label="Close claim"
          >
            <X className="h-5 w-5" strokeWidth={2.4} />
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-8">
        {whitelistIntent ? (
          <div
            className="mb-4 rounded-[20px] border-2 border-yellow-line bg-yellow-soft px-4 py-3"
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

        <GameCard
          tone={needsWhitelist ? "blue" : "green"}
          className="mb-4 flex flex-col items-center px-5 pb-6 pt-5 text-center"
        >
          <CoinStack locked={needsWhitelist} className="scale-125" />
          <MonoLabel className="mt-3">Today&apos;s amount</MonoLabel>
          {isClaimDataLoading || !isReady || !isInitialized ? (
            <div className="mx-auto mt-2 h-10 w-32 animate-pulse rounded-lg bg-line" />
          ) : needsWhitelist ? (
            <p className="mx-auto mt-2 max-w-[260px] text-lg font-extrabold leading-snug">
              One quick face check unlocks it
            </p>
          ) : (
            <p className="mt-1 font-display text-[52px] font-black leading-none tabular-nums">
              {entitlementDisplay}
              <span className="ml-1 text-2xl">G$</span>
            </p>
          )}
          <p className="mx-auto mt-3 max-w-[260px] text-sm leading-relaxed text-muted-foreground">
            Free money from GoodDollar. Claim once every 24 hours.
          </p>
        </GameCard>

        <div className="mb-6 flex items-center justify-between rounded-[20px] border-2 border-line bg-white px-4 py-3">
          <span className="text-sm font-semibold text-muted-foreground">Your balance</span>
          <span className="text-sm font-extrabold tabular-nums">
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
            onClick={() => redirectToSignIn()}
            className={gameButtonClass({ variant: "ink", size: "lg", full: true })}
          >
            {SIGN_IN_BUTTON_LABEL}
          </button>
        ) : isClaimDataLoading || !isInitialized ? (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking eligibility…
          </div>
        ) : needsWhitelist ? (
          inlineIdentityFlow && showIdentityFlow ? (
            <IdentityFlow
              open={showIdentityFlow}
              onOpenChange={closeIdentityFlow}
              onVerified={() => {
                void handleVerified();
              }}
              inline
            />
          ) : (
            <button
              type="button"
              onClick={openIdentityFlow}
              className={verifyButtonClass}
            >
              <ShieldCheck className="w-4 h-4" strokeWidth={2} />
              {verifyButtonLabel}
            </button>
          )
        ) : hasClaimed ? (
          <div className="flex flex-col items-center rounded-[20px] border-2 border-line bg-white px-4 py-4 text-center">
            <CheckDot size={32} className="mb-2" />
            <p className="mb-1 text-sm font-extrabold">
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
        ) : canClaimUbi ? (
          <button
            type="button"
            onClick={handleClaimUbi}
            disabled={isClaiming}
            className={primaryButtonClass}
          >
            {isClaiming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Claiming…
              </>
            ) : (
              <>
                <Gift className="w-4 h-4" strokeWidth={2} />
                {`Claim ${entitlementDisplay} G$`}
              </>
            )}
          </button>
        ) : (
          <div className="rounded-[20px] border-2 border-line bg-white px-4 py-4 text-center">
            <p className="text-sm font-extrabold">
              You&apos;re verified
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              No free money is available right now. Check back later.
            </p>
          </div>
        )}
      </div>

      {!inlineIdentityFlow ? (
        <IdentityFlow
          open={showIdentityFlow}
          onOpenChange={closeIdentityFlow}
          onVerified={() => {
            void handleVerified();
          }}
        />
      ) : null}
    </>
  );
}
