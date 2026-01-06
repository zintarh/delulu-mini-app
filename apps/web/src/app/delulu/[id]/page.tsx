"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { useSingleDelulu } from "@/hooks/use-single-delulu";
import { useDeluluStakes } from "@/hooks/use-delulu-stakes";
import { DeluluStatusBadge } from "@/components/delulu-status-badge";
import { FeedbackModal } from "@/components/feedback-modal";
import { VerificationSheet } from "@/components/verification-sheet";
import { BelieveSheet } from "@/components/believe-sheet";
import { DoubtSheet } from "@/components/doubt-sheet";
import { StakingSheet } from "@/components/staking-sheet";
import { DeluluCard } from "@/components/delulu-card";
import { Loader2, ArrowLeft, ThumbsUp, ThumbsDown, X } from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";
import { isDeluluCreator } from "@/lib/delulu-utils";

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

export default function DeluluPage() {
  const router = useRouter();
  const params = useParams();
  const deluluId = params.id as string;
  
  const { isConnected, address } = useAccount();
  const [showFullContent, setShowFullContent] = useState(false);

  // Fetch delulu data
  const { delulu, isLoading: isLoadingDelulu } = useSingleDelulu(deluluId);

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
  
  // Only fetch user-specific data if connected
  const { balance: cusdBalance, isLoading: isLoadingBalance } = useCUSDBalance();
  const { hasStaked, isBeliever: userIsBeliever, stakeAmount: userStakeAmount, isClaimed } = useUserPosition(
    isConnected && delulu?.id ? delulu.id : null
  );

  const { stateEnum: deluluState } = useDeluluState(delulu?.id || null);
  const { isClaimable, isLoading: isLoadingClaimable } = useClaimable(
    isConnected && delulu?.id ? delulu.id : null
  );
  const { claimableAmount, isLoading: isLoadingClaimableAmount } = useUserClaimableAmount(
    isConnected && delulu?.id ? delulu.id : null
  );
  const {
    claim,
    isPending: isClaiming,
    isConfirming: isClaimConfirming,
    isSuccess: isClaimSuccess,
    error: claimError,
  } = useClaimWinnings();

  const { data: stakes, isLoading: isLoadingStakes } = useDeluluStakes(
    delulu?.id ? String(delulu.id) : null
  );

  const leaderboard = useMemo(() => {
    if (!stakes || stakes.length === 0) return [];
    
    const grouped = stakes.reduce((acc, stake) => {
      const key = stake.user?.address || stake.userId;
      if (!acc[key]) {
        acc[key] = {
          address: stake.user?.address || "",
          username: stake.user?.username,
          believerStake: 0,
          doubterStake: 0,
          totalStake: 0,
        };
      }
      if (stake.side) {
        acc[key].believerStake += stake.amount;
      } else {
        acc[key].doubterStake += stake.amount;
      }
      acc[key].totalStake += stake.amount;
      return acc;
    }, {} as Record<string, { address: string; username?: string; believerStake: number; doubterStake: number; totalStake: number }>);

    return Object.values(grouped)
      .sort((a, b) => b.totalStake - a.totalStake)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [stakes]);

  const [stakeAmount, setStakeAmount] = useState("1");
  const [pendingAction, setPendingAction] = useState<"believe" | "doubt" | null>(null);
  const [lastStakeAction, setLastStakeAction] = useState<"believe" | "doubt" | null>(null);
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
  const [stakingSheetOpen, setStakingSheetOpen] = useState(false);

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
        else if (
          errorLower.includes("insufficient") ||
          errorLower.includes("balance too low")
        ) {
          errorMsg = "Insufficient cUSD balance";
        }
        else if (errorLower.includes("revert")) {
          const revertMatch = stakeError.message.match(
            /revert\s+(.+?)(?:\s|$)/i
          );
          if (revertMatch && revertMatch[1]) {
            const reason = revertMatch[1].trim();
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
        else if (
          errorLower.includes("gas") ||
          errorLower.includes("execution reverted")
        ) {
          errorMsg =
            "Transaction would fail. Please check your balance and try again.";
        }
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

  // Loading state
  if (isLoadingDelulu) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-32">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-500 hover:text-delulu-charcoal mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          
          <div className="space-y-4 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-32 bg-gray-100 rounded-2xl border border-gray-200" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 bg-gray-100 rounded-xl border border-gray-200" />
              <div className="h-20 bg-gray-100 rounded-xl border border-gray-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!delulu) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-32">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-500 hover:text-delulu-charcoal mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-2">Delulu not found</p>
            <p className="text-gray-400 text-sm">
              This delulu may have been removed or doesn&apos;t exist.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const total = delulu.totalBelieverStake + delulu.totalDoubterStake;
  const believerPercent =
    total > 0 ? Math.round((delulu.totalBelieverStake / total) * 100) : 0;

  const hasBalance = cusdBalance
    ? parseFloat(cusdBalance.formatted) > 0
    : false;

  const handleStakeClick = () => {
    setStakingSheetOpen(true);
  };

  const canStake =
    !delulu.isResolved &&
    new Date() < delulu.stakingDeadline &&
    !hasStaked;
  return (
    <div className="min-h-screen bg-white">
      {/* Header - Same as gallery step */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 py-4 flex items-center justify-between bg-white border-b border-gray-200">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-12 h-12 rounded-full text-black hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
          title="Back"
          aria-label="Back"
        >
          <ArrowLeft className="w-7 h-7" />
        </button>

        <h1
          className="text-4xl font-black text-delulu-yellow-reserved"
          style={{
            fontFamily: "var(--font-gloria), cursive",
            textShadow:
              "3px 3px 0px #000000, -2px -2px 0px #000000, 2px -2px 0px #000000, -2px 2px 0px #000000",
          }}
        >
          Delulu
        </h1>

        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-12 h-12 rounded-full text-black hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
          title="Close"
          aria-label="Close"
        >
          <X className="w-7 h-7" />
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-24 pb-32">
        {/* Delulu Card */}
        <div className="mb-8">
          {delulu && (
            <DeluluCard
              delusion={{
                ...delulu,
                content: delulu.content || undefined, 
              }}
              onStake={handleStakeClick}
            />
          )}
        </div>

        {/* Relevant Data */}
        <div className="space-y-4 mb-8">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <ThumbsUp className="w-5 h-5 text-gray-500" />
                <p className="text-xs text-gray-500">Believers</p>
              </div>
              <p className="text-lg font-black text-delulu-charcoal">
                {delulu.totalBelieverStake > 0
                  ? delulu.totalBelieverStake < 0.01
                    ? delulu.totalBelieverStake.toFixed(4)
                    : delulu.totalBelieverStake.toFixed(2)
                  : "0.00"}{" "}
                cUSD
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <ThumbsDown className="w-5 h-5 text-gray-500" />
                <p className="text-xs text-gray-500">Doubters</p>
              </div>
              <p className="text-lg font-black text-delulu-charcoal">
                {delulu.totalDoubterStake > 0
                  ? delulu.totalDoubterStake < 0.01
                    ? delulu.totalDoubterStake.toFixed(4)
                    : delulu.totalDoubterStake.toFixed(2)
                  : "0.00"}{" "}
                cUSD
              </p>
            </div>
          </div>

          {/* Progress Indicator */}
          {total > 0 && (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-500">Believers</span>
                </div>
                <span className="text-sm font-bold text-delulu-charcoal">{believerPercent}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-delulu-green rounded-full transition-all duration-300"
                  style={{ width: `${believerPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-400">Doubters</span>
                </div>
                <span className="text-xs text-gray-400">{100 - believerPercent}%</span>
              </div>
            </div>
          )}

          {/* Deadline */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Staking Deadline</p>
            <p className="text-base font-black text-delulu-charcoal">
              {formatTimeRemaining(delulu.stakingDeadline)} remaining
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {delulu.stakingDeadline.toLocaleDateString()} at{" "}
              {delulu.stakingDeadline.toLocaleTimeString()}
            </p>
          </div>

          {/* Claimable Amount */}
          {hasStaked && isConnected && claimableAmount > 0 && !isClaimed && (
            <div className="p-4 rounded-2xl bg-delulu-green/10 border border-delulu-green/30">
              <p className="text-xs text-delulu-charcoal/80 mb-1">
                {isLoadingClaimableAmount ? "Loading..." : "Claimable Amount"}
              </p>
              <p className="text-xl font-black text-delulu-charcoal">
                {isLoadingClaimableAmount 
                  ? "..." 
                  : claimableAmount > 0.01
                    ? claimableAmount.toFixed(2)
                    : claimableAmount.toFixed(4)}{" "}
                cUSD
              </p>
              <p className="text-xs text-gray-500 mt-1">Available to claim</p>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="mt-12">
          <h2 className="text-xl font-black text-delulu-charcoal mb-4">Leaderboard</h2>
          {isLoadingStakes ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-gray-50 border border-gray-200 animate-pulse"
                >
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.address}
                  className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-delulu-charcoal text-white flex items-center justify-center font-black text-sm">
                      {entry.rank}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-delulu-charcoal">
                        {entry.username ? `@${entry.username}` : formatAddress(entry.address)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {entry.believerStake > 0 && (
                          <span className="text-xs text-gray-600">
                            <ThumbsUp className="w-3 h-3 inline mr-1" />
                            {entry.believerStake.toFixed(2)} cUSD
                          </span>
                        )}
                        {entry.doubterStake > 0 && (
                          <span className="text-xs text-gray-600">
                            <ThumbsDown className="w-3 h-3 inline mr-1" />
                            {entry.doubterStake.toFixed(2)} cUSD
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-delulu-charcoal">
                      {entry.totalStake.toFixed(2)} cUSD
                    </p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-gray-50 border border-gray-200 text-center">
              <p className="text-sm text-gray-500">No stakes yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Already staked message */}
      {hasStaked && isConnected && (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-2 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-50">
          <div className="max-w-2xl mx-auto">
            <div className="w-full px-4 py-2 bg-gray-100 rounded-full text-center border border-gray-200">
              <p className="text-xs font-medium text-gray-600">
                You&apos;ve already staked {userStakeAmount > 0
                  ? userStakeAmount < 0.01
                    ? userStakeAmount.toFixed(4)
                    : userStakeAmount.toFixed(2)
                  : "0.00"} cUSD as a {userIsBeliever ? "believer" : "doubter"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Insufficient Balance Message */}
      {canStake &&
        isConnected &&
        !isLoadingBalance &&
        !hasBalance && (
          <div className="fixed bottom-0 left-0 right-0 px-4 py-2 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-50">
            <div className="max-w-2xl mx-auto">
              <div className="w-full px-4 py-2 bg-red-50 rounded-full text-center border border-red-200">
                <p className="text-xs font-medium text-red-600">
                  Insufficient balance. You need cUSD to stake.
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Claim Button */}
      {isClaimable &&
        isConnected &&
        !isLoadingClaimable &&
        claimableAmount > 0 &&
        !isClaimed &&
        (delulu.isResolved || delulu.isCancelled) && (
          <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-50">
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => claim(delulu.id)}
                disabled={isClaiming || isClaimConfirming || claimableAmount === 0}
                className={cn(
                  "w-full px-4 py-3",
                  "bg-delulu-green rounded-md",
                  "text-white font-black text-sm",
                  "border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                  "active:scale-[0.98]",
                  "transition-all duration-150 hover:bg-delulu-green/90",
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
          </div>
        )}

      {/* Stake Button */}
      {canStake && isConnected && hasBalance && !isClaimable && (
        <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-50">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleStakeClick}
              className={cn(
                "w-full px-4 py-3",
                "bg-delulu-yellow-reserved rounded-md",
                "text-delulu-charcoal font-black text-sm",
                "border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                "active:scale-[0.98]",
                "transition-all duration-150 hover:bg-delulu-yellow-reserved/90"
              )}
            >
              Stake
            </button>
          </div>
        </div>
      )}

      {/* Staking Sheet */}
      <StakingSheet
        open={stakingSheetOpen}
        onOpenChange={setStakingSheetOpen}
        delulu={delulu}
      />

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

      {/* Verification Sheet */}
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
            setIsVerified(true);
            setShowVerificationSheet(false);
            setStakingSheetOpen(true);
          }}
        />
      )}
    </div>
  );
}
