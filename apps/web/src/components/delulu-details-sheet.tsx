"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAccount } from "wagmi";
import { type FormattedDelulu } from "@/hooks/use-delulus";
import { useStake } from "@/hooks/use-stake";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useCUSDBalance } from "@/hooks/use-cusd-balance";
import { useUserPosition } from "@/hooks/use-user-position";
import { usePotentialPayout } from "@/hooks/use-potential-payout";
import { useClaimable } from "@/hooks/use-claimable";
import { useClaimWinnings } from "@/hooks/use-claim-winnings";
import { useDeluluState, DeluluState } from "@/hooks/use-delulu-state";
import { DeluluStatusBadge } from "@/components/delulu-status-badge";
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



  const {
    stake,
    isPending,
    isConfirming,
    isSuccess: isStakeSuccess,
    error: stakeError,
  } = useStake();



  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    error: approvalError,
    refetchAllowance,
  } = useTokenApproval();
  const { balance: cusdBalance, isLoading: isLoadingBalance } =
    useCUSDBalance();
  const { hasStaked, isBeliever: userIsBeliever, stakeAmount: userStakeAmount } = useUserPosition(
    delulu?.id || null
  );

  const { stateEnum: deluluState } = useDeluluState(delulu?.id || null);
  const { isClaimable, isLoading: isLoadingClaimable } = useClaimable(
    delulu?.id || null
  );
  const {
    claim,
    isPending: isClaiming,
    isConfirming: isClaimConfirming,
    isSuccess: isClaimSuccess,
    error: claimError,
  } = useClaimWinnings();

  const [stakeAmount, setStakeAmount] = useState("1");
  const [pendingAction, setPendingAction] = useState<
    "believe" | "doubt" | null
  >(null);
  const [lastStakeAction, setLastStakeAction] = useState<
    "believe" | "doubt" | null
  >(null);
  const [showStakeInput, setShowStakeInput] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showClaimSuccessModal, setShowClaimSuccessModal] = useState(false);

  // Calculate potential payout when user enters stake amount
  const { potentialPayout, isLoading: isLoadingPayout } = usePotentialPayout(
    delulu?.id || null,
    showStakeInput && stakeAmount ? parseFloat(stakeAmount) : null,
    pendingAction === "believe" ? true : pendingAction === "doubt" ? false : null
  );

  const isCreator = isDeluluCreator(address, delulu);

  useEffect(() => {
    if (!delulu) return;
    if (isApprovalSuccess && pendingAction) {
      const amount = parseFloat(stakeAmount);

      if (isNaN(amount) || amount <= 0) {
        setErrorMessage("Invalid stake amount");
        setShowErrorModal(true);
        setPendingAction(null);
        return;
      }

      try {
        const isBeliever = pendingAction === "believe";
        setLastStakeAction(pendingAction);
        if (isBeliever) {
          stake(delulu.id, amount, true);
        } else {
          stake(delulu.id, amount, false);
        }
        setPendingAction(null);
        refetchAllowance();
      } catch (error) {
        console.error("Auto-stake error:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to stake after approval"
        );
        setShowErrorModal(true);
        setPendingAction(null);
      }
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
    }
  }, [isStakeSuccess]);

  // Handle claim success
  useEffect(() => {
    if (isClaimSuccess) {
      setShowClaimSuccessModal(true);
    }
  }, [isClaimSuccess]);

  // Handle claim errors
  useEffect(() => {
    if (claimError) {
      let errorMsg = "Failed to claim winnings";
      if (claimError.message) {
        const errorLower = claimError.message.toLowerCase();
        if (
          errorLower.includes("user rejected") ||
          errorLower.includes("user denied")
        ) {
          errorMsg = "Claim was cancelled";
        } else if (errorLower.includes("already claimed")) {
          errorMsg = "Winnings have already been claimed";
        } else if (errorLower.includes("not claimable")) {
          errorMsg = "Winnings are not yet claimable";
        } else {
          errorMsg =
            claimError.message.length > 100
              ? "Claim failed. Please try again."
              : claimError.message;
        }
      }
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  }, [claimError]);

  // Handle approval errors
  useEffect(() => {
    if (approvalError) {
      let errorMsg = "Failed to approve cUSD";

      if (approvalError.message) {
        const errorLower = approvalError.message.toLowerCase();

        if (
          errorLower.includes("user rejected") ||
          errorLower.includes("user denied") ||
          errorLower.includes("rejected the request")
        ) {
          errorMsg = "Approval was cancelled";
        } else if (errorLower.includes("insufficient")) {
          errorMsg = "Insufficient balance for approval";
        } else if (errorLower.includes("revert")) {
          errorMsg = "Approval failed. Please try again.";
        } else {
          errorMsg =
            approvalError.message.length > 100
              ? "Approval failed. Please try again."
              : approvalError.message;
        }
      }

      setErrorMessage(errorMsg);
      setShowErrorModal(true);
      setPendingAction(null);
    }
  }, [approvalError]);

  useEffect(() => {
    if (stakeError) {
      let errorMsg = "Failed to stake";

      if (stakeError.message) {
        const errorLower = stakeError.message.toLowerCase();
        if (
          errorLower.includes("user rejected") ||
          errorLower.includes("user denied") ||
          errorLower.includes("rejected the request")
        ) {
          errorMsg = "Transaction was cancelled";
        }
        // Insufficient balance
        else if (
          errorLower.includes("insufficient") ||
          errorLower.includes("balance too low")
        ) {
          errorMsg = "Insufficient cUSD balance";
        }
        // Contract revert errors
        else if (errorLower.includes("revert")) {
          // Try to extract the revert reason
          const revertMatch = stakeError.message.match(
            /revert\s+(.+?)(?:\s|$)/i
          );
          if (revertMatch && revertMatch[1]) {
            const reason = revertMatch[1].trim();
            // Common contract errors
            if (
              reason.includes("StakingDeadlinePassed") ||
              reason.includes("deadline")
            ) {
              errorMsg = "Staking deadline has passed";
            } else if (
              reason.includes("DeluluResolved") ||
              reason.includes("resolved")
            ) {
              errorMsg = "This delulu has already been resolved";
            } else if (
              reason.includes("DeluluCancelled") ||
              reason.includes("cancelled")
            ) {
              errorMsg = "This delulu has been cancelled";
            } else if (
              reason.includes("CreatorCannotStake") ||
              reason.includes("creator")
            ) {
              errorMsg = "Creators cannot stake on their own delulu";
            } else if (
              reason.includes("InvalidAmount") ||
              reason.includes("amount")
            ) {
              errorMsg = "Invalid stake amount";
            } else {
              errorMsg = `Transaction failed: ${reason}`;
            }
          } else {
            errorMsg = "Transaction failed. Please try again.";
          }
        }
        // Network/RPC errors
        else if (
          errorLower.includes("network") ||
          errorLower.includes("connection") ||
          errorLower.includes("timeout") ||
          errorLower.includes("block is out of range") ||
          errorLower.includes("synchronization") ||
          errorLower.includes("rpc")
        ) {
          errorMsg =
            "Network synchronization issue. The RPC node is catching up. Please wait a moment and try again.";
        }
        // Gas estimation errors
        else if (
          errorLower.includes("gas") ||
          errorLower.includes("execution reverted")
        ) {
          errorMsg =
            "Transaction would fail. Please check your balance and try again.";
        }
        // Generic error
        else {
          errorMsg =
            stakeError.message.length > 100
              ? "Transaction failed. Please try again."
              : stakeError.message;
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

  const hasBalance = cusdBalance
    ? parseFloat(cusdBalance.formatted) > 0
    : false;
  const hasInsufficientBalance = cusdBalance
    ? parseFloat(cusdBalance.formatted) < parseFloat(stakeAmount || "0")
    : false;

  const handleBelieveClick = () => {
    if (!hasBalance) {
      setErrorMessage("Insufficient balance. You need cUSD to stake.");
      setShowErrorModal(true);
      return;
    }
    setPendingAction("believe");
    setShowStakeInput(true);
  };

  const handleDoubtClick = () => {
    if (!hasBalance) {
      setErrorMessage("Insufficient balance. You need cUSD to stake.");
      setShowErrorModal(true);
      return;
    }
    setPendingAction("doubt");
    setShowStakeInput(true);
  };

  const handleStake = async () => {
    if (!isConnected || !address || !pendingAction || isCreator) return;

    const amount = parseFloat(stakeAmount);

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage("Please enter a valid stake amount (greater than 0)");
      setShowErrorModal(true);
      return;
    }

    // Check balance before staking
    if (cusdBalance && parseFloat(cusdBalance.formatted) < amount) {
      setErrorMessage(
        `Insufficient balance. You have ${parseFloat(
          cusdBalance.formatted
        ).toFixed(2)} cUSD but need ${amount.toFixed(2)} cUSD.`
      );
      setShowErrorModal(true);
      return;
    }

    // Check if delulu is still active
    if (delulu.isResolved) {
      setErrorMessage("This delulu has already been resolved");
      setShowErrorModal(true);
      return;
    }

    if (new Date() >= delulu.stakingDeadline) {
      setErrorMessage("Staking deadline has passed");
      setShowErrorModal(true);
      return;
    }

    try {
      const isBeliever = pendingAction === "believe";
      setLastStakeAction(pendingAction);
      
      if (needsApproval(amount)) {
        await approve(amount);
        return;
      }
      await stake(delulu.id, amount, isBeliever);
    } catch (error) {
      console.error("Stake error:", error);

      let errorMsg = "Failed to stake";
      if (error instanceof Error) {
        const errorLower = error.message.toLowerCase();

        if (
          errorLower.includes("user rejected") ||
          errorLower.includes("user denied")
        ) {
          errorMsg = "Transaction was cancelled";
        } else if (errorLower.includes("insufficient")) {
          errorMsg = "Insufficient balance";
        } else if (errorLower.includes("invalid")) {
          errorMsg = error.message;
        } else {
          errorMsg =
            error.message.length > 100
              ? "Transaction failed. Please try again."
              : error.message;
        }
      }

      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  };

  const isStaking =
    isPending || isConfirming || isApproving || isApprovingConfirming;
  const canStake =
    !delulu.isResolved &&
    new Date() < delulu.stakingDeadline &&
    !isCreator &&
    !hasStaked;
  const amount = parseFloat(stakeAmount);
  const needsApprovalForAmount = needsApproval(amount);


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-delulu-yellow border-t-2 border-delulu-dark/20 max-h-[90vh] overflow-hidden p-0 rounded-t-3xl [&>button]:text-delulu-dark [&>button]:bg-delulu-dark/10 [&>button]:hover:bg-delulu-dark/20"
      >
        <SheetTitle className="sr-only">
          {delulu ? `Delulu Details: ${delulu.content || delulu.contentHash}` : "Delulu Details"}
        </SheetTitle>
        <div className="relative flex flex-col overflow-y-auto pb-32">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            {/* Status Badge */}
            <div className="mb-4">
              <DeluluStatusBadge
                state={deluluState}
                isResolved={delulu.isResolved}
                isCancelled={delulu.isCancelled}
              />
            </div>
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
              <div
                className="relative w-32 h-32"
                style={{ filter: "drop-shadow(0 4px 0 #0a0a0a)" }}
              >
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#ffffff"
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
            {canStake && isConnected && showStakeInput && hasBalance && (
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
                  max={cusdBalance ? cusdBalance.formatted : undefined}
                  className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-delulu-dark text-delulu-dark font-bold text-lg focus:outline-none focus:ring-2 focus:ring-delulu-dark"
                  autoFocus
                />
                {isLoadingBalance ? (
                  <p className="text-xs text-delulu-dark/50 mt-2">
                    Loading balance...
                  </p>
                ) : cusdBalance ? (
                  <p className="text-xs text-delulu-dark/50 mt-2">
                    Available: {parseFloat(cusdBalance.formatted).toFixed(2)}{" "}
                    cUSD
                  </p>
                ) : null}
                {hasInsufficientBalance && (
                  <p className="text-sm text-red-600 mt-2 font-bold">
                    Insufficient balance
                  </p>
                )}
                {/* Potential Payout Display */}
                {potentialPayout !== null &&
                  !isLoadingPayout &&
                  stakeAmount &&
                  parseFloat(stakeAmount) > 0 && (
                    <div className="mt-4 p-4 rounded-2xl bg-delulu-green/10 border-2 border-delulu-green/30">
                      <p className="text-xs text-delulu-dark/50 mb-1">
                        Potential Payout
                      </p>
                      <p className="text-xl font-black text-delulu-green">
                        {potentialPayout.toFixed(2)} cUSD
                      </p>
                      <p className="text-xs text-delulu-dark/50 mt-1">
                        If you win, you&apos;ll receive this amount
                      </p>
                    </div>
                  )}
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

        {/* Already staked message */}
        {hasStaked && isConnected && !isCreator && (
          <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-delulu-yellow/95 backdrop-blur-sm border-t border-delulu-dark/10 z-50">
            <div className="w-full px-6 py-4 bg-delulu-dark/10 rounded-full text-center">
              <p className="text-sm font-bold text-delulu-dark">
                You&apos;ve already staked {userStakeAmount > 0
                  ? userStakeAmount < 0.01
                    ? userStakeAmount.toFixed(4)
                    : userStakeAmount.toFixed(2)
                  : "0.00"} cUSD as a {userIsBeliever ? "believer" : "doubter"}
              </p>
            </div>
          </div>
        )}

        {/* Insufficient Balance Message */}
        {canStake &&
          isConnected &&
          !isCreator &&
          !isLoadingBalance &&
          !hasBalance && (
            <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-delulu-yellow/95 backdrop-blur-sm border-t border-delulu-dark/10 z-50">
              <div className="w-full px-6 py-4 bg-red-100 rounded-full text-center">
                <p className="text-sm font-bold text-red-600">
                  Insufficient balance. You need cUSD to stake.
                </p>
              </div>
            </div>
          )}

        {/* Claim Button - shown when winnings are claimable */}
        {isClaimable &&
          isConnected &&
          !isLoadingClaimable &&
          delulu.isResolved && (
            <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-delulu-yellow/95 backdrop-blur-sm border-t border-delulu-dark/10 z-50">
              <button
                onClick={() => claim(delulu.id)}
                disabled={isClaiming || isClaimConfirming}
                className={cn(
                  "w-full px-6 py-4",
                  "bg-delulu-green rounded-full",
                  "text-white font-black text-lg",
                  "shadow-[0_4px_0_0_#0a0a0a]",
                  "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
                  "transition-all duration-150",
                  "disabled:opacity-70 disabled:shadow-[0_2px_0_0_#0a0a0a] disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isClaiming || isClaimConfirming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Claiming...</span>
                  </>
                ) : (
                  <span>Claim Winnings</span>
                )}
              </button>
            </div>
          )}

        {/* Floating Action Buttons - at bottom, floating on top */}
        {canStake && isConnected && !isCreator && hasBalance && !isClaimable && (
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
        message={`You've successfully staked ${stakeAmount} cUSD as a ${
          lastStakeAction === "believe" ? "believer" : "doubter"
        }!`}
        onClose={() => {
          setShowSuccessModal(false);
          setPendingAction(null);
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

      {/* Claim Success Modal */}
      <FeedbackModal
        isOpen={showClaimSuccessModal}
        type="success"
        title="Winnings Claimed! 🎉"
        message="Your winnings have been successfully claimed and sent to your wallet!"
        onClose={() => {
          setShowClaimSuccessModal(false);
        }}
        actionText="Done"
      />
    </Sheet>
  );
}
