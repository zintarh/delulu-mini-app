"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useWaitForTransactionReceipt, useChainId } from "wagmi";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { Clock, ChevronRight, FileCheck, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMilestoneCountdown } from "@/lib/milestone-utils";
import { DELULU_ABI } from "@/lib/abi";
import { getDeluluContractAddress } from "@/lib/constant";
import { getContractErrorDisplay } from "@/lib/contract-error";
import { useUserOngoingMilestones } from "@/hooks/use-user-ongoing-milestones";
import { useApolloClient } from "@apollo/client/react";
import { refetchDeluluData } from "@/lib/graph/refetch-utils";

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

function urgencyColor(endTimeMs: number, now: number) {
  const remaining = endTimeMs - now;
  if (remaining <= 0) return "text-red-500";
  if (remaining < 3 * 60 * 60 * 1000) return "text-red-500";
  if (remaining < 24 * 60 * 60 * 1000) return "text-orange-500";
  return "text-muted-foreground";
}

interface OngoingMilestonesSectionProps {
  onCreateClick?: () => void;
}

export function OngoingMilestonesSection({ onCreateClick }: OngoingMilestonesSectionProps) {
  const router = useRouter();
  const chainId = useChainId();
  const apolloClient = useApolloClient();
  const now = useNow();

  const { milestones, isLoading, refetch } = useUserOngoingMilestones();

  const [proofLink, setProofLink] = useState("");
  const [activeMilestoneKey, setActiveMilestoneKey] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState(false);
  const submittedKeyRef = useRef<string | null>(null);

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
    submittedKeyRef.current = null;
    setProofSuccess(false);
    resetSubmit();
    setProofLink("");
    setActiveMilestoneKey(key);
  };

  const handleProofSubmit = (urlOverride?: string) => {
    const active = milestones.find((m) => m.key === activeMilestoneKey);
    if (!active) return;
    const link = (urlOverride ?? proofLink).trim();
    writeSubmitMilestone({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "submitMilestone",
      args: [BigInt(active.deluluNumericId), BigInt(active.milestoneId), link],
    });
  };

  if (isLoading) {
    return (
      <div className="px-4 py-4">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Plus className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">No active milestones</p>
        <p className="text-xs text-muted-foreground mb-5">
          Create a delulu with milestones to track your progress here.
        </p>
        {onCreateClick && (
          <button
            onClick={onCreateClick}
            className="px-5 py-2 rounded-full bg-[#fcff52] text-[#111111] font-bold text-sm shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#1A1A1A] active:shadow-none transition-all"
          >
            Create Delulu
          </button>
        )}
      </div>
    );
  }

  const activeMilestone = milestones.find((m) => m.key === activeMilestoneKey) ?? null;

  return (
    <>
      <div className="px-4 py-4">
        {/* Milestone list */}
        <div className="space-y-2">
          {milestones.map((m) => {
            const countdown = formatMilestoneCountdown(now, m.endTimeMs);
            const isEnded = countdown === "Ended";
            const timeClass = urgencyColor(m.endTimeMs, now);
            const title =
              m.delulu.content?.trim() ||
              `Delulu #${m.delulu.onChainId ?? m.delulu.id}`;

            return (
              <div
                key={m.key}
                className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5"
              >
                {/* Left: icon */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                  <FileCheck className="w-4 h-4 text-foreground" />
                </div>

                {/* Middle: text */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() =>
                    router.push(`/delulu/${m.delulu.onChainId ?? m.delulu.id}`)
                  }
                >
                  <p className="text-[11px] sm:text-xs font-semibold text-foreground truncate">
                    {m.label}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                    {title}
                  </p>
                  <div className={cn("flex items-center gap-1 mt-0.5", timeClass)}>
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] sm:text-[11px] font-mono font-medium">
                      {isEnded ? "Ended" : countdown}
                    </span>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex-shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={() => openProofModal(m.key)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#fcff52] text-[#111111] text-[11px] font-bold shadow-[2px_2px_0px_0px_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#1A1A1A] active:shadow-none transition-all whitespace-nowrap"
                  >
                    Submit Proof
                  </button>
                  <button
                    onClick={() =>
                      router.push(`/delulu/${m.delulu.onChainId ?? m.delulu.id}`)
                    }
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
                    aria-label="View delulu"
                  >
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeMilestone && (
        <ProofModal
          open={!!activeMilestoneKey}
          onOpenChange={(open) => {
            if (!open) {
              setActiveMilestoneKey(null);
              setProofSuccess(false);
              resetSubmit();
            }
          }}
          value={proofLink}
          onChange={setProofLink}
          onSubmit={handleProofSubmit}
          isSubmitting={isSubmitting}
          submitSuccess={proofSuccess}
          submitError={
            submitMilestoneError
              ? new Error(getContractErrorDisplay(submitMilestoneError).message)
              : null
          }
          onDone={() => {
            setActiveMilestoneKey(null);
            setProofSuccess(false);
            resetSubmit();
          }}
        />
      )}
    </>
  );
}
