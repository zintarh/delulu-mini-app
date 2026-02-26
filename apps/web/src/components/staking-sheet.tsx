"use client";

import { useState, useEffect } from "react";
import { useApolloClient } from "@apollo/client/react";
import { refetchDeluluData } from "@/lib/graph/refetch-utils";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { FormattedDelulu } from "@/lib/types";
import { useStake } from "@/hooks/use-stake";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { TokenBadge } from "@/components/token-badge";
import { useUserPosition } from "@/hooks/use-user-position";
import { StakeSuccessSheet } from "@/components/stake-success-sheet";
import { StakeErrorSheet } from "@/components/stake-error-sheet";
import { Loader2, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDeluluCreator } from "@/lib/delulu-utils";
import { useAccount } from "wagmi";
import type { StakeSide } from "@/lib/types";
import { UserSetupModal } from "@/components/user-setup-modal";
import { useUserSetupCheck } from "@/hooks/use-user-setup-check";

interface StakingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delulu: FormattedDelulu | null;
}

export function StakingSheet({
  open,
  onOpenChange,
  delulu,
}: StakingSheetProps) {
  const { address } = useAccount();
  const apolloClient = useApolloClient();
  const [side, setSide] = useState<StakeSide>("believe");
  const [stakeAmount, setStakeAmount] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [stakedAmount, setStakedAmount] = useState(0);
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);
  const { needsSetup, isChecking } = useUserSetupCheck();

  // Show setup modal immediately when sheet opens if setup is needed
  // Close it when setup is no longer needed
  useEffect(() => {
    if (!isChecking) {
      if (open && needsSetup) {
        setShowUserSetupModal(true);
      } else if (!needsSetup) {
        setShowUserSetupModal(false);
      }
    }
  }, [open, needsSetup, isChecking]);

  const marketToken = delulu?.tokenAddress || undefined;
  
  // Ensure we have a token address - staking requires knowing which token to use
  if (!marketToken && delulu) {
    console.warn("[StakingSheet] Delulu missing tokenAddress:", delulu);
  }
  
  const { balance: tokenBalanceData, isLoading: isLoadingBalance } =
    useTokenBalance(marketToken);
  const tokenBalance = tokenBalanceData
    ? parseFloat(tokenBalanceData.formatted)
    : null;

  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    error: approvalError,
    refetchAllowance,
  } = useTokenApproval(marketToken);

  const {
    stake,
    isPending: isStaking,
    isConfirming: isStakingConfirming,
    isSuccess: isStakeSuccess,
    error: stakeError,
  } = useStake();

  // Check if user has already staked on this delulu
  // Use onChainId if available (contract expects on-chain ID), otherwise fall back to id
  const deluluIdForPosition = delulu?.onChainId 
    ? parseInt(delulu.onChainId, 10) 
    : delulu?.id || null;
  const {
    hasStaked,
    isBeliever: userIsBeliever,
    isLoading: isLoadingPosition,
  } = useUserPosition(deluluIdForPosition);

  // Reset form when sheet opens or closes
  useEffect(() => {
    if (open) {
      // Clear errors when sheet opens
      setShowErrorModal(false);
      setErrorMessage("");
      setSide("believe"); // Reset to default
    } else {
      // Reset everything when sheet closes
      setStakeAmount("");
      setShowSuccessModal(false);
      setShowErrorModal(false);
      setErrorMessage("");
      setStakedAmount(0);
      setSide("believe");
    }
  }, [open]);

  // Handle success
  useEffect(() => {
    if (isStakeSuccess) {
      const amount = stakeAmount ? parseFloat(stakeAmount) : 0;
      if (amount > 0) {
        setStakedAmount(amount);
        setShowSuccessModal(true);
        setStakeAmount("");
      }
      // Refetch delulu data after indexing delay
      const deluluId = delulu?.onChainId || delulu?.id;
      if (deluluId) {
        refetchDeluluData(apolloClient, deluluId);
      }
    }
  }, [isStakeSuccess, stakeAmount, delulu?.id, delulu?.onChainId, apolloClient]);

  // Handle errors
  useEffect(() => {
    if (stakeError) {
   
      let errorMsg = "Failed to stake";
      const errorMessage = stakeError.message || (stakeError as any)?.shortMessage || "";
      const errorLower = errorMessage.toLowerCase();

      if (
        errorLower.includes("user rejected") ||
        errorLower.includes("user denied") ||
        (stakeError as any)?.code === 4001
      ) {
        errorMsg = "Transaction was cancelled";
      } else if (errorLower.includes("insufficient")) {
        errorMsg = "Insufficient balance or approval. Please check your balance and ensure you've approved the contract.";
      } else if (errorLower.includes("deadline") || errorLower.includes("staking is closed")) {
        errorMsg = "Staking deadline has passed";
      } else if (errorLower.includes("resolved") || errorLower.includes("already resolved")) {
        errorMsg = "This delulu has already been resolved";
      } else if (errorLower.includes("cancelled") || errorLower.includes("was cancelled")) {
        errorMsg = "This delulu has been cancelled";
      } else if (errorLower.includes("creator") || errorLower.includes("cannot stake")) {
        errorMsg = "Creators cannot stake on their own delulu";
      } else if (errorLower.includes("not found") || errorLower.includes("delulu not found")) {
        errorMsg = "Delulu not found. Please refresh and try again.";
      } else if (errorLower.includes("too small") || errorLower.includes("minimum")) {
        errorMsg = "Stake amount is too small. Minimum stake is 1 token.";
      } else if (errorLower.includes("allowance") || errorLower.includes("approval") || errorLower.includes("approve")) {
        errorMsg = "Token approval required. Please approve the contract to spend your tokens.";
      } else if (errorLower.includes("slippage")) {
        errorMsg = "Slippage protection: payout would be less than expected. Try a smaller amount.";
      } else if (errorLower.includes("limit exceeded") || errorLower.includes("maximum")) {
        errorMsg = "You've reached the maximum stake limit for this delulu.";
      } else if (errorLower.includes("execution reverted") || errorLower.includes("revert")) {
        errorMsg = "Transaction failed. Please check your balance, approval, and try again.";
      } else if (errorMessage && errorMessage.length > 0 && errorMessage.length <= 200) {
        // Use the actual error message if it's reasonable length
        errorMsg = errorMessage;
      } else {
        errorMsg = "Staking failed. Please check your balance, approval, and try again.";
      }

      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  }, [stakeError, delulu?.id]);

  // When user re-opens staking after already staking, show a celebratory confetti
  useEffect(() => {
    if (!open || !hasStaked) return;

    (async () => {
      try {
        const confettiModule = await import("canvas-confetti");
        const confetti = confettiModule.default || confettiModule;
        if (typeof confetti === "function") {
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#22c55e", "#0ea5e9", "#f97316", "#a855f7"],
          });
        }
      } catch {
        // Confetti is purely visual; ignore failures
      }
    })();
  }, [open, hasStaked]);



  useEffect(() => {
    if (approvalError) {
      let errorMsg = "Approval failed";
      if (approvalError.message) {
        const errorLower = approvalError.message.toLowerCase();
        if (
          errorLower.includes("user rejected") ||
          errorLower.includes("user denied")
        ) {
          errorMsg = "Approval was cancelled";
        } else if (errorLower.includes("insufficient")) {
          errorMsg = "Insufficient balance for approval";
        } else {
          errorMsg =
            approvalError.message.length > 100
              ? "Approval failed. Please try again."
              : approvalError.message;
        }
      }
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  }, [approvalError]);

  const handleStake = async () => {
    if (!delulu || !stakeAmount) {
      console.error("[StakingSheet] Missing delulu or stakeAmount");
      return;
    }

    // Check if user has already staked
    if (hasStaked) {
      setErrorMessage("You have already staked on this delulu");
      setShowErrorModal(true);
      return;
    }

 

    // Use onChainId if available (contract expects on-chain ID), otherwise fall back to id
    const deluluId = Number(delulu.onChainId )
    
    if (!deluluId || isNaN(deluluId) || deluluId <= 0) {
     
      setErrorMessage("Invalid delulu ID. Please refresh and try again.");
      setShowErrorModal(true);
      return;
    }

    

    const amount = parseFloat(stakeAmount);

    if (isNaN(amount) || amount <= 0) {
      console.error("[StakingSheet] Invalid amount:", stakeAmount);
      setErrorMessage("Please enter a valid amount");
      setShowErrorModal(true);
      return;
    }

    if (amount < 1) {
      console.error("[StakingSheet] Amount below minimum:", amount);
      setErrorMessage("Minimum stake is 1");
      setShowErrorModal(true);
      return;
    }

    if (tokenBalance !== null && amount > tokenBalance) {
      console.error("[StakingSheet] Insufficient balance:", {
        amount,
        tokenBalance,
      });
      setErrorMessage("Insufficient balance");
      setShowErrorModal(true);
      return;
    }

    try {
      const isBeliever = side === "believe";
      if (needsApproval(amount)) {
        if (!isApprovalSuccess) {
          await approve(amount);
          refetchAllowance();
          return; 
        }
      }

      await stake(deluluId, amount, isBeliever, marketToken);

      
    } catch (error) {
      console.error("[StakingSheet] Error in handleStake:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to stake. Please try again."
      );
      setShowErrorModal(true);
    }
  };











  const isCreator = isDeluluCreator(address, delulu);
  const isLoading =
    isApproving ||
    isApprovingConfirming ||
    isStaking ||
    isStakingConfirming ||
    isLoadingPosition ||
    isLoadingBalance;
  const stakeAmountNum = stakeAmount ? parseFloat(stakeAmount) : 0;

  // Validation errors - show error for invalid amounts (including < 1)
  const validationError = (() => {
    if (!stakeAmount || stakeAmount === "") return null;
    const amount = stakeAmountNum;
    if (isNaN(amount) || amount <= 0) return "Please enter a valid amount";
    if (amount < 1) return "Minimum stake is 1";
    if (tokenBalance !== null && !isLoadingBalance && amount > tokenBalance)
      return "Insufficient balance";
    return null;
  })();

  const hasInputError =
    validationError !== null && stakeAmount !== "" && stakeAmount !== "0";

  const canStake =
    !!marketToken &&
    !isLoading &&
    stakeAmount &&
    stakeAmountNum >= 1 &&
    !isCreator &&
    !validationError &&
    !hasStaked;

 
  if (!delulu) return null;

  const isBeliever = side === "believe";
  const ButtonIcon = isBeliever ? ThumbsUp : ThumbsDown;
  const description = isBeliever
    ? "Stake your belief in this delulu. If it comes true, you'll share in the rewards"
    : "Stake your doubt in this delulu. If it doesn't come true, you'll share in the rewards.";

  return (
    <>
      <ResponsiveSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Stake on Delulu"
        sheetClassName="border-t border-gray-200 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl bg-white"
        modalClassName="max-w-lg"
      >
        <div className="max-w-lg mx-auto pt-8 pb-8 px-6 lg:pt-6">
          {/* If user has already staked, show summary instead of staking UI */}
          {hasStaked ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-xs tracking-[0.35em] uppercase text-gray-400">
                Staked as
              </p>
              <p className="text-2xl font-black text-delulu-charcoal">
                {userIsBeliever ? "Believer" : "Doubter"}
              </p>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                You can only stake once per delulu. You&apos;re already locked in on this side of the market.
              </p>
            </div>
          ) : (
            <>
              {/* Segmented Control - Text Labels */}
              <div className="flex items-center justify-center gap-1 mb-6">
                <button
                  type="button"
                  onClick={() => setSide("believe")}
                  className={cn(
                    "px-6 py-3 rounded-full transition-colors relative flex items-center justify-center font-bold text-sm",
                    side === "believe"
                      ? "bg-gray-200 text-delulu-charcoal"
                      : "text-gray-400 hover:text-delulu-charcoal hover:bg-gray-100"
                  )}
                  aria-label="Believe"
                >
                  Believe
                </button>
                <button
                  type="button"
                  onClick={() => setSide("doubt")}
                  className={cn(
                    "px-6 py-3 rounded-full transition-colors relative flex items-center justify-center font-bold text-sm",
                    side === "doubt"
                      ? "bg-gray-200 text-delulu-charcoal"
                      : "text-gray-400 hover:text-delulu-charcoal hover:bg-gray-100"
                  )}
                  aria-label="Doubt"
                >
                  Doubt
                </button>
              </div>

              <p className="text-sm text-gray-500 mb-6">{description}</p>

              {/* Input Section - DeFi Style */}
              <div className="mb-6">
                <div
                  className={cn(
                    "bg-gray-50 rounded-2xl p-4 border transition-colors",
                    hasInputError ? "border-red-400" : "border-gray-200",
                    isBeliever && !hasInputError
                      ? "border-delulu-charcoal/30"
                      : ""
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Amount</span>
                    {tokenBalance !== null && marketToken && (
                      <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                        Balance: {tokenBalance.toFixed(2)}{" "}
                        <TokenBadge tokenAddress={marketToken} size="lg" showText={false} />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setStakeAmount(value);
                        if (showErrorModal) {
                          setShowErrorModal(false);
                          setErrorMessage("");
                        }
                      }}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={cn(
                        "flex-1 min-w-0 bg-transparent text-2xl font-bold focus:outline-none placeholder:text-gray-300",
                        hasInputError ? "text-red-500" : "text-delulu-charcoal"
                      )}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (tokenBalance !== null) {
                          setStakeAmount(tokenBalance.toFixed(2));
                        }
                      }}
                      disabled={isLoading || isCreator || tokenBalance === null}
                      className="flex-shrink-0 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-md text-xs font-bold text-delulu-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      MAX
                    </button>
                  </div>
                  
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (canStake && !isLoading) {
                    handleStake();
                  }
                }}
                disabled={!canStake || isLoading}
                className={cn(
                  "w-full py-3 font-bold text-sm transition-all rounded-md border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                  canStake && !isLoading
                    ? isBeliever
                      ? "bg-delulu-yellow-reserved text-delulu-charcoal hover:bg-delulu-yellow-reserved/90 active:scale-[0.98] cursor-pointer"
                      : "bg-gray-200 text-delulu-charcoal hover:bg-gray-300 active:scale-[0.98] cursor-pointer"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300 shadow-[3px_3px_0px_0px_#D1D5DB]"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isApproving || isApprovingConfirming
                      ? "Approving..."
                      : "Staking..."}
                  </span>
                ) : isApprovalSuccess ? (
                  <span className="flex items-center justify-center gap-2">
                    Continue
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <ButtonIcon className="w-5 h-5" />
                    {isBeliever ? "Believe" : "Doubt"}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </ResponsiveSheet>

      {/* Success Sheet */}
      <StakeSuccessSheet
        open={showSuccessModal}
        onOpenChange={(open) => {
          setShowSuccessModal(open);
          if (!open) {
            onOpenChange(false);
            setStakedAmount(0);
          }
        }}
        isBeliever={isBeliever}
        amount={stakedAmount}
        tokenAddress={delulu?.tokenAddress}
      />

      {/* Error Sheet */}
      <StakeErrorSheet
        open={showErrorModal}
        onOpenChange={setShowErrorModal}
        errorMessage={errorMessage}
      />

      {/* User Setup Modal */}
      <UserSetupModal
        open={showUserSetupModal}
        onOpenChange={(open) => {
          setShowUserSetupModal(open);
          // If user closes modal without completing, close the staking sheet
          if (!open && needsSetup) {
            onOpenChange(false);
          }
        }}
        onComplete={(username, email) => {
          // TODO: Save username and email when implementation is ready
          console.log("User setup completed:", { username, email });
          setShowUserSetupModal(false);
        }}
      />
    </>
  );
}