"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatUnits } from "viem";
import { Gift, Loader2 } from "lucide-react";
import { Lulu } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { useHasGas } from "@/hooks/use-has-gas";
import { usePendingReward, useClaimReward } from "@/hooks/use-reward-vault";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useCampaignJoinFlow } from "@/hooks/use-campaign-join-flow";
import { useBingo } from "@/hooks/use-bingo";
import { BingoJoinSheet } from "@/components/bingo/bingo-join-sheet";
import type { GiftJoinTarget } from "@/lib/onboarding/gift-join";
import { CampaignJoinFlowOverlay } from "@/components/community/campaign-join-flow-overlay";
import type { CampaignJoinSource } from "@/lib/community/campaign-join-info";
import { useIntroDone } from "@/lib/app-intro";
import { setBlockingOverlay } from "@/lib/overlay-slot";
import { useOnboardingGiftRecheck } from "@/contexts/onboarding-gift-context";

const GOOD_DOLLAR = GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`;

/** "Outside Your Bubble" → "Outside Your Bubble Bingo", without doubling it. */
const bingoName = (title: string) => (/bingo$/i.test(title.trim()) ? title.trim() : `${title.trim()} Bingo`);

type Step = "claim" | "upsell" | "done";

type GiftStatus = { mustClaim?: boolean; mustJoin?: boolean; amount?: number; status?: string; target?: GiftJoinTarget | null };

/**
 * Fully blocking throughout, both steps — no close button, no backdrop
 * dismiss. Shows the moment a wallet has been granted the one-time
 * onboarding gift and hasn't claimed it yet; once claimed, blocks again
 * until they've joined with it (a weekly Bingo's Starter tier, or a campaign
 * priced at the gift — whatever /api/onboarding/gift/status names as the
 * target). The join step comes from the server (mustJoin), so a reload or a
 * new device can't skip it. The gift is only deposited while a target
 * exists (lib/onboarding/gift.ts), so there's always something to join.
 * Mounted app-wide in the main layout.
 */
export function OnboardingGiftModal() {
  const { address, authenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [mustClaim, setMustClaim] = useState(false);
  const [amount, setAmount] = useState(1000);
  const [checked, setChecked] = useState(false);
  const [step, setStep] = useState<Step>("claim");
  const [target, setTarget] = useState<GiftJoinTarget | null>(null);
  const [gasTopupPending, setGasTopupPending] = useState(false);

  const { pending, refetch: refetchPending } = usePendingReward(
    address as `0x${string}` | undefined,
    GOOD_DOLLAR,
  );
  const { claimReward, isPending, error } = useClaimReward();
  const { isLowGas } = useHasGas();
  const ubi = useGoodDollarClaim();
  const { recheckToken } = useOnboardingGiftRecheck();
  // Never stack on the first-run intro — show once it's finished.
  const introDone = useIntroDone();
  // Must-see: automatic prompts (install, notifications) wait while the gift is
  // being checked or is on screen.
  useEffect(() => {
    setBlockingOverlay("gift", Boolean(address) && (!checked || mustClaim || step === "upsell"));
    return () => setBlockingOverlay("gift", false);
  }, [address, checked, mustClaim, step]);

  useEffect(() => {
    setMounted(true);
  }, []);

  /** Applies a status/evaluate response: claim first, then the join step. */
  const apply = (json: GiftStatus) => {
    if (json.amount) setAmount(json.amount);
    setTarget(json.target ?? null);
    setMustClaim(Boolean(json.mustClaim));
    setStep(json.mustClaim ? "claim" : json.mustJoin && json.target ? "upsell" : "done");
  };

  const fetchStatus = async (): Promise<GiftStatus> => {
    const res = await fetch(`/api/onboarding/gift/status?address=${address}`);
    return (await res.json()) as GiftStatus;
  };

  useEffect(() => {
    if (!authenticated || !address) {
      setChecked(true);
      setMustClaim(false);
      setStep("done");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const json = await fetchStatus();
        if (cancelled) return;
        if (json.mustClaim || json.mustJoin || json.status === "sent") {
          apply(json);
          return;
        }

        // The cached DB status says not eligible yet. That can be stale — the
        // two places that normally grant this (post-signup, post-identity-
        // verification) each run once and never retry, and the gift also waits
        // for a Bingo to be open. Landing here re-checks live eligibility and
        // self-heals; idempotent (the on-chain rewardId guard prevents any
        // double-deposit).
        try {
          const evalRes = await fetch("/api/onboarding/gift/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
          });
          const evalJson = (await evalRes.json()) as GiftStatus;
          if (!cancelled) apply(evalJson);
        } catch {
          if (!cancelled) setStep("done");
        }
      } catch {
        // Fails closed — never block the app over a status-check network error.
        if (!cancelled) {
          setMustClaim(false);
          setStep("done");
        }
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // recheckToken: bumped by requestRecheck() right after an event that
    // could newly grant the gift within an already-mounted session (e.g.
    // identity verification via the claim panel) — see onboarding-gift-context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, address, recheckToken]);

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
          // unblocks the app, so a UBI failure never stalls it.
        }
      }
      await claimReward(GOOD_DOLLAR);
      await fetch("/api/onboarding/gift/mark-claimed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      await refetchPending();
      // The server decides the join step (and its target) from here on.
      try {
        apply(await fetchStatus());
      } catch {
        setMustClaim(false);
        setStep(target ? "upsell" : "done");
      }
    } catch {
      // Surfaced below via `error` from useClaimReward.
    }
  };

  /** Joined (or tried to): ask the server whether the gift is now in play. */
  const handleJoined = async () => {
    try {
      apply(await fetchStatus());
    } catch {
      setStep("done");
    }
  };

  /** Their stake tx needs CELO for gas; top it up first if they're low. */
  const ensureGas = async () => {
    if (!isLowGas) return;
    setGasTopupPending(true);
    try {
      await fetch("/api/faucet/topup", { method: "POST" });
      // Give the top-up tx a moment to land before the join tx needs the balance.
      await new Promise((resolve) => setTimeout(resolve, 4000));
    } catch {
      // If the faucet fails, the join tx surfaces its own gas error.
    } finally {
      setGasTopupPending(false);
    }
  };

  if (!mounted || !checked || !introDone) return null;

  if (step === "upsell" && target) {
    return target.kind === "bingo" ? (
      <GiftBingoJoin target={target} amount={amount} busy={gasTopupPending} beforeJoin={ensureGas} onJoined={handleJoined} />
    ) : (
      <GiftCampaignJoin target={target} amount={amount} address={address} busy={gasTopupPending} beforeJoin={ensureGas} onJoined={handleJoined} />
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
          <Loader2 className="h-6 w-6 animate-spin text-green-edge" />
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-soft">
          <Gift className="h-8 w-8 text-green-edge" strokeWidth={2} />
        </div>

        <h2 className="mt-4 text-xl font-extrabold text-foreground">Welcome gift</h2>
        <p className="mt-4 text-4xl font-extrabold tabular-nums text-foreground">
          {totalAmount.toLocaleString()}{" "}
          <span className="text-lg font-bold text-muted-foreground">G$</span>
        </p>
        {canClaimUbi ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {amount.toLocaleString()} welcome gift + {ubiAmount.toLocaleString()} today&apos;s G$ claim
          </p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You verified, so this one&apos;s on us. Claim it, then use it to join
          {target ? ` ${target.kind === "bingo" ? bingoName(target.title) : target.title}` : " your first Bingo"}.
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
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-green px-4 py-3.5 text-sm font-extrabold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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

/** The blocking "put it to work" card both join paths share. */
function PutItToWork({
  title,
  amount,
  stake,
  busy,
  onJoin,
}: {
  title: string;
  amount: number;
  stake: number;
  busy: boolean;
  onJoin: () => void;
}) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl bg-background p-6 text-center shadow-xl">
        <div className="flex justify-center">
          <Lulu size={72} />
        </div>
        <h2 className="mt-3 text-xl font-extrabold text-foreground">Put it to work</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your {amount.toLocaleString()} G$ gift is for playing. Join{" "}
          <span className="font-bold text-foreground">{title}</span> with {stake.toLocaleString()} G$ and get it back
          when you finish.
        </p>
        <button
          type="button"
          onClick={onJoin}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-green px-4 py-3.5 text-sm font-extrabold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" strokeWidth={2} />}
          {busy ? "Getting you set up…" : `Join with ${stake.toLocaleString()} G$`}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function GiftBingoJoin({
  target,
  amount,
  busy,
  beforeJoin,
  onJoined,
}: {
  target: Extract<GiftJoinTarget, { kind: "bingo" }>;
  amount: number;
  busy: boolean;
  beforeJoin: () => Promise<void>;
  onJoined: () => Promise<void>;
}) {
  const { bingo, reload } = useBingo(target.slug);
  const [open, setOpen] = useState(false);

  if (!bingo) {
    return createPortal(
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-background p-6 text-center shadow-xl">
          <Loader2 className="h-6 w-6 animate-spin text-green-edge" />
          <p className="text-sm text-muted-foreground">Finding your Bingo…</p>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <>
      {!open ? (
        <PutItToWork
          title={bingoName(bingo.title)}
          amount={amount}
          stake={target.stake}
          busy={busy}
          onJoin={async () => {
            await beforeJoin();
            setOpen(true);
          }}
        />
      ) : null}
      <BingoJoinSheet
        bingo={bingo}
        open={open}
        initialTierKey={target.tierKey}
        onOpenChange={setOpen}
        onJoined={async () => {
          await reload();
          await onJoined();
        }}
      />
    </>
  );
}

function GiftCampaignJoin({
  target,
  amount,
  address,
  busy,
  beforeJoin,
  onJoined,
}: {
  target: Extract<GiftJoinTarget, { kind: "campaign" }>;
  amount: number;
  address: string | undefined;
  busy: boolean;
  beforeJoin: () => Promise<void>;
  onJoined: () => Promise<void>;
}) {
  const joinFlow = useCampaignJoinFlow();
  const [source, setSource] = useState<CampaignJoinSource | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/community/campaigns/${target.campaignId}?address=${address}`);
        const json = await res.json();
        if (cancelled || !json.campaign) return;
        setSource({ ...json.campaign, community: json.campaign.communities, milestone_count: json.milestoneCount });
      } catch {
        // The button stays on "Getting you set up…" — a reload re-fetches it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target.campaignId, address]);

  return createPortal(
    <>
      {!joinFlow.joinModalOpen ? (
        <PutItToWork
          title={target.title}
          amount={amount}
          stake={target.stake}
          busy={busy || !source}
          onJoin={async () => {
            if (!source) return;
            await beforeJoin();
            joinFlow.openJoinModal(target.campaignId, source);
          }}
        />
      ) : null}
      <CampaignJoinFlowOverlay flow={joinFlow} address={address} onJoined={() => void onJoined()} />
    </>,
    document.body,
  );
}
