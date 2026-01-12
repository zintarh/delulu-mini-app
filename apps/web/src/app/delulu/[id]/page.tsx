"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useUserStore } from "@/stores/useUserStore";
import { useStake } from "@/hooks/use-stake";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useCUSDBalance } from "@/hooks/use-cusd-balance";
import { useUserPosition } from "@/hooks/use-user-position";
import { useClaimable } from "@/hooks/use-claimable";
import { useClaimWinnings } from "@/hooks/use-claim-winnings";
import { useUserClaimableAmount } from "@/hooks/use-user-claimable-amount";
import { usePotentialPayoutForExistingStake } from "@/hooks/use-potential-payout-existing";
import { useSingleDelulu } from "@/hooks/use-single-delulu";
import { useDeluluStakes } from "@/hooks/use-delulu-stakes";
import { FeedbackModal } from "@/components/feedback-modal";
import { VerificationSheet } from "@/components/verification-sheet";
import { StakingSheet } from "@/components/staking-sheet";
import { DeluluCard } from "@/components/delulu-card";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { Loader2, ArrowLeft, ThumbsUp, ThumbsDown, X, Clock, Trophy } from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";

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
  const { user } = useUserStore();

  const { delulu, isLoading: isLoadingDelulu } = useSingleDelulu(deluluId);

  const {
    stake,

    isSuccess: isStakeSuccess,
    error: stakeError,
  } = useStake();

  const {
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    error: approvalError,
    refetchAllowance,
  } = useTokenApproval();

  // Only fetch user-specific data if connected
  const { balance: cusdBalance, isLoading: isLoadingBalance } =
    useCUSDBalance();
  const {
    hasStaked,
    isBeliever: userIsBeliever,
    stakeAmount: userStakeAmount,
    isClaimed,
  } = useUserPosition(isConnected && delulu?.id ? delulu.id : null);

  const { isClaimable, isLoading: isLoadingClaimable } = useClaimable(
    isConnected && delulu?.id ? delulu.id : null
  );
  const { claimableAmount, isLoading: isLoadingClaimableAmount } =
    useUserClaimableAmount(isConnected && delulu?.id ? delulu.id : null);
  const {
    claim,
    isPending: isClaiming,
    isConfirming: isClaimConfirming,
    isSuccess: isClaimSuccess,
    error: claimError,
  } = useClaimWinnings();

  const {
    data: stakes,
    isLoading: isLoadingStakes,
    refetch: refetchStakes,
  } = useDeluluStakes(deluluId || null);

  const leaderboard = useMemo(() => {
    if (!stakes || stakes.length === 0) return [];

    const grouped = stakes.reduce((acc, stake) => {
      const key = stake.user?.address || stake.userId;
      if (!acc[key]) {
        acc[key] = {
          address: stake.user?.address || "",
          username: stake.user?.username,
          pfpUrl: (stake.user as { pfpUrl?: string })?.pfpUrl,
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
    }, {} as Record<string, { address: string; username?: string; pfpUrl?: string; believerStake: number; doubterStake: number; totalStake: number }>);

    return Object.values(grouped)
      .sort((a, b) => b.totalStake - a.totalStake)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [stakes]);

  const [stakeAmount, setStakeAmount] = useState("1");
  const [pendingAction, setPendingAction] = useState<
    "believe" | "doubt" | null
  >(null);
  const [lastStakeAction, setLastStakeAction] = useState<
    "believe" | "doubt" | null
  >(null);
  const [lastStakeAmount, setLastStakeAmount] = useState<number>(0);
  const [showStakeInput, setShowStakeInput] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorTitle, setErrorTitle] = useState("Staking Failed");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showClaimSuccessModal, setShowClaimSuccessModal] = useState(false);
  const [showClaimErrorModal, setShowClaimErrorModal] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showVerificationSheet, setShowVerificationSheet] = useState(false);

  const [stakingSheetOpen, setStakingSheetOpen] = useState(false);

  // Get potential payout for active markets (for existing stakes - doesn't add stake to pool)
  const { potentialPayout: activeMarketPayout, isLoading: isLoadingActivePayout } = usePotentialPayoutForExistingStake(
    hasStaked && !delulu?.isResolved && !delulu?.isCancelled && delulu?.id ? delulu.id : null
  );

  // Calculate totals from actual stakes data (source of truth)
  // Must be called before any conditional returns (Rules of Hooks)
  const calculatedStats = useMemo(() => {
    if (!stakes || stakes.length === 0) {
      return {
        totalBelieverStake: delulu?.totalBelieverStake || 0,
        totalDoubterStake: delulu?.totalDoubterStake || 0,
      };
    }

    const believerTotal = stakes
      .filter((s) => s.side === true)
      .reduce((sum, s) => sum + s.amount, 0);

    const doubterTotal = stakes
      .filter((s) => s.side === false)
      .reduce((sum, s) => sum + s.amount, 0);

    return {
      totalBelieverStake: believerTotal,
      totalDoubterStake: doubterTotal,
    };
  }, [stakes, delulu?.totalBelieverStake, delulu?.totalDoubterStake]);

  // Determine which payout value to display based on market state
  const displayPayout = useMemo(() => {
    // For resolved/cancelled markets, use claimableAmount
    if (delulu?.isResolved || delulu?.isCancelled) {
      return claimableAmount;
    }
    // For active markets, use potentialPayout
    return activeMarketPayout;
  }, [delulu?.isResolved, delulu?.isCancelled, claimableAmount, activeMarketPayout]);

  const isLoadingPayout = delulu?.isResolved || delulu?.isCancelled
    ? isLoadingClaimableAmount
    : isLoadingActivePayout;

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
        setLastStakeAmount(amount);
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

  const queryClient = useQueryClient();
  useEffect(() => {
    if (isStakeSuccess) {
      setShowSuccessModal(true);
      setShowStakeInput(false);
      setStakeAmount("1");
      queryClient.invalidateQueries({ queryKey: ["delulu-stakes", deluluId] });
      queryClient.invalidateQueries({ queryKey: ["delulu", deluluId] });
      setTimeout(() => {
        refetchStakes();
      }, 1000);
    }
  }, [isStakeSuccess, queryClient, deluluId, refetchStakes]);

  // Handle claim success
  useEffect(() => {
    if (isClaimSuccess) {
      setShowClaimSuccessModal(true);
    }
  }, [isClaimSuccess]);

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
        } else if (
          errorLower.includes("insufficient") ||
          errorLower.includes("balance too low")
        ) {
          errorMsg = "Insufficient cUSD balance";
        } else if (errorLower.includes("revert")) {
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
        } else if (
          errorLower.includes("network") ||
          errorLower.includes("connection") ||
          errorLower.includes("timeout") ||
          errorLower.includes("block is out of range") ||
          errorLower.includes("synchronization") ||
          errorLower.includes("rpc")
        ) {
          errorMsg =
            "Network synchronization issue. The RPC node is catching up. Please wait a moment and try again.";
        } else if (
          errorLower.includes("gas") ||
          errorLower.includes("execution reverted")
        ) {
          errorMsg =
            "Transaction would fail. Please check your balance and try again.";
        } else {
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

  if (isLoadingDelulu) {
    return (
      <div className="min-h-screen bg-white">
        <div className="fixed top-0 left-0 right-0 z-50 px-4 py-4 flex items-center justify-between bg-white border-b border-gray-200">
          <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
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
          <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
        </div>

        <div className="max-w-4xl mx-auto px-4 pt-24 pb-32">
          <div className="mb-8">
            <DeluluCardSkeleton className="w-full" index={0} />
          </div>

          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
                <div className="h-6 bg-gray-200 rounded w-24" />
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
                <div className="h-6 bg-gray-200 rounded w-24" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <div className="h-3 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-8" />
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full mb-2" />
              <div className="flex items-center justify-between">
                <div className="h-3 bg-gray-200 rounded w-16" />
                <div className="h-3 bg-gray-200 rounded w-8" />
              </div>
            </div>

            {/* Deadline */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-5 bg-gray-200 rounded w-32 mb-1" />
              <div className="h-3 bg-gray-200 rounded w-40" />
            </div>
          </div>

          {isLoadingStakes && (
            <div className="mt-12">
              <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-gray-50 border border-gray-200 animate-pulse"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200" />
                        <div>
                          <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                          <div className="h-3 bg-gray-200 rounded w-32" />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="h-4 bg-gray-200 rounded w-16 mb-1" />
                        <div className="h-3 bg-gray-200 rounded w-12" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

  const total =
    calculatedStats.totalBelieverStake + calculatedStats.totalDoubterStake;
  const believerPercent =
    total > 0
      ? Math.round((calculatedStats.totalBelieverStake / total) * 100)
      : 0;

  const doubterPercent = total > 0 ? 100 - believerPercent : 0;

  const hasBalance = cusdBalance
    ? parseFloat(cusdBalance.formatted) > 0
    : false;

  const handleStakeClick = () => {
    setStakingSheetOpen(true);
  };

  const canStake =
    !delulu.isResolved && new Date() < delulu.stakingDeadline && !hasStaked;

  console.log(hasStaked, isLoadingClaimable, isClaimable);

  return (
    <div className="min-h-screen bg-white">
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

      <div className="max-w-4xl mx-auto px-4 pt-24 pb-2">
        {/* Delulu Card */}
        <div className="mb-4">
          {delulu && (
            <DeluluCard delusion={delulu} onStake={handleStakeClick} />
          )}
        </div>

        {/* Main Content Section */}
        <div className="space-y-4 mb-8">
          {/* User's Position - Fun & Visual */}
          {hasStaked && isConnected && delulu && !isClaimed && (
            <div className="rounded-xl border-2 border-delulu-charcoal bg-white p-4 shadow-[1px_1px_0px_0px_#1A1A1A]">
              <p className="text-xs font-black text-gray-500 uppercase mb-3">Your Position</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-full border-2 border-delulu-charcoal flex items-center justify-center ${
                    userIsBeliever ? "bg-delulu-yellow-reserved/20" : "bg-gray-100"
                  }`}>
                    {userIsBeliever ? (
                      <ThumbsUp className="w-7 h-7 text-delulu-charcoal" />
                    ) : (
                      <ThumbsDown className="w-7 h-7 text-delulu-charcoal" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">
                      {userIsBeliever ? "Believe" : "Doubt"}
                    </p>
                    <p className="text-lg font-black text-delulu-charcoal">
                      {userStakeAmount > 0
                        ? userStakeAmount < 0.01
                          ? userStakeAmount.toFixed(4)
                          : userStakeAmount.toFixed(2)
                        : "0.00"}{" "}
                      <span className="text-xs text-gray-500">cUSD</span>
                    </p>
                  </div>
                </div>
                {isLoadingPayout ? (
                  <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-0.5">
                      {delulu.isResolved ? "Payout" : "Potential Payout"}
                    </p>
                    <p className={`text-2xl font-black ${
                      (displayPayout ?? 0) > 0 
                        ? "text-delulu-yellow-reserved" 
                        : "text-gray-300"
                    }`}>
                      {(displayPayout ?? 0) > 0
                        ? (displayPayout ?? 0) < 0.01
                          ? (displayPayout ?? 0).toFixed(4)
                          : (displayPayout ?? 0).toFixed(2)
                        : "0.00"}
                    </p>
                    <p className="text-xs text-gray-500">cUSD</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Market Stats - Fun & Visual */}
          <div className="rounded-xl border-2 border-delulu-charcoal bg-white p-4 shadow-[1px_1px_0px_0px_#1A1A1A]">
            <p className="text-xs font-black text-gray-500 uppercase mb-3">Market Stats</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-gray-50 rounded-lg border-2 border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ThumbsUp className="w-5 h-5 text-delulu-charcoal" />
                  <p className="text-xs font-black text-gray-500">Believe</p>
                </div>
                <p className="text-xl font-black text-delulu-charcoal">
                  {calculatedStats.totalBelieverStake > 0
                    ? calculatedStats.totalBelieverStake < 0.01
                      ? calculatedStats.totalBelieverStake.toFixed(4)
                      : calculatedStats.totalBelieverStake.toFixed(2)
                    : "0.00"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg border-2 border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ThumbsDown className="w-5 h-5 text-delulu-charcoal" />
                  <p className="text-xs font-black text-gray-500">Doubt</p>
                </div>
                <p className="text-xl font-black text-delulu-charcoal">
                  {calculatedStats.totalDoubterStake > 0
                    ? calculatedStats.totalDoubterStake < 0.01
                      ? calculatedStats.totalDoubterStake.toFixed(4)
                      : calculatedStats.totalDoubterStake.toFixed(2)
                    : "0.00"}
                </p>
              </div>
            </div>

            {/* Progress Bar - Visual Only */}
            {total > 0 && (
              <div className="relative">
                <div className="w-full h-5 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-300">
                  <div
                    className="h-full bg-delulu-yellow-reserved rounded-full transition-all duration-300"
                    style={{ width: `${believerPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs font-black text-delulu-charcoal">
                    {believerPercent}%
                  </span>
                  <span className="text-xs font-black text-gray-500">{doubterPercent}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Outcome & Deadline - Side by Side */}
          <div className="grid grid-cols-2 gap-3">
            {/* Outcome */}
            {delulu.isResolved && (
              <div className="rounded-xl border-2 border-delulu-charcoal bg-white p-4 shadow-[1px_1px_0px_0px_#1A1A1A]">
                <p className="text-xs font-black text-gray-500 uppercase mb-2">Outcome</p>
                <div className="flex items-center gap-2 mb-2">
                  {delulu.outcome ? (
                    <ThumbsUp className="w-6 h-6 text-delulu-charcoal" />
                  ) : (
                    <ThumbsDown className="w-6 h-6 text-delulu-charcoal" />
                  )}
                </div>
                <p className="text-lg font-black text-delulu-charcoal">
                  {delulu.outcome ? "Believers" : "Doubters"} Won
                </p>
                {hasStaked && isConnected && (
                  <div className="flex items-center gap-1.5 mt-1">
                    {userIsBeliever === delulu.outcome && (
                      <Trophy className="w-4 h-4 text-green-600" />
                    )}
                    <p className={`text-xs font-medium ${
                      userIsBeliever === delulu.outcome 
                        ? "text-green-600" 
                        : "text-red-600"
                    }`}>
                      {userIsBeliever === delulu.outcome ? "You won!" : "You lost"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Deadline */}
            <div className="rounded-xl border-2 border-delulu-charcoal bg-white p-4 shadow-[1px_1px_0px_0px_#1A1A1A]">
              <p className="text-xs font-black text-gray-500 uppercase mb-2">Deadline</p>
             <div className="flex items-center gap-x-1">
             <div className="flex items-center gap-2 ">
                <Clock className="w-5 h-5 text-delulu-charcoal" />
              </div>
              <p className="text-lg font-black text-delulu-charcoal">
                {(() => {
                  if (delulu.isCancelled) return "Cancelled";
                  if (delulu.isResolved) return "Resolved";
                  const timeRemaining = formatTimeRemaining(delulu.stakingDeadline);
                  return timeRemaining === "Ended" ? "Ended" : timeRemaining;
                })()}
              </p>
             </div>
            </div>
          </div>

          {/* Claimed Status - Fun */}
          {hasStaked &&
            isConnected &&
            isClaimed &&
            (delulu.isResolved || delulu.isCancelled) && (
              <div className="rounded-xl border-2 border-delulu-charcoal bg-delulu-yellow-reserved/10 p-4 shadow-[1px_1px_0px_0px_#1A1A1A]">
                <p className="text-xs font-black text-delulu-charcoal uppercase mb-3">Claimed</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-black text-delulu-charcoal">
                      {claimableAmount !== null && claimableAmount > 0
                        ? claimableAmount < 0.01
                          ? claimableAmount.toFixed(4)
                          : claimableAmount.toFixed(2)
                        : "0.00"}{" "}
                      <span className="text-sm text-gray-600">cUSD</span>
                    </p>
                  </div>
                  <div className="text-3xl text-delulu-charcoal font-black">✓</div>
                </div>
              </div>
            )}
        </div>

        {/* Leaderboard - Only show if there's data or loading */}
        {(isLoadingStakes || leaderboard.length > 0) && (
          <div className="mt-12">
            <h2 className="text-xl font-black text-delulu-charcoal mb-4">
              Leaderboard
            </h2>
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
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry) => {
                  // Check if this entry belongs to the connected user
                  const isCurrentUser = address?.toLowerCase() === entry.address.toLowerCase();
                  
                  // Use connected user's profile data if available and it's their entry, otherwise use entry data
                  const displayUsername = isCurrentUser && user?.username 
                    ? user.username 
                    : entry.username || null;
                  const displayPfpUrl = isCurrentUser && user?.pfpUrl 
                    ? user.pfpUrl 
                    : entry.pfpUrl || null;
                  
                  return (
                  <div
                    key={entry.address}
                    className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {displayPfpUrl ? (
                        <img
                          src={displayPfpUrl}
                          alt={displayUsername || entry.address}
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-delulu-charcoal text-white flex items-center justify-center font-black text-sm">
                          {entry.rank}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-delulu-charcoal">
                          {displayUsername
                            ? `@${displayUsername}`
                            : formatAddress(entry.address)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {entry.believerStake > 0 && (
                            <span className="text-xs text-gray-600">
                              <ThumbsUp className="w-3 h-3 inline mr-1" />
                              {entry.believerStake < 0.01
                                ? entry.believerStake.toFixed(4)
                                : entry.believerStake.toFixed(2)}{" "}
                              cUSD
                            </span>
                          )}
                          {entry.doubterStake > 0 && (
                            <span className="text-xs text-gray-600">
                              <ThumbsDown className="w-3 h-3 inline mr-1" />
                              {entry.doubterStake < 0.01
                                ? entry.doubterStake.toFixed(4)
                                : entry.doubterStake.toFixed(2)}{" "}
                              cUSD
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-delulu-charcoal">
                        {entry.totalStake < 0.01
                          ? entry.totalStake.toFixed(4)
                          : entry.totalStake.toFixed(2)}{" "}
                        cUSD
                      </p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Insufficient Balance Message */}
      {canStake && isConnected && !isLoadingBalance && !hasBalance && (
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

      {/* Claim Button - Only show if user has staked AND isClaimable returns true from contract */}
      {hasStaked &&
        isConnected &&
        !isLoadingClaimable &&
        isClaimable &&
        !isClaimed &&
        (delulu.isResolved || delulu.isCancelled) && (
          <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-50">
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => claim(delulu.id, claimableAmount)}
                disabled={
                  isClaiming ||
                  isClaimConfirming ||
                  isLoadingClaimableAmount ||
                  claimableAmount === 0 ||
                  isClaimed
                }
                className={cn(
                  "w-full px-4 py-3",
                  "bg-delulu-yellow-reserved rounded-md",
                  "text-delulu-charcoal font-black text-sm",
                  "border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                  "active:scale-[0.98]",
                  "transition-all duration-150 hover:bg-delulu-yellow-reserved/90",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isClaiming || isClaimConfirming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Claiming...</span>
                  </>
                ) : isLoadingClaimableAmount ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : claimableAmount === 0 ? (
                  <span>No winnings to claim</span>
                ) : (
                  <span>
                    Claim{" "}
                    {claimableAmount > 0.01
                      ? `${claimableAmount.toFixed(2)}`
                      : claimableAmount.toFixed(4)}{" "}
                    cUSD
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

      {/* Stake Button */}
      {canStake && isConnected && hasBalance && (
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
        message={`You've successfully staked ${
          lastStakeAmount > 0
            ? lastStakeAmount < 0.01
              ? lastStakeAmount.toFixed(4)
              : lastStakeAmount.toFixed(2)
            : stakeAmount
        } cUSD as a ${lastStakeAction === "believe" ? "believer" : "doubter"}!`}
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
