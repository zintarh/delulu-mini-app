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
import { useDeluluState } from "@/hooks/use-delulu-state";
import { useUserClaimableAmount } from "@/hooks/use-user-claimable-amount";
import { DeluluStatusBadge } from "@/components/delulu-status-badge";
import { FeedbackModal } from "@/components/feedback-modal";
import { VerificationSheet } from "@/components/verification-sheet";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDeluluCreator } from "@/lib/delulu-utils";

interface DeluluDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delulu: FormattedDelulu | null;
  onBelieve?: () => void;
  onDoubt?: () => void;
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
  onBelieve,
  onDoubt,
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
  const { hasStaked, isBeliever: userIsBeliever, stakeAmount: userStakeAmount, isClaimed } = useUserPosition(
    delulu?.id || null
  );

  const { stateEnum: deluluState } = useDeluluState(delulu?.id || null);
  const { isClaimable, isLoading: isLoadingClaimable } = useClaimable(
    delulu?.id || null
  );
  const { claimableAmount, isLoading: isLoadingClaimableAmount } = useUserClaimableAmount(
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
  const [errorTitle, setErrorTitle] = useState("Staking Failed");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showClaimSuccessModal, setShowClaimSuccessModal] = useState(false);
  const [showClaimErrorModal, setShowClaimErrorModal] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showVerificationSheet, setShowVerificationSheet] = useState(false);
  const [pendingStakeAction, setPendingStakeAction] = useState<"believe" | "doubt" | null>(null);

  // Calculate potential payout when user enters stake amount
  const { potentialPayout, isLoading: isLoadingPayout } = usePotentialPayout(
    delulu?.id || null,
    showStakeInput && stakeAmount ? parseFloat(stakeAmount) : null,
    pendingAction === "believe" ? true : pendingAction === "doubt" ? false : null
  );

  const isCreator = isDeluluCreator(address, delulu);

  // Reset verification state only when delulu changes or main sheet closes
  // Don't reset when verification sheet closes - we want to keep verified state
  useEffect(() => {
    if (!open || !delulu) {
      setIsVerified(false);
      setShowVerificationSheet(false);
    }
  }, [open, delulu?.id]);

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
      setShowClaimErrorModal(true);
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

  if (!delulu) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="bg-gray-900 border-t border-gray-800 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[60] rounded-t-3xl"
        >
          <SheetTitle className="sr-only">Delulu Details</SheetTitle>
          <div className="px-6 pt-6 pb-8">
            <div className="space-y-4 animate-pulse">
              <div className="h-6 bg-gray-800 rounded w-1/2" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
              <div className="h-32 bg-gray-900 rounded-2xl border border-gray-800" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 bg-gray-900 rounded-xl border border-gray-800" />
                <div className="h-20 bg-gray-900 rounded-xl border border-gray-800" />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

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
    // If verification is needed, show verification sheet first
    if (needsVerification) {
      setPendingStakeAction("believe");
      setShowVerificationSheet(true);
    } else {
      // If already verified, go directly to staking
      if (onBelieve) {
        onBelieve();
      }
    }
  };

  const handleDoubtClick = () => {
    // If verification is needed, show verification sheet first
    if (needsVerification) {
      setPendingStakeAction("doubt");
      setShowVerificationSheet(true);
    } else {
      // If already verified, go directly to staking
      if (onDoubt) {
        onDoubt();
      }
    }
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

  // Check if gatekeeper is enabled and user is not verified
  const isGated = delulu.gatekeeper?.enabled === true;
  const needsVerification = isGated && !isVerified;


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-gray-900 border-t border-gray-800 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[60] rounded-t-3xl"
      >
        <SheetTitle className="sr-only">
          {delulu ? `Delulu Details: ${delulu.content || delulu.contentHash}` : "Delulu Details"}
        </SheetTitle>
        <div className="max-w-lg mx-auto pt-6 pb-32 px-6">
          {/* Header */}
          <div className="mb-6">
            {/* Status Badge */}
            <div className="mb-4">
              <DeluluStatusBadge
                state={deluluState}
                isResolved={delulu.isResolved}
                isCancelled={delulu.isCancelled}
              />
            </div>
            <p className="text-xs text-white/50 mb-4">
              Created {delulu.createdAt ? delulu.createdAt.toLocaleDateString() : new Date(delulu.stakingDeadline).toLocaleDateString()}
            </p>

            {/* Content */}
            <div className="mb-6">
              <p className="text-base text-white leading-relaxed break-words whitespace-pre-wrap">
                {delulu.content || delulu.contentHash}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
                <p className="text-xs text-white/60 mb-1">Believers</p>
                <p className="text-lg font-black text-white">
                  {delulu.totalBelieverStake > 0
                    ? delulu.totalBelieverStake < 0.01
                      ? delulu.totalBelieverStake.toFixed(4)
                      : delulu.totalBelieverStake.toFixed(2)
                    : "0.00"}{" "}
                  cUSD
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
                <p className="text-xs text-white/60 mb-1">Doubters</p>
                <p className="text-lg font-black text-white">
                  {delulu.totalDoubterStake > 0
                    ? delulu.totalDoubterStake < 0.01
                      ? delulu.totalDoubterStake.toFixed(4)
                      : delulu.totalDoubterStake.toFixed(2)
                    : "0.00"}{" "}
                  cUSD
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/60">Believers</span>
                <span className="text-sm font-bold text-white">{believerPercent}%</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black rounded-full transition-all duration-300"
                  style={{ width: `${believerPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-white/50">Doubters</span>
                <span className="text-xs text-white/50">{100 - believerPercent}%</span>
              </div>
            </div>

            {/* Deadline */}
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800 mb-6">
              <p className="text-xs text-white/60 mb-1">
                Staking Deadline
              </p>
              <p className="text-base font-black text-white">
                {formatTimeRemaining(delulu.stakingDeadline)} remaining
              </p>
              <p className="text-xs text-white/50 mt-1">
                {delulu.stakingDeadline.toLocaleDateString()} at{" "}
                {delulu.stakingDeadline.toLocaleTimeString()}
              </p>
            </div>

            {/* Claimable Amount - shown when user has staked and there's something to claim */}
            {hasStaked && isConnected && claimableAmount > 0 && !isClaimed && (
              <div className="p-4 rounded-2xl bg-black/10 border border-black/20 mb-6">
                <p className="text-xs text-white/80 mb-1">
                  {isLoadingClaimableAmount ? "Loading..." : "Claimable Amount"}
                </p>
                <p className="text-xl font-black text-white">
                  {isLoadingClaimableAmount 
                    ? "..." 
                    : claimableAmount > 0.01
                      ? claimableAmount.toFixed(2)
                      : claimableAmount.toFixed(4)}{" "}
                  cUSD
                </p>
                <p className="text-xs text-white/60 mt-1">
                  Available to claim
                </p>
              </div>
            )}

            {/* Pot has been claimed message */}
            {hasStaked && isConnected && isClaimed && (delulu.isResolved || delulu.isCancelled) && (
              <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800 mb-6">
                <p className="text-xs text-white/60 mb-1">
                  Claim Status
                </p>
                <p className="text-base font-black text-white">
                  Pot has been claimed
                </p>
                <p className="text-xs text-white/50 mt-1">
                  Your winnings have been successfully claimed
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Creator message */}
        {isCreator && isConnected && (
          <div className="fixed bottom-0 left-0 right-0 px-4 py-2 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 z-50">
            <div className="w-full px-4 py-2 bg-gray-800 rounded-full text-center border border-gray-700">
              <p className="text-xs font-medium text-white/80">
                You can&apos;t stake on your own delusion
              </p>
            </div>
          </div>
        )}

        {/* Already staked message */}
        {hasStaked && isConnected && !isCreator && (
          <div className="fixed bottom-0 left-0 right-0 px-4 py-2 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 z-50">
            <div className="w-full px-4 py-2 bg-gray-800 rounded-full text-center border border-gray-700">
              <p className="text-xs font-medium text-white/80">
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
            <div className="fixed bottom-0 left-0 right-0 px-4 py-2 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 z-50">
              <div className="w-full px-4 py-2 bg-red-500/20 rounded-full text-center border border-red-500/30">
                <p className="text-xs font-medium text-red-400">
                  Insufficient balance. You need cUSD to stake.
                </p>
              </div>
            </div>
          )}

        {/* Claim Button - shown when winnings are claimable (resolved or cancelled) and not yet claimed */}
        {isClaimable &&
          isConnected &&
          !isLoadingClaimable &&
          claimableAmount > 0 &&
          !isClaimed &&
          (delulu.isResolved || delulu.isCancelled) && (
            <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 z-50">
              <button
                onClick={() => claim(delulu.id)}
                disabled={isClaiming || isClaimConfirming || claimableAmount === 0}
                className={cn(
                  "w-full px-4 py-3",
                  "bg-gray-800 rounded-full",
                  "text-white font-black text-sm",
                  "border border-gray-700",
                  "active:scale-[0.98]",
                  "transition-all duration-150 hover:bg-gray-900/15",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isClaiming || isClaimConfirming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Claiming...</span>
                  </>
                ) : (
                  <span>
                    Claim {claimableAmount > 0.01 
                      ? `${claimableAmount.toFixed(2)}` 
                      : claimableAmount.toFixed(4)} cUSD
                  </span>
                )}
              </button>
            </div>
          )}

        {/* Floating Action Buttons - shown for all users who can stake */}
        {/* Verification will be triggered when they click Believe/Doubt */}
        {canStake && isConnected && !isCreator && hasBalance && !isClaimable && (
          <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 flex gap-4 z-50">
            <button
              onClick={handleBelieveClick}
              className={cn(
                "flex-1 px-4 py-3",
                "bg-gray-800 rounded-full",
                "text-white font-black text-sm",
                "border border-gray-700",
                "active:scale-[0.98]",
                "transition-all duration-150 hover:bg-gray-900/15"
              )}
            >
              Believe
            </button>
            <button
              onClick={handleDoubtClick}
              className={cn(
                "flex-1 px-4 py-3",
                "bg-gray-800 rounded-full",
                "text-white font-black text-sm",
                "border border-gray-700",
                "active:scale-[0.98]",
                "transition-all duration-150 hover:bg-gray-900/15"
              )}
            >
              Doubt
            </button>
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

      {/* Error Modal - for staking errors */}
      <FeedbackModal
        isOpen={showErrorModal}
        type="error"
        title={errorTitle}
        message={errorMessage || "Failed to place stake. Please try again."}
        onClose={() => {
          setShowErrorModal(false);
        }}
        actionText="Try Again"
      />

      {/* Claim Error Modal */}
      <FeedbackModal
        isOpen={showClaimErrorModal}
        type="error"
        title="Claim Failed"
        message={errorMessage || "Failed to claim winnings. Please try again."}
        onClose={() => {
          setShowClaimErrorModal(false);
        }}
        actionText="Close"
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

      {/* Verification Sheet - Only render if gatekeeper value is strictly defined */}
      {delulu && 
       delulu.gatekeeper?.enabled && 
       delulu.gatekeeper?.value && 
       typeof delulu.gatekeeper.value === "string" &&
       delulu.gatekeeper.value.trim() !== "" && (
        <VerificationSheet
          open={showVerificationSheet}
          onOpenChange={setShowVerificationSheet}
          countryCode={delulu.gatekeeper.value}
          onVerified={() => {
            // Set verified state to true
            setIsVerified(true);
            // Close verification sheet
            setShowVerificationSheet(false);
            // Open the appropriate staking sheet based on pending action
            if (pendingStakeAction === "believe" && onBelieve) {
              setPendingStakeAction(null);
              onBelieve();
            } else if (pendingStakeAction === "doubt" && onDoubt) {
              setPendingStakeAction(null);
              onDoubt();
            }
          }}
        />
      )}
    </Sheet>
  );
}
