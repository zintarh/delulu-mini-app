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
import { StakeErrorSheet } from "@/components/stake-error-sheet";
import { Heart, Loader2 } from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";
import { isDeluluCreator } from "@/lib/delulu-utils";
import { useAccount } from "wagmi";
import type { StakeSide } from "@/lib/types";
import { UserSetupModal } from "@/components/user-setup-modal";
import { useUserSetupCheck } from "@/hooks/use-user-setup-check";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";

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
  const [stakeAmount, setStakeAmount] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);
  const { needsSetup, isChecking } = useUserSetupCheck();
  // Always use "believe" - v2 contract only supports believing
  const side: StakeSide = "believe";

  // Get creator username for title
  const creatorAddress = delulu?.creator as `0x${string}` | undefined;
  const { username: creatorUsername } = useUsernameByAddress(creatorAddress);
  const displayUsername = creatorUsername || delulu?.username || null;

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
    } else {
      // Reset everything when sheet closes
      setStakeAmount("");
      setShowErrorModal(false);
      setErrorMessage("");
    }
  }, [open]);

  // Handle success
  useEffect(() => {
    if (isStakeSuccess) {
      const amount = stakeAmount ? parseFloat(stakeAmount) : 0;
      if (amount > 0) {
        setStakeAmount("");

        // Confetti celebration for successful support
        (async () => {
          try {
            const confettiModule = await import("canvas-confetti");
            const confetti = confettiModule.default || confettiModule;
            if (typeof confetti === "function") {
              confetti({
                particleCount: 120,
                spread: 70,
                origin: { y: 0.6 },
                colors: ["#FCD34D", "#4B5563", "#A855F7"],
              });
            }
          } catch {
            // Confetti is purely visual; ignore failures
          }
        })();

        // Close the sheet after a successful support
        onOpenChange(false);
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

      let errorMsg = "Failed to support";
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
        errorMsg = "Support amount is too small. Minimum is 1 token.";
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
        errorMsg = "Support failed. Please check your balance, approval, and try again.";
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

    // Use onChainId if available (contract expects on-chain ID), otherwise fall back to id
    const rawId = delulu.onChainId ?? delulu.id;
    const deluluId =
      typeof rawId === "string" ? parseInt(rawId, 10) : Number(rawId);

    if (!deluluId || Number.isNaN(deluluId) || deluluId <= 0) {
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

    if (amount < 100) {
      console.error("[StakingSheet] Amount below minimum:", amount);
      setErrorMessage("Minimum support is 100 G$");
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
      if (needsApproval(amount)) {
        if (!isApprovalSuccess) {
          await approve(amount);
          refetchAllowance();
          return;
        }
      }

      await stake(deluluId, amount, marketToken);


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
    if (amount < 100) return "Minimum support is 100 G$";
    if (tokenBalance !== null && !isLoadingBalance && amount > tokenBalance)
      return "Insufficient balance";
    return null;
  })();

  // Only treat "insufficient balance" as a red/error state for the input.
  // Minimum amount and other validation issues should not turn the amount red.
  const hasInputError =
    typeof validationError === "string" &&
    validationError.toLowerCase().includes("insufficient");

  const canStake =
    !!marketToken &&
    !isLoading &&
    stakeAmount &&
    stakeAmountNum >= 100 &&
    !validationError;


  if (!delulu) return null;

  const description =
    "Send a little love to this delulu with a token of your support.";

  return (
    <>
      <ResponsiveSheet
        open={open}
        onOpenChange={onOpenChange}
        title={
          displayUsername
            ? `Support @${displayUsername}`
            : delulu?.creator
              ? `Support ${formatAddress(delulu.creator)}`
              : "Support"
        }
        sheetClassName="border-t border-border !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl bg-card"
        modalClassName="max-w-lg"
      >
        <div className="max-w-lg mx-auto pt-8 pb-8  lg:pt-6 text-foreground">
          <>
            <p className="text-sm text-muted-foreground mb-6">{description}</p>

            {/* Input Section - DeFi Style */}
            <div className="mb-6">
              <div
                className={cn(
                  "bg-muted rounded-2xl border px-6 py-2 transition-colors",
                  hasInputError ? "border-destructive" : "border-border"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Amount</span>
                  {tokenBalance !== null && marketToken && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
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
                      "flex-1 min-w-0 bg-transparent text-2xl font-bold focus:outline-none placeholder:text-muted-foreground",
                      hasInputError ? "text-destructive" : "text-foreground"
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
                    disabled={isLoading || tokenBalance === null}
                    className="flex-shrink-0 px-3 py-1.5 bg-secondary hover:bg-muted rounded-md text-xs font-bold text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                "w-full py-3 font-bold text-sm transition-all rounded-md border border-border",
                canStake && !isLoading
                  ? "bg-secondary text-foreground hover:bg-muted active:scale-[0.98] cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isApproving || isApprovingConfirming
                    ? "Approving..."
                    : "Supporting..."}
                </span>
              ) : isApprovalSuccess ? (
                <span className="flex items-center justify-center gap-2">
                  Continue
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Heart className="w-5 h-5 text-pink-500" />
                  Support
                </span>
              )}
            </button>
          </>
        </div>
      </ResponsiveSheet>

      {/* Error Sheet */}
      <StakeErrorSheet
        open={showErrorModal}
        onOpenChange={setShowErrorModal}
        errorMessage={errorMessage}
      />

      {/* User Setup Modal - only show when username is not set (needsSetup) */}
      <UserSetupModal
        open={showUserSetupModal && needsSetup}
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