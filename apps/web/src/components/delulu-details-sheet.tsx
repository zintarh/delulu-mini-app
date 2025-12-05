"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAccount } from "wagmi";
import { type FormattedDelulu } from "@/hooks/use-delulus";
import { useStake } from "@/hooks/use-stake";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { FeedbackModal } from "@/components/feedback-modal";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDeluluCreator } from "@/lib/delulu-utils";

interface DeluluDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delulu: FormattedDelulu | null;
}

function formatTimeRemaining(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(diff / (1000 * 60))}m`;
}

export function DeluluDetailsSheet({
  open,
  onOpenChange,
  delulu,
}: DeluluDetailsSheetProps) {
  const { isConnected, address } = useAccount();
  const { stake, isPending, isConfirming, isSuccess: isStakeSuccess, error: stakeError } = useStake();
  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    refetchAllowance,
  } = useTokenApproval();
  const [stakeAmount, setStakeAmount] = useState("1");
  const [pendingAction, setPendingAction] = useState<
    "believe" | "doubt" | null
  >(null);
  const [showStakeInput, setShowStakeInput] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Check if user is the creator
  const isCreator = isDeluluCreator(address, delulu);

  // Auto-stake after approval succeeds
  useEffect(() => {
    if (!delulu) return;
    if (isApprovalSuccess && pendingAction) {
      const amount = parseFloat(stakeAmount);
      if (pendingAction === "believe") {
        stake(delulu.id, amount, true);
      } else {
        stake(delulu.id, amount, false);
      }
      setPendingAction(null);
      refetchAllowance();
    }
  }, [
    isApprovalSuccess,
    pendingAction,
    stakeAmount,
    delulu,
    stake,
    refetchAllowance,
  ]);

  // Handle stake success
  useEffect(() => {
    if (isStakeSuccess) {
      setShowSuccessModal(true);
      setShowStakeInput(false);
      setStakeAmount("1");
      setPendingAction(null);
    }
  }, [isStakeSuccess]);

  // Handle stake errors
  useEffect(() => {
    if (stakeError) {
      let errorMsg = "Failed to stake";
      if (stakeError.message) {
        if (stakeError.message.includes("user rejected")) {
          errorMsg = "Transaction was cancelled";
        } else if (stakeError.message.includes("insufficient")) {
          errorMsg = "Insufficient balance";
        } else if (stakeError.message.includes("revert")) {
          const revertMatch = stakeError.message.match(/revert (.+)/);
          if (revertMatch) {
            errorMsg = `Transaction failed: ${revertMatch[1]}`;
          }
        } else {
          errorMsg = stakeError.message;
        }
      }
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  }, [stakeError]);

  if (!delulu) return null;

  const total = delulu.totalBelieverStake + delulu.totalDoubterStake;
  const believerPercent =
    total > 0 ? Math.round((delulu.totalBelieverStake / total) * 100) : 0;

  const handleBelieveClick = () => {
    setPendingAction("believe");
    setShowStakeInput(true);
  };

  const handleDoubtClick = () => {
    setPendingAction("doubt");
    setShowStakeInput(true);
  };

  const handleStake = async () => {
    if (!isConnected || !address || !pendingAction || isCreator) return;
    const amount = parseFloat(stakeAmount);
    if (amount <= 0) return;

    try {
      if (needsApproval(amount)) {
        await approve(amount);
        return;
      }
      await stake(delulu.id, amount, pendingAction === "believe");
    } catch (error) {
      console.error("Stake error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to stake"
      );
      setShowErrorModal(true);
    }
  };

  const isStaking =
    isPending || isConfirming || isApproving || isApprovingConfirming;
  const canStake = !delulu.isResolved && new Date() < delulu.stakingDeadline && !isCreator;
  const amount = parseFloat(stakeAmount);
  const needsApprovalForAmount = needsApproval(amount);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-delulu-yellow border-t-2 border-delulu-dark/20 max-h-[90vh] overflow-hidden p-0 rounded-t-3xl [&>button]:text-delulu-dark [&>button]:bg-delulu-dark/10 [&>button]:hover:bg-delulu-dark/20"
      >
        <div className="relative flex flex-col overflow-y-auto pb-32">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <p className="text-xs text-delulu-dark/50 mb-4">
              Created {new Date(delulu.stakingDeadline).toLocaleDateString()}
            </p>

            {/* Content */}
            <div className="mb-6">
              <p className="text-2xl font-gloria text-delulu-dark leading-tight mb-4">
                &ldquo;{delulu.content || delulu.contentHash}&rdquo;
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-delulu-dark/5">
                <p className="text-xs text-delulu-dark/50 mb-1">Believers</p>
                <p className="text-xl font-black text-delulu-dark">
                  {delulu.totalBelieverStake > 0
                    ? delulu.totalBelieverStake < 0.01
                      ? delulu.totalBelieverStake.toFixed(4)
                      : delulu.totalBelieverStake.toFixed(2)
                    : "0.00"}{" "}
                  cUSD
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-delulu-dark/5">
                <p className="text-xs text-delulu-dark/50 mb-1">Doubters</p>
                <p className="text-xl font-black text-delulu-dark">
                  {delulu.totalDoubterStake > 0
                    ? delulu.totalDoubterStake < 0.01
                      ? delulu.totalDoubterStake.toFixed(4)
                      : delulu.totalDoubterStake.toFixed(2)
                    : "0.00"}{" "}
                  cUSD
                </p>
              </div>
            </div>

            {/* Progress Ring */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="rgba(10,10,10,0.2)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="var(--delulu-purple)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={
                      2 * Math.PI * 40 -
                      (believerPercent / 100) * 2 * Math.PI * 40
                    }
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-delulu-dark">
                    {believerPercent}%
                  </span>
                  <span className="text-xs text-delulu-dark/50">Believe</span>
                </div>
              </div>
            </div>

            {/* Deadline */}
            <div className="p-4 rounded-2xl bg-delulu-dark/5 mb-6">
              <p className="text-xs text-delulu-dark/50 mb-1">
                Staking Deadline
              </p>
              <p className="text-lg font-black text-delulu-dark">
                {formatTimeRemaining(delulu.stakingDeadline)} remaining
              </p>
              <p className="text-xs text-delulu-dark/50 mt-1">
                {delulu.stakingDeadline.toLocaleDateString()} at{" "}
                {delulu.stakingDeadline.toLocaleTimeString()}
              </p>
            </div>

            {/* Stake Amount Input - shown after clicking Believe/Doubt */}
            {canStake && isConnected && showStakeInput && (
              <div className="mb-6">
                <label className="block text-sm font-bold text-delulu-dark mb-2">
                  Stake Amount (cUSD)
                </label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  min="0.001"
                  step="0.001"
                  className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-delulu-dark text-delulu-dark font-bold text-lg focus:outline-none focus:ring-2 focus:ring-delulu-dark"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        {/* Creator message */}
        {isCreator && isConnected && (
          <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-delulu-yellow/95 backdrop-blur-sm border-t border-delulu-dark/10 z-50">
            <div className="w-full px-6 py-4 bg-delulu-dark/10 rounded-full text-center">
              <p className="text-sm font-bold text-delulu-dark">
                You can&apos;t stake on your own delusion
              </p>
            </div>
          </div>
        )}

        {/* Floating Action Buttons - at bottom, floating on top */}
        {canStake && isConnected && !isCreator && (
          <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-delulu-yellow/95 backdrop-blur-sm border-t border-delulu-dark/10 flex gap-4 z-50">
            {!showStakeInput ? (
              <>
                <button
                  onClick={handleBelieveClick}
                  className={cn(
                    "flex-1 px-6 py-4",
                    "bg-white rounded-full",
                    "text-delulu-dark font-black text-lg",
                    "shadow-[0_4px_0_0_#0a0a0a]",
                    "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
                    "transition-all duration-150"
                  )}
                >
                  Believe
                </button>
                <button
                  onClick={handleDoubtClick}
                  className={cn(
                    "flex-1 px-6 py-4",
                    "bg-white rounded-full",
                    "text-delulu-dark font-black text-lg",
                    "shadow-[0_4px_0_0_#0a0a0a]",
                    "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
                    "transition-all duration-150"
                  )}
                >
                  Doubt
                </button>
              </>
            ) : (
              <button
                onClick={handleStake}
                disabled={isStaking || !stakeAmount || amount <= 0}
                className={cn(
                  "w-full px-6 py-4",
                  "bg-white rounded-full",
                  "text-delulu-dark font-black text-lg",
                  "shadow-[0_4px_0_0_#0a0a0a]",
                  "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
                  "transition-all duration-150",
                  "disabled:opacity-70 disabled:shadow-[0_2px_0_0_#0a0a0a] disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isStaking ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>
                      {isApproving || isApprovingConfirming
                        ? "Approving..."
                        : "Staking..."}
                    </span>
                  </>
                ) : (
                  <span>
                    {pendingAction === "believe" ? "Believe" : "Doubt"}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </SheetContent>

      {/* Success Modal */}
      <FeedbackModal
        isOpen={showSuccessModal}
        type="success"
        title="Stake Placed! 🎉"
        message={`You've successfully staked ${stakeAmount} cUSD as a ${pendingAction === "believe" ? "believer" : "doubter"}!`}
        onClose={() => {
          setShowSuccessModal(false);
        }}
        actionText="Done"
      />

      {/* Error Modal */}
      <FeedbackModal
        isOpen={showErrorModal}
        type="error"
        title="Staking Failed"
        message={errorMessage || "Failed to place stake. Please try again."}
        onClose={() => {
          setShowErrorModal(false);
        }}
        actionText="Try Again"
      />
    </Sheet>
  );
}
