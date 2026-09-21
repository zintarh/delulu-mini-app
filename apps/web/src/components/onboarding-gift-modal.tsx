"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Gift, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useHasGas } from "@/hooks/use-has-gas";
import { usePendingReward, useClaimReward } from "@/hooks/use-reward-vault";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useCampaignJoinFlow } from "@/hooks/use-campaign-join-flow";
import { CampaignJoinFlowOverlay } from "@/components/community/campaign-join-flow-overlay";
import type { CampaignJoinSource } from "@/lib/community/campaign-join-info";

const GOOD_DOLLAR = GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`;
/** Set once the dedicated "welcome gift" campaign exists — see gift.ts for eligibility. */
const UPSELL_CAMPAIGN_ID = process.env.NEXT_PUBLIC_ONBOARDING_UPSELL_CAMPAIGN_ID || null;

type Step = "claim" | "upsell" | "done";

/**
 * Fully blocking at the claim step (no close button, no backdrop dismiss) —
 * shows the moment a wallet has been granted the one-time onboarding gift
 * and hasn't claimed it yet. Once claimed, offers (skippable) to put it
 * straight to work joining a specific campaign priced at the same amount,
 * so the gift doesn't just sit idle in a wallet that never comes back.
 * Mounted app-wide in the main layout.
 */
export function OnboardingGiftModal() {
  const { address, authenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [mustClaim, setMustClaim] = useState(false);
  const [amount, setAmount] = useState(1000);
  const [checked, setChecked] = useState(false);
  const [step, setStep] = useState<Step>("claim");
  const [campaignSource, setCampaignSource] = useState<CampaignJoinSource | null>(null);
  const [gasTopupPending, setGasTopupPending] = useState(false);

  const { pending, refetch: refetchPending } = usePendingReward(
    address as `0x${string}` | undefined,
    GOOD_DOLLAR,
  );
  const { claimReward, isPending, error } = useClaimReward();
  const { isLowGas } = useHasGas();
  const joinFlow = useCampaignJoinFlow();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authenticated || !address) {
      setChecked(true);
      setMustClaim(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/onboarding/gift/status?address=${address}`);
        const json = (await res.json()) as { mustClaim?: boolean; amount?: number };
        if (cancelled) return;
        setMustClaim(Boolean(json.mustClaim));
        if (json.amount) setAmount(json.amount);
      } catch {
        // Fails closed — never block the app over a status-check network error.
        if (!cancelled) setMustClaim(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, address]);

  // Preload the upsell campaign's info so it's ready the instant they claim.
  useEffect(() => {
    if (!UPSELL_CAMPAIGN_ID || !mustClaim || !address) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/community/campaigns/${UPSELL_CAMPAIGN_ID}?address=${address}`,
        );
        const json = await res.json();
        if (cancelled || !json.campaign) return;
        setCampaignSource({
          ...json.campaign,
          community: json.campaign.communities,
          milestone_count: json.milestoneCount,
        });
      } catch {
        // If this fails, the upsell step is silently skipped after claim.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mustClaim, address]);

  const handleClaim = async () => {
    if (!address) return;
    try {
      await claimReward(GOOD_DOLLAR);
      await fetch("/api/onboarding/gift/mark-claimed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      setMustClaim(false);
      await refetchPending();
      setStep(UPSELL_CAMPAIGN_ID && campaignSource ? "upsell" : "done");
    } catch {
      // Surfaced below via `error` from useClaimReward.
    }
  };

  const handleJoinCampaign = async () => {
    if (!UPSELL_CAMPAIGN_ID || !campaignSource || !address) return;
    if (isLowGas) {
      setGasTopupPending(true);
      try {
        await fetch("/api/faucet/topup", { method: "POST" });
        // Give the top-up tx a moment to land before the join tx needs the balance.
        await new Promise((resolve) => setTimeout(resolve, 4000));
      } catch {
        // If the faucet fails, the join tx below will surface its own
        // "not enough CELO for gas" error rather than silently stalling here.
      } finally {
        setGasTopupPending(false);
      }
    }
    joinFlow.openJoinModal(UPSELL_CAMPAIGN_ID, campaignSource);
  };

  if (!mounted || !checked) return null;

  if (step === "upsell" && UPSELL_CAMPAIGN_ID && campaignSource) {
    return createPortal(
      <>
        {!joinFlow.joinModalOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-sm rounded-2xl bg-background p-6 text-center shadow-xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-delulu-green/10">
                <Gift className="h-8 w-8 text-delulu-green" strokeWidth={2} />
              </div>
              <h2 className="mt-4 text-xl font-black text-foreground">Put it to work</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Use your {amount.toLocaleString()} G$ to join{" "}
                <span className="font-bold text-foreground">{campaignSource.title}</span> and
                start earning.
              </p>

              <button
                type="button"
                onClick={handleJoinCampaign}
                disabled={gasTopupPending}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-delulu-green px-4 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {gasTopupPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Gift className="h-4 w-4" strokeWidth={2} />
                )}
                {gasTopupPending ? "Getting you set up…" : `Join with my ${amount.toLocaleString()} G$`}
              </button>
              <button
                type="button"
                onClick={() => setStep("done")}
                className="mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Maybe later
              </button>
            </div>
          </div>
        ) : null}
        <CampaignJoinFlowOverlay flow={joinFlow} address={address} onJoined={() => setStep("done")} />
      </>,
      document.body,
    );
  }

  if (!mustClaim) return null;

  const rewardNotYetOnChain = pending <= 0n;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl bg-background p-6 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-delulu-green/10">
          <Gift className="h-8 w-8 text-delulu-green" strokeWidth={2} />
        </div>

        <h2 className="mt-4 text-xl font-black text-foreground">Welcome gift</h2>
        <p className="mt-4 text-4xl font-black tabular-nums text-foreground">
          {amount.toLocaleString()} <span className="text-lg font-bold text-muted-foreground">G$</span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You verified your identity — this one's on us. Claim it to fund joining your first
          campaign.
        </p>

        {error ? (
          <p className="mt-3 text-xs text-destructive">
            {error instanceof Error ? error.message : "Claim failed — try again"}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleClaim}
          disabled={isPending || rewardNotYetOnChain}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-delulu-green px-4 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Gift className="h-4 w-4" strokeWidth={2} />
          )}
          {isPending
            ? "Claiming…"
            : rewardNotYetOnChain
              ? "Preparing your gift…"
              : `Claim ${amount.toLocaleString()} G$`}
        </button>
      </div>
    </div>,
    document.body,
  );
}
