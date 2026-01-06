"use client";

import { useState, useEffect } from "react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { FormattedDelulu } from "@/hooks/use-delulus";
import { useStake } from "@/hooks/use-stake";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useCUSDBalance } from "@/hooks/use-cusd-balance";
import { StakeSuccessSheet } from "@/components/stake-success-sheet";
import { StakeErrorSheet } from "@/components/stake-error-sheet";
import { Loader2, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDeluluCreator } from "@/lib/delulu-utils";
import { useAccount } from "wagmi";

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
  const [side, setSide] = useState<"believe" | "doubt">("believe");
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
    }
  }, [isStakeSuccess, stakeAmount]);

  // Handle errors
  useEffect(() => {
    if (stakeError) {
      console.error("[StakingSheet] Stake error:", {
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
      console.error("[StakingSheet] Approval error:", {
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
      console.error("[StakingSheet] Missing delulu or stakeAmount");
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
      setErrorMessage("Minimum stake is 1 cUSD");
      setShowErrorModal(true);
      return;
    }

    if (cusdBalance !== null && amount > cusdBalance) {
      console.error("[StakingSheet] Insufficient balance:", {
        amount,
        cusdBalance,
      });
      setErrorMessage("Insufficient balance");
      setShowErrorModal(true);
      return;
    }

    try {
      console.log("[StakingSheet] Starting stake flow:", {
        deluluId: delulu.id,
        amount,
        side: side === "believe",
        needsApproval: needsApproval(amount),
        isApprovalSuccess,
      });

      const isBeliever = side === "believe";

      // If approval succeeded, proceed with staking
      if (isApprovalSuccess) {
        console.log(
          "[StakingSheet] Approval already succeeded, proceeding to stake"
        );
        await stake(delulu.id, amount, isBeliever);
      } else if (needsApproval(amount)) {
        // First step: approve
        console.log("[StakingSheet] Approval needed, requesting approval");
        await approve(amount);
      } else {
        // No approval needed, stake directly
        console.log("[StakingSheet] No approval needed, staking directly");
        await stake(delulu.id, amount, isBeliever);
      }
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
    isApproving || isApprovingConfirming || isStaking || isStakingConfirming;
  const stakeAmountNum = stakeAmount ? parseFloat(stakeAmount) : 0;

  // Validation errors - show error for invalid amounts (including < 1)
  const validationError = (() => {
    if (!stakeAmount || stakeAmount === "") return null;
    const amount = stakeAmountNum;
    if (isNaN(amount) || amount <= 0) return "Please enter a valid amount";
    if (amount < 1) return "Minimum stake is 1 cUSD";
    if (cusdBalance !== null && amount > cusdBalance)
      return "Insufficient balance";
    return null;
  })();

  // Check if input should be red (has validation error and user has typed something)
  const hasInputError =
    validationError !== null && stakeAmount !== "" && stakeAmount !== "0";

  const canStake =
    !isLoading &&
    stakeAmount &&
    stakeAmountNum >= 1 &&
    !isCreator &&
    !validationError;

  const needsApprovalStep = (() => {
    if (!delulu || !stakeAmount) return false;
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) return false;
    try {
      return needsApproval(amount);
    } catch (error) {
      console.warn("[StakingSheet] Error checking approval:", error);
      return false;
    }
  })();

  if (!delulu) return null;

  const isBeliever = side === "believe";
  const ButtonIcon = isBeliever ? ThumbsUp : ThumbsDown;
  const description = isBeliever
    ? "Stake your belief in this delulu. If it comes true, you'll share in the rewards."
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
          {/* Segmented Control - Text Labels */}
          <div className="flex items-center justify-center gap-1 mb-6">
            <button
              type="button"
              onClick={() => setSide("believe")}
              className={cn(
                "px-6 py-3 rounded-full transition-colors relative flex items-center justify-center font-bold text-base",
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
                "px-6 py-3 rounded-full transition-colors relative flex items-center justify-center font-bold text-base",
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
                isBeliever && !hasInputError ? "border-delulu-charcoal/30" : ""
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Amount</span>
                {cusdBalance !== null && (
                  <span className="text-xs text-gray-500">
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
                    if (cusdBalance !== null) {
                      setStakeAmount(cusdBalance.toFixed(2));
                    }
                  }}
                  disabled={isLoading || isCreator || cusdBalance === null}
                  className="flex-shrink-0 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-md text-xs font-bold text-delulu-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  MAX
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">cUSD</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleStake}
            disabled={!canStake || isLoading}
            className={cn(
              "w-full py-3 font-bold text-sm transition-all rounded-md border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
              canStake && !isLoading
                ? isBeliever
                  ? "bg-delulu-yellow-reserved text-delulu-charcoal hover:bg-delulu-yellow-reserved/90"
                  : "bg-gray-200 text-delulu-charcoal hover:bg-gray-300"
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
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5" />
                Continue
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <ButtonIcon className="w-5 h-5" />
                {isBeliever ? "Believe" : "Doubt"}
              </span>
            )}
          </button>
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
