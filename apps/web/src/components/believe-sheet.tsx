"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FormattedDelulu } from "@/hooks/use-delulus";
import { useStake } from "@/hooks/use-stake";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useCUSDBalance } from "@/hooks/use-cusd-balance";
import { FeedbackModal } from "@/components/feedback-modal";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDeluluCreator } from "@/lib/delulu-utils";
import { useAccount } from "wagmi";

interface BelieveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delulu: FormattedDelulu | null;
}

export function BelieveSheet({ open, onOpenChange, delulu }: BelieveSheetProps) {
  const { address } = useAccount();
  const [stakeAmount, setStakeAmount] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { balance: cusdBalanceData, isLoading: isLoadingBalance } = useCUSDBalance();
  const cusdBalance = cusdBalanceData ? parseFloat(cusdBalanceData.formatted) : null;
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

  // Reset form when sheet closes
  useEffect(() => {
    if (!open) {
      setStakeAmount("");
      setShowSuccessModal(false);
      setShowErrorModal(false);
      setErrorMessage("");
    }
  }, [open]);

  // Handle success
  useEffect(() => {
    if (isStakeSuccess) {
      setShowSuccessModal(true);
      setStakeAmount("");
    }
  }, [isStakeSuccess]);

  // Handle errors
  useEffect(() => {
    if (stakeError) {
      let errorMsg = "Failed to stake";
      if (stakeError.message) {
        const errorLower = stakeError.message.toLowerCase();
        if (errorLower.includes("user rejected") || errorLower.includes("user denied")) {
          errorMsg = "Transaction was cancelled";
        } else if (errorLower.includes("insufficient")) {
          errorMsg = "Insufficient balance";
        } else {
          errorMsg = stakeError.message.length > 100 
            ? "Staking failed. Please try again." 
            : stakeError.message;
        }
      }
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  }, [stakeError]);

  useEffect(() => {
    if (approvalError) {
      let errorMsg = "Approval failed";
      if (approvalError.message) {
        const errorLower = approvalError.message.toLowerCase();
        if (errorLower.includes("user rejected") || errorLower.includes("user denied")) {
          errorMsg = "Approval was cancelled";
        } else {
          errorMsg = approvalError.message.length > 100 
            ? "Approval failed. Please try again." 
            : approvalError.message;
        }
      }
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  }, [approvalError]);

  const handleStake = async () => {
    if (!delulu || !stakeAmount) return;
    
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage("Please enter a valid amount");
      setShowErrorModal(true);
      return;
    }

    if (amount < 1) {
      setErrorMessage("Minimum stake is 1 cUSD");
      setShowErrorModal(true);
      return;
    }

    if (cusdBalance !== null && amount > cusdBalance) {
      setErrorMessage("Insufficient balance");
      setShowErrorModal(true);
      return;
    }

    // If approval succeeded, proceed with staking
    if (isApprovalSuccess) {
      await stake(delulu.id, amount, true);
    } else if (needsApproval(amount)) {
      // First step: approve
      await approve(amount);
    } else {
      // No approval needed, stake directly
      await stake(delulu.id, amount, true);
    }
  };

  const isCreator = isDeluluCreator(address, delulu);
  const isLoading = isApproving || isApprovingConfirming || isStaking || isStakingConfirming;
  const stakeAmountNum = stakeAmount ? parseFloat(stakeAmount) : 0;
  
  // Validation errors
  const validationError = (() => {
    if (!stakeAmount) return null;
    const amount = stakeAmountNum;
    if (isNaN(amount) || amount <= 0) return null; // Don't show error for empty/invalid
    if (amount < 1) return "Minimum stake is 1 cUSD";
    if (cusdBalance !== null && amount > cusdBalance) return "Insufficient balance";
    return null;
  })();
  
  const canStake = !isLoading && stakeAmount && stakeAmountNum >= 1 && !isCreator && !validationError;
  const needsApprovalStep = delulu && stakeAmount ? needsApproval(parseFloat(stakeAmount) || 0) : false;

  if (!delulu) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="bg-delulu-dark border-t border-white/10 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
        >
          <SheetTitle className="sr-only">Believe in Delulu</SheetTitle>
          
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
              Stake your belief in this delulu. If it comes true, you'll share in the rewards.
            </p>

            {/* Status Box */}
            <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/10">
              <p className="text-sm text-white/80 text-center break-words whitespace-pre-wrap">
                {delulu.content || delulu.contentHash}
              </p>
            </div>

            {/* Input Section - DeFi Style */}
            <div className="mb-6">
              <div className={`bg-white/5 rounded-2xl p-4 border transition-colors ${
                validationError ? "border-red-500/50" : "border-white/10"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/60">Amount</span>
                  {cusdBalance !== null && (
                    <span className="text-xs text-white/60">
                      Balance: {cusdBalance.toFixed(2)} cUSD
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="0.00"
                    min="1"
                    step="0.01"
                    className={`flex-1 bg-transparent text-white text-2xl font-bold focus:outline-none placeholder:text-white/30 ${
                      validationError ? "text-red-400" : ""
                    }`}
                    disabled={isLoading || isCreator || false}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (cusdBalance !== null) {
                        setStakeAmount(cusdBalance.toFixed(2));
                      }
                    }}
                    disabled={isLoading || isCreator || cusdBalance === null}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  ? "bg-white text-delulu-dark"
                  : "bg-white/20 text-white/40 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isApproving || isApprovingConfirming ? "Approving..." : "Staking..."}
                </span>
              ) : isApprovalSuccess ? (
                "Continue"
              ) : (
                "Believe"
              )}
            </button>

            {/* Footer */}
            <p className="text-xs text-white/40 text-center mt-4">
              Staking is final. Make sure you believe in this delulu!
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Success Modal */}
      <FeedbackModal
        isOpen={showSuccessModal}
        type="success"
        title="Success!"
        message="You've successfully placed a stake as a believer."
        onClose={() => {
          setShowSuccessModal(false);
          onOpenChange(false);
        }}
      />

      {/* Error Modal */}
      <FeedbackModal
        isOpen={showErrorModal}
        type="error"
        title="Error"
        message={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />
    </>
  );
}

