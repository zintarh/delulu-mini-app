"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatUnits } from "viem";
import { Gift, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useHasGas } from "@/hooks/use-has-gas";
import { usePendingReward, useClaimReward } from "@/hooks/use-reward-vault";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useCampaignJoinFlow } from "@/hooks/use-campaign-join-flow";
import { CampaignJoinFlowOverlay } from "@/components/community/campaign-join-flow-overlay";
import type { CampaignJoinSource } from "@/lib/community/campaign-join-info";

const GOOD_DOLLAR = GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`;

type Step = "claim" | "upsell" | "done";

/**
 * Fully blocking throughout, both steps — no close button, no backdrop
 * dismiss. Shows the moment a wallet has been granted the one-time
 * onboarding gift and hasn't claimed it yet; once claimed, blocks again
 * until they join a live campaign priced at the same amount (whichever one
 * /api/onboarding/gift/upsell-campaign finds — create as many as you like,
 * no fixed campaign is hardcoded here), so the gift can't just be claimed
 * and left idle. Mounted app-wide in the main layout.
 */
export function OnboardingGiftModal() {
  const { address, authenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [mustClaim, setMustClaim] = useState(false);
  const [amount, setAmount] = useState(1000);
  const [checked, setChecked] = useState(false);
  const [step, setStep] = useState<Step>("claim");
  const [upsellCampaignId, setUpsellCampaignId] = useState<string | null>(null);
  const [campaignSource, setCampaignSource] = useState<CampaignJoinSource | null>(null);
  const [upsellCheckDone, setUpsellCheckDone] = useState(false);
  const [gasTopupPending, setGasTopupPending] = useState(false);

  const { pending, refetch: refetchPending } = usePendingReward(
    address as `0x${string}` | undefined,
    GOOD_DOLLAR,
  );
  const { claimReward, isPending, error } = useClaimReward();
  const { isLowGas } = useHasGas();
  const joinFlow = useCampaignJoinFlow();
  const ubi = useGoodDollarClaim();

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
        const json = (await res.json()) as {
          mustClaim?: boolean;
          amount?: number;
          status?: string;
        };
        if (cancelled) return;
        if (json.mustClaim) {
          setMustClaim(true);
          if (json.amount) setAmount(json.amount);
          return;
        }

        // The cached DB status says not eligible/claimed yet. That can be
        // stale — the two places that normally grant this (post-signup,
        // post-identity-verification) each run once and never retry, so a
        // timing race (e.g. GoodDollar's whitelist tx not yet confirmed at
        // that moment) or a transient RewardVault payout failure leaves it
        // stuck at "not_eligible"/"failed" forever with nothing else to
        // catch it. Landing on the dashboard re-checks live eligibility and
        // self-heals — cheap when still ineligible, and idempotent (the
        // on-chain rewardId guard prevents any double-deposit) once it isn't.
        if (json.status !== "sent") {
          try {
            const evalRes = await fetch("/api/onboarding/gift/evaluate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address }),
            });
            const evalJson = (await evalRes.json()) as {
              mustClaim?: boolean;
              amount?: number;
            };
            if (!cancelled) {
              setMustClaim(Boolean(evalJson.mustClaim));
              if (evalJson.amount) setAmount(evalJson.amount);
            }
            return;
          } catch {
            // Fall through to not-eligible below.
          }
        }
        if (!cancelled) setMustClaim(false);
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

  // Preload a live upsell campaign so it's ready the instant they claim.
  useEffect(() => {
    if (!mustClaim || !address) return;
    let cancelled = false;
    void (async () => {
      try {
        const pickRes = await fetch("/api/onboarding/gift/upsell-campaign");
        const pickJson = (await pickRes.json()) as { campaignId?: string | null };
        const campaignId = pickJson.campaignId;
        if (cancelled || !campaignId) return;

        const res = await fetch(`/api/community/campaigns/${campaignId}?address=${address}`);
        const json = await res.json();
        if (cancelled || !json.campaign) return;
        setUpsellCampaignId(campaignId);
        setCampaignSource({
          ...json.campaign,
          community: json.campaign.communities,
          milestone_count: json.milestoneCount,
        });
      } catch {
        // If this fails, no campaign will be found below — the upsell step
        // is skipped after claim rather than forcing a join that can't happen.
      } finally {
        if (!cancelled) setUpsellCheckDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mustClaim, address]);

  // Claiming a fast on-chain tx can (rarely) resolve before the campaign
  // preload fetch does — don't let that race skip the mandatory join step.
  useEffect(() => {
    if (step === "upsell" && upsellCheckDone && !campaignSource) {
      setStep("done");
    }
  }, [step, upsellCheckDone, campaignSource]);

  const canClaimUbi =
    ubi.isInitialized &&
    ubi.isWhitelisted &&
    !ubi.hasClaimed &&
    ubi.entitlement !== null &&
    ubi.entitlement > 0n;
  const ubiAmount = ubi.entitlement !== null ? parseFloat(formatUnits(ubi.entitlement, 18)) : 0;

  const handleClaim = async () => {
    if (!address) return;
    try {
      if (canClaimUbi) {
        try {
          await ubi.claim();
        } catch {
          // Best-effort — the gift claim below is the one that actually
          // unblocks the app, so a UBI failure (e.g. already claimed on
          // another device a second ago) never stalls it.
        }
      }
      await claimReward(GOOD_DOLLAR);
      await fetch("/api/onboarding/gift/mark-claimed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      setMustClaim(false);
      await refetchPending();
      // If the campaign preload already resolved to "none", go straight to
      // done; otherwise wait in "upsell" (which shows a loading state until
      // the preload settles, then the effect above resolves it either way).
      setStep(upsellCheckDone && !campaignSource ? "done" : "upsell");
    } catch {
      // Surfaced below via `error` from useClaimReward.
    }
  };

  const handleJoinCampaign = async () => {
    if (!upsellCampaignId || !campaignSource || !address) return;
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
    joinFlow.openJoinModal(upsellCampaignId, campaignSource);
  };

  if (!mounted || !checked) return null;

  if (step === "upsell" && !(upsellCampaignId && campaignSource)) {
    // Claimed, waiting on the campaign preload to settle — the effect above
    // moves on to "done" automatically if it resolves to no campaign.
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-background p-6 text-center shadow-xl">
          <Loader2 className="h-6 w-6 animate-spin text-delulu-green" />
          <p className="text-sm text-muted-foreground">Finding a campaign for you…</p>
        </div>
      </div>,
      document.body,
    );
  }

  if (step === "upsell" && upsellCampaignId && campaignSource) {
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
            </div>
          </div>
        ) : null}
        <CampaignJoinFlowOverlay flow={joinFlow} address={address} onJoined={() => setStep("done")} />
      </>,
      document.body,
    );
  }

  if (!mustClaim) return null;

  // Wait for the UBI status to load too, so the combined total doesn't
  // change out from under the user right after the card first appears.
  if (!ubi.isInitialized) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-background p-6 text-center shadow-xl">
          <Loader2 className="h-6 w-6 animate-spin text-delulu-green" />
          <p className="text-sm text-muted-foreground">Loading your G$…</p>
        </div>
      </div>,
      document.body,
    );
  }

  const rewardNotYetOnChain = pending <= 0n;
  const totalAmount = amount + (canClaimUbi ? ubiAmount : 0);
  const isBusy = isPending || ubi.isClaiming;

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
          {totalAmount.toLocaleString()}{" "}
          <span className="text-lg font-bold text-muted-foreground">G$</span>
        </p>
        {canClaimUbi ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {amount.toLocaleString()} welcome gift + {ubiAmount.toLocaleString()} today's G$ claim
          </p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You verified your identity — this one's on us. Claim it to fund joining your first
          campaign.
        </p>

        {error || ubi.error ? (
          <p className="mt-3 text-xs text-destructive">
            {(error instanceof Error ? error.message : null) ??
              ubi.error?.message ??
              "Claim failed — try again"}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleClaim}
          disabled={isBusy || rewardNotYetOnChain}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-delulu-green px-4 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Gift className="h-4 w-4" strokeWidth={2} />
          )}
          {isBusy
            ? "Claiming…"
            : rewardNotYetOnChain
              ? "Preparing your gift…"
              : `Claim ${totalAmount.toLocaleString()} G$`}
        </button>
      </div>
    </div>,
    document.body,
  );
}
