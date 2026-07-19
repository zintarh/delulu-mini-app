"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useWaitForTransactionReceipt, useChainId } from "wagmi";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { DELULU_ABI } from "@/lib/abi";
import { getDeluluContractAddress } from "@/lib/constant";
import { getContractErrorDisplay } from "@/lib/contract-error";
import { useUserOngoingMilestones } from "@/hooks/use-user-ongoing-milestones";
import { useJoinedCampaignDashboard } from "@/hooks/use-user-campaign-milestones";
import { useApolloClient } from "@apollo/client/react";
import { refetchDeluluData } from "@/lib/graph/refetch-utils";
import {
  DeluluJourneyCard,
  MilestoneTrackerEmpty,
  MilestoneTrackerHero,
  MilestoneTrackerSkeleton,
} from "@/components/profile/profile-milestone-tracker";

const ProofModal = dynamic(
  () => import("@/components/proof-modal").then((m) => m.ProofModal),
  { ssr: false },
);

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return now;
}

interface OngoingMilestonesSectionProps {
  onCreateClick?: () => void;
  /** Tighter layout for the home dashboard */
  variant?: "default" | "home";
  /** When true on home variant, render nothing instead of empty state */
  hideWhenEmpty?: boolean;
  /**
   * Wallet address, used only to check whether the user has active
   * community-campaign milestones. A milestone is a milestone regardless of
   * source — if the user has campaign milestones due (shown elsewhere, e.g.
   * ActiveCampaignsSection), this section shouldn't also claim "no
   * milestones yet" just because it has no personal delulu of its own.
   */
  address?: string | null;
}

export function OngoingMilestonesSection({
  onCreateClick,
  variant = "default",
  hideWhenEmpty = false,
  address,
}: OngoingMilestonesSectionProps) {
  const chainId = useChainId();
  const apolloClient = useApolloClient();
  const now = useNow();

  const { milestones, trackers, summary, isLoading, refetch } =
    useUserOngoingMilestones();
  const { data: joinedCampaigns, isLoading: isLoadingCampaigns } =
    useJoinedCampaignDashboard(address ?? undefined);
  const hasActiveCampaignMilestones = (joinedCampaigns ?? []).some(
    (c) => c.next_milestones.length > 0,
  );

  const [activeMilestoneKey, setActiveMilestoneKey] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isVerifyingAi, setIsVerifyingAi] = useState(false);

  const {
    writeContract: writeSubmitMilestone,
    data: submitHash,
    isPending: isSubmittingMilestone,
    error: submitMilestoneError,
    reset: resetSubmit,
  } = useUnifiedWriteContract();

  const { isLoading: isConfirming, isSuccess: isSubmitSuccess } =
    useWaitForTransactionReceipt({ hash: submitHash });

  const isSubmitting = isSubmittingMilestone || isConfirming;

  useEffect(() => {
    if (isSubmitSuccess && !proofSuccess) {
      setProofSuccess(true);
      const active = milestones.find((m) => m.key === activeMilestoneKey);
      if (active) {
        refetchDeluluData(apolloClient, active.delulu.onChainId ?? active.delulu.id);
        refetch();
      }
    }
  }, [isSubmitSuccess, proofSuccess, milestones, activeMilestoneKey, apolloClient, refetch]);

  const openProofModal = (key: string) => {
    setProofSuccess(false);
    setAiError(null);
    resetSubmit();
    setActiveMilestoneKey(key);
  };

  const handleProofSubmit = async (imageUrl: string) => {
    const active = milestones.find((m) => m.key === activeMilestoneKey);
    if (!active) return;
    const link = imageUrl.trim();

    setAiError(null);
    setIsVerifyingAi(true);
    try {
      const res = await fetch("/api/ai/verify-milestone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: link,
          deluluGoal: active.delulu.content ?? "",
          milestoneDescription: active.label,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        setAiError(
          data.reason ??
            "Your image doesn't clearly show this milestone was completed. Please upload a photo or screenshot that directly demonstrates your progress.",
        );
        return;
      }
    } catch {
      setAiError("Could not reach the verification service. Please try again.");
      return;
    } finally {
      setIsVerifyingAi(false);
    }

    writeSubmitMilestone({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "submitMilestone",
      args: [BigInt(active.deluluNumericId), BigInt(active.milestoneId), link, true],
    });
  };

  if (isLoading || (Boolean(address) && isLoadingCampaigns)) {
    return <MilestoneTrackerSkeleton compact={variant === "home"} />;
  }

  if (trackers.length === 0) {
    // Campaign milestones are already surfaced elsewhere (e.g.
    // ActiveCampaignsSection rendered alongside this component) — don't
    // also claim there are no milestones when there are.
    if (hasActiveCampaignMilestones) return null;
    if (variant === "home" && hideWhenEmpty) return null;
    return (
      <MilestoneTrackerEmpty
        onCreateClick={onCreateClick}
        compact={variant === "home"}
      />
    );
  }

  const activeMilestone = milestones.find((m) => m.key === activeMilestoneKey) ?? null;

  return (
    <>
      <div
        className={
          variant === "home"
            ? "mx-auto max-w-2xl space-y-3 px-4 pb-4 xl:max-w-3xl"
            : "mx-auto max-w-xl space-y-5 px-4 py-6 pb-10"
        }
      >
        {variant === "home" ? null : (
          <MilestoneTrackerHero summary={summary} />
        )}

        {trackers.map((tracker) => (
          <DeluluJourneyCard
            key={tracker.deluluKey}
            tracker={tracker}
            now={now}
            onSubmitDue={openProofModal}
            compact={variant === "home"}
          />
        ))}
      </div>

      {activeMilestone ? (
        <ProofModal
          open={!!activeMilestoneKey}
          onOpenChange={(open) => {
            if (!open) {
              setActiveMilestoneKey(null);
              setProofSuccess(false);
              setAiError(null);
              resetSubmit();
            }
          }}
          onSubmit={handleProofSubmit}
          isSubmitting={isSubmitting || isVerifyingAi}
          submitSuccess={proofSuccess}
          submitError={
            aiError
              ? new Error(aiError)
              : submitMilestoneError
                ? new Error(getContractErrorDisplay(submitMilestoneError).message)
                : null
          }
          onDone={() => {
            setActiveMilestoneKey(null);
            setProofSuccess(false);
            setAiError(null);
            resetSubmit();
          }}
        />
      ) : null}
    </>
  );
}
