"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FormattedDelulu } from "@/hooks/use-delulus";
import { useStake } from "@/hooks/use-stake";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useCUSDBalance } from "@/hooks/use-cusd-balance";
import { StakeSuccessSheet } from "@/components/stake-success-sheet";
import { StakeErrorSheet } from "@/components/stake-error-sheet";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDeluluCreator } from "@/lib/delulu-utils";
import { useAccount } from "wagmi";

interface DoubtSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delulu: FormattedDelulu | null;
}

export function DoubtSheet({ open, onOpenChange, delulu }: DoubtSheetProps) {
  const { address } = useAccount();
  const [stakeAmount, setStakeAmount] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [stakedAmount, setStakedAmount] = useState(0);

  const { balance: cusdBalanceData, isLoading: isLoadingBalance } =
    useCUSDBalance();
  const cusdBalance = cusdBalanceData
    ? parseFloat(cusdBalanceData.formatted)
    : null;
  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    error: approvalError,
  } = useTokenApproval();

  const {
    stake,
    isPending: isStaking,
    isConfirming: isStakingConfirming,
    isSuccess: isStakeSuccess,
    error: stakeError,
  } = useStake();

  // Reset form when sheet opens or closes
  useEffect(() => {
    if (open) {
      // Clear errors when sheet opens
      setShowErrorModal(false);
      setErrorMessage("");
    } else {
      // Reset everything when sheet closes
      setStakeAmount("");
      setShowSuccessModal(false);
      setShowErrorModal(false);
      setErrorMessage("");
      setStakedAmount(0);
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
    }
  }, [isStakeSuccess, stakeAmount]);

  // Handle errors with comprehensive logging
  // Only show errors for actual transaction errors, not input validation
  useEffect(() => {
    if (stakeError) {
      // Comprehensive error logging
      console.error("[DoubtSheet] Stake error:", {
        error: stakeError,
        errorType: stakeError?.constructor?.name,
        errorCode: (stakeError as any)?.code,
        errorMessage: stakeError?.message,
        errorShortMessage: (stakeError as any)?.shortMessage,
        errorData: (stakeError as any)?.data,
        errorCause: (stakeError as any)?.cause,
        stack: (stakeError as any)?.stack,
        deluluId: delulu?.id,
      });

      let errorMsg = "Failed to stake";
      if (stakeError.message) {
        const errorLower = stakeError.message.toLowerCase();
        if (
          errorLower.includes("user rejected") ||
          errorLower.includes("user denied")
        ) {
          errorMsg = "Transaction was cancelled";
        } else if (errorLower.includes("insufficient")) {
          errorMsg = "Insufficient balance";
        } else if (errorLower.includes("deadline")) {
          errorMsg = "Staking deadline has passed";
        } else if (errorLower.includes("resolved")) {
          errorMsg = "This delulu has already been resolved";
        } else if (errorLower.includes("cancelled")) {
          errorMsg = "This delulu has been cancelled";
        } else if (errorLower.includes("creator")) {
          errorMsg = "Creators cannot stake on their own delulu";
        } else {
          errorMsg =
            stakeError.message.length > 100
              ? "Staking failed. Please try again."
              : stakeError.message;
        }
      }
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  }, [stakeError, delulu?.id]);

  useEffect(() => {
    if (approvalError) {
      // Comprehensive error logging
      console.error("[DoubtSheet] Approval error:", {
        error: approvalError,
        errorType: approvalError?.constructor?.name,
        errorCode: (approvalError as any)?.code,
        errorMessage: approvalError?.message,
        errorShortMessage: (approvalError as any)?.shortMessage,
        errorData: (approvalError as any)?.data,
      });

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
      console.error("[DoubtSheet] Missing delulu or stakeAmount");
      return;
    }

    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      console.error("[DoubtSheet] Invalid amount:", stakeAmount);
      setErrorMessage("Please enter a valid amount");
      setShowErrorModal(true);
      return;
    }

    if (amount < 1) {
      console.error("[DoubtSheet] Amount below minimum:", amount);
      setErrorMessage("Minimum stake is 1 cUSD");
      setShowErrorModal(true);
      return;
    }

    if (cusdBalance !== null && amount > cusdBalance) {
      console.error("[DoubtSheet] Insufficient balance:", { amount, cusdBalance });
      setErrorMessage("Insufficient balance");
      setShowErrorModal(true);
      return;
    }

    try {
      console.log("[DoubtSheet] Starting stake flow:", {
        deluluId: delulu.id,
        amount,
        needsApproval: needsApproval(amount),
        isApprovalSuccess,
      });

      // If approval succeeded, proceed with staking
      if (isApprovalSuccess) {
        console.log("[DoubtSheet] Approval already succeeded, proceeding to stake");
        await stake(delulu.id, amount, false);
      } else if (needsApproval(amount)) {
        // First step: approve
        console.log("[DoubtSheet] Approval needed, requesting approval");
        await approve(amount);
      } else {
        // No approval needed, stake directly
        console.log("[DoubtSheet] No approval needed, staking directly");
        await stake(delulu.id, amount, false);
      }
    } catch (error) {
      console.error("[DoubtSheet] Error in handleStake:", error);
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
    isApproving || isApprovingConfirming || isStaking || isStakingConfirming;
  const stakeAmountNum = stakeAmount ? parseFloat(stakeAmount) : 0;

  const validationError = (() => {
    if (!stakeAmount) return null;
    const amount = stakeAmountNum;
    if (isNaN(amount) || amount <= 0) return null;
    if (amount < 1) return "Minimum stake is 1 cUSD";
    if (cusdBalance !== null && amount > cusdBalance)
      return "Insufficient balance";
    return null;
  })();

  const canStake =
    !isLoading &&
    stakeAmount &&
    stakeAmountNum >= 1 &&
    !isCreator &&
    !validationError;
  
  // Safely check if approval is needed - only when we have a valid amount
  const needsApprovalStep = (() => {
    if (!delulu || !stakeAmount) return false;
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) return false;
    try {
      return needsApproval(amount);
    } catch (error) {
      console.warn("[DoubtSheet] Error checking approval:", error);
      return false;
    }
  })();

  if (!delulu) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="bg-gray-900 border-t border-gray-800 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
        >
          <SheetTitle className="sr-only">Doubt Delulu</SheetTitle>

          <div className="max-w-lg mx-auto pt-8 pb-8 px-6">
            {/* Close Button */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <span className="text-2xl">×</span>
            </button>

            {/* Description */}
            <p className="text-sm text-white/60 mb-6 pt-10">
              Stake your doubt in this delulu. If it doesn&apos;t come true, you&apos;ll
              share in the rewards.
            </p>

            {/* Status Box */}
            <div className="bg-gray-900 rounded-2xl p-4 mb-6 border border-gray-800">
              <p className="text-sm text-white/80 text-center break-words whitespace-pre-wrap">
                {delulu.content || delulu.contentHash}
              </p>
            </div>

            {/* Input Section - DeFi Style */}
            <div className="mb-6">
              <div
                className={`bg-gray-900 rounded-2xl p-4 border transition-colors ${
                  validationError ? "border-red-500/50" : "border-gray-800"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/60">Amount</span>
                  {cusdBalance !== null && (
                    <span className="text-xs text-white/60">
                      Balance: {cusdBalance.toFixed(2)} cUSD
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
                      // Clear error state when user starts typing
                      if (showErrorModal) {
                        setShowErrorModal(false);
                        setErrorMessage("");
                      }
                    }}
                    placeholder="0.00"
                    min="1"
                    step="0.01"
                    className={`flex-1 min-w-0 bg-transparent text-white text-2xl font-bold focus:outline-none placeholder:text-white/30 ${
                      validationError ? "text-red-400" : ""
                    }`}
                    disabled={isLoading || isCreator}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (cusdBalance !== null) {
                        setStakeAmount(cusdBalance.toFixed(2));
                      }
                    }}
                    disabled={isLoading || isCreator || cusdBalance === null}
                    className="flex-shrink-0 px-3 py-1.5 bg-gray-800 hover:bg-gray-900/20 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    MAX
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-white/60">cUSD</span>
                  {validationError && (
                    <span className="text-xs text-red-400 font-medium">
                      {validationError}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleStake}
              disabled={!canStake || isLoading}
              className={cn(
                "w-full py-3 font-bold text-sm",
                "btn-game",
                canStake && !isLoading
                  ? "bg-gray-900 text-delulu-dark"
                  : "bg-gray-900/20 text-white/40 cursor-not-allowed"
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
                "Continue"
              ) : (
                "Doubt"
              )}
            </button>

            {/* Footer */}
            <p className="text-xs text-white/40 text-center mt-4">
              Staking is final. Make sure you doubt this delulu!
            </p>
          </div>
        </SheetContent>
      </Sheet>

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
        isBeliever={false}
        amount={stakedAmount}
      />

      {/* Error Sheet */}
      <StakeErrorSheet
        open={showErrorModal}
        onOpenChange={setShowErrorModal}
        errorMessage={errorMessage}
      />
    </>
  );
}
