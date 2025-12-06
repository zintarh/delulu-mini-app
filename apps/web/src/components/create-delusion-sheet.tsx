"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Home } from "lucide-react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { FeedbackModal } from "@/components/feedback-modal";
import { Slider } from "@/components/slider";
import { DatePicker } from "@/components/date-picker";
import { useCreateDelulu } from "@/hooks/use-delulu-contract";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useCUSDBalance } from "@/hooks/use-cusd-balance";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/useUserStore";

const MAX_DELULU_LENGTH = 280; // Twitter character limit

const HYPE_TEXT = [
  {
    title: "Drop That Wild Claim",
    subtitle: "What's the delusion you're manifesting?",
    emoji: "✨",
  },
  {
    title: "When's Your Moment?",
    subtitle: "Set your deadline for glory or chaos",
  },
  {
    title: "Put Your Money Where Your Mouth Is",
    subtitle: "How much do you believe?",
  },
  {
    title: "Make It Official",
    subtitle: "Let's seal this delusion",
  },
];

interface CreateDelusionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDelusionSheet({
  open,
  onOpenChange,
}: CreateDelusionSheetProps) {
  const { isConnected, address } = useAccount();
  const router = useRouter();
  const { user } = useUserStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [stakeAmount, setStakeAmount] = useState([1]);
  const [delusionText, setDelusionText] = useState("");
  const MAX_DELULU_LENGTH = 280; // Twitter character limit

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const {
    createDelulu,
    isPending: isCreating,
    isConfirming,
    isSuccess,
    error: createError,
  } = useCreateDelulu();

  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    refetchAllowance,
    isLoadingAllowance,
  } = useTokenApproval();

  const { balance: cusdBalance, isLoading: isLoadingBalance } =
    useCUSDBalance();

  useEffect(() => {
    if (isSuccess) {
      setShowSuccessModal(true);
    }
  }, [isSuccess]);

  useEffect(() => {
    if (createError) {
      setErrorMessage(createError.message || "Failed to create delusion");
      setShowErrorModal(true);
    }
  }, [createError]);

  useEffect(() => {
    if (isApprovalSuccess) {
      // Refetch allowance and wait a bit for the blockchain state to update
      const refetch = async () => {
        await refetchAllowance();
        // Small delay to ensure the refetch completes and state updates
        await new Promise(resolve => setTimeout(resolve, 500));
      };
      refetch();
    }
  }, [isApprovalSuccess, refetchAllowance]);

  const getDefaultDeadline = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(12, 0, 0, 0);
    return date;
  };

  const getMinDeadline = () => {
    const date = new Date();
    date.setHours(date.getHours() + 24);
    return date;
  };

  const getMaxDeadline = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date;
  };

  const [deadline, setDeadline] = useState<Date>(getDefaultDeadline());

  const hasInsufficientBalance = cusdBalance
    ? parseFloat(cusdBalance.formatted) < stakeAmount[0]
    : false;

  const canGoNext = () => {
    if (currentStep === 0) return delusionText.trim().length > 0 && delusionText.trim().length <= MAX_DELULU_LENGTH;
    if (currentStep === 1) return true;
    if (currentStep === 2) return stakeAmount[0] >= 1 && !hasInsufficientBalance;
    return false;
  };

  const handleNext = () => {
    if (canGoNext() && currentStep < 3) {
      console.log("Moving to next step. Current stakeAmount:", stakeAmount);
      if (currentStep === 2 && (!stakeAmount[0] || stakeAmount[0] < 1)) {
        console.warn("Invalid stake amount detected, resetting to 1");
        setStakeAmount([1]);
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    setCurrentStep(0);
    setStakeAmount([1]);
    setDelusionText("");
    setDeadline(getDefaultDeadline());
    onOpenChange(false);
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    handleClose();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="bottom"
          className="border-t-2 border-delulu-dark/20 h-screen max-h-screen overflow-hidden p-0 rounded-t-3xl [&>button]:text-delulu-dark [&>button]:bg-delulu-dark/10 [&>button]:hover:bg-delulu-dark/20 relative"
          style={{
            backgroundImage: "url('/island2.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Yellow overlay */}
          <div className="absolute inset-0 bg-delulu-yellow/70 z-0" />
          <div className="relative z-10 h-full flex flex-col [&_button[data-radix-dialog-close]]:z-[100]">
            <SheetTitle className="sr-only">Create Delusion</SheetTitle>
            <div className="relative h-full flex flex-col overflow-y-auto">
            {/* Home Icon */}
            <button
              onClick={() => {
                handleClose();
                router.push("/");
              }}
              className={cn(
                "absolute top-4 left-4 z-20",
                "w-10 h-10",
                "bg-white text-delulu-dark",
                "btn-game",
                "flex items-center justify-center"
              )}
            >
              <Home className="w-5 h-5" />
            </button>

            <div className="absolute top-4 left-0 right-0 flex items-center justify-center gap-2 z-10 px-6">
              {[0, 1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    step === currentStep
                      ? "w-12 bg-delulu-dark"
                      : step < currentStep
                      ? "w-12 bg-delulu-dark/80"
                      : "w-12 bg-delulu-dark/20"
                  }`}
                />
              ))}
            </div>

            <div className="absolute top-16 left-0 right-0 text-center px-6 z-10">
              <p
                className="text-sm font-bold text-delulu-dark/80 "
                style={{ fontFamily: "var(--font-gloria)" }}
              >
                {HYPE_TEXT[currentStep].subtitle}
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 mt-20 overflow-y-auto">
              {currentStep === 0 && (
                <div className="w-full max-w-2xl">
                  <textarea
                    placeholder="Tap to type..."
                    value={delusionText}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_DELULU_LENGTH) {
                        setDelusionText(e.target.value);
                      }
                    }}
                    maxLength={MAX_DELULU_LENGTH}
                    className="w-full min-h-[200px] bg-transparent border-none outline-none text-3xl md:text-4xl font-bold text-delulu-dark text-center placeholder:text-delulu-dark/30 resize-none leading-tight caret-delulu-dark font-gloria"
                    autoFocus
                    style={{ caretColor: "#0a0a0a" }}
                  />
                  <div className="mt-4 text-center">
                    <span className={`text-sm ${
                      delusionText.length > MAX_DELULU_LENGTH * 0.9 
                        ? "text-red-500" 
                        : "text-delulu-dark/50"
                    }`}>
                      {delusionText.length}/{MAX_DELULU_LENGTH}
                    </span>
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="w-full max-w-2xl">
                  <DatePicker
                    value={deadline}
                    onChange={(date) => date && setDeadline(date)}
                    minDate={getMinDeadline()}
                    maxDate={getMaxDeadline()}
                  />
                  <p className="text-sm text-delulu-dark/50 text-center mt-6">
                    24h minimum • 1 year max
                  </p>
                </div>
              )}

              {currentStep === 2 && (
                <div className="w-full max-w-2xl space-y-8">
                  <div className="text-center">
                    <div className="relative inline-block">
                      <span className="text-6xl font-black text-delulu-dark">
                        $
                      </span>
                      <input
                        type="number"
                        value={stakeAmount[0]}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            setStakeAmount([1]);
                            return;
                          }
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue) && numValue >= 1) {
                            const clampedValue = Math.max(1, Math.min(numValue, 10000));
                            setStakeAmount([clampedValue]);
                            console.log("Stake amount set to:", clampedValue);
                          } else if (!isNaN(numValue) && numValue < 1) {
                            setStakeAmount([1]);
                          }
                        }}
                        onBlur={(e) => {
                          const currentValue = parseFloat(e.target.value);
                          if (
                            e.target.value === "" ||
                            isNaN(currentValue) ||
                            currentValue < 1
                          ) {
                            setStakeAmount([1]);
                            console.log("Reset stake amount to 1.00");
                          } else {
                            const clampedValue = Math.max(1, currentValue);
                            setStakeAmount([clampedValue]);
                            console.log(
                              "Stake amount confirmed on blur:",
                              clampedValue
                            );
                          }
                        }}
                        min={1}
                        max={10000}
                        step="0.01"
                        className="text-6xl font-black text-delulu-dark bg-transparent border-none outline-none text-center w-auto inline-block [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:bg-delulu-dark/5 rounded-2xl px-4 transition-colors"
                        style={{
                          width: `${
                            Math.max(stakeAmount[0].toString().length, 2) * 0.75
                          }em`,
                        }}
                      />
                    </div>
                    <p className="text-xl text-delulu-dark/70 font-medium mt-2">
                      cUSD
                    </p>
                  </div>

                  <div className="px-8">
                    <Slider
                      value={stakeAmount}
                      onValueChange={(values) => {
                        const clamped = values.map(v => Math.max(1, v));
                        setStakeAmount(clamped);
                      }}
                      min={1}
                      max={1000}
                      step={0.01}
                      className="delulu-slider"
                    />
                    <div className="flex justify-between text-sm text-delulu-dark/50 font-medium mt-4">
                      <span>$1.00</span>
                      <span>$1,000</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-delulu-dark/60">
                      {!isConnected ? (
                        <span className="font-bold text-delulu-dark/40">
                          Not connected
                        </span>
                      ) : isLoadingBalance ? (
                        <span className="font-bold">Loading...</span>
                      ) : cusdBalance ? (
                        <span className="font-bold">
                          {parseFloat(cusdBalance.formatted).toFixed(2)} cUSD
                        </span>
                      ) : (
                        <span className="font-bold text-red-600">
                          Error loading balance
                        </span>
                      )}
                    </p>
                    {isConnected && !isLoadingBalance && !cusdBalance && (
                      <p className="text-xs text-delulu-dark/40 mt-1">
                        Check console for details
                      </p>
                    )}
                    {isConnected && stakeAmount[0] < 1 && (
                      <p className="text-sm text-red-600 mt-2 font-bold">
                        Minimum stake is 1 cUSD
                      </p>
                    )}
                    {isConnected && hasInsufficientBalance && (
                      <p className="text-sm text-red-600 mt-2 font-bold">
                        Insufficient balance
                      </p>
                    )}
                    {!isConnected && (
                      <p className="text-xs text-delulu-dark/40 mt-1">
                        Connect wallet to see balance
                      </p>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="w-full max-w-2xl space-y-8">
                  <div className="text-center space-y-6">
                    <p className="text-3xl md:text-4xl font-gloria text-delulu-dark leading-tight italic">
                      &ldquo;{delusionText}&rdquo;
                    </p>

                    <div className="flex items-center justify-center gap-8 text-center">
                      <div>
                        <p className="text-xs text-delulu-dark/50 uppercase tracking-wide mb-1">
                          Deadline
                        </p>
                        <p className="text-lg font-bold text-delulu-dark">
                          {deadline.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="w-px h-12 bg-delulu-dark/20" />
                      <div>
                        <p className="text-xs text-delulu-dark/50 uppercase tracking-wide mb-1">
                          Stake
                        </p>
                        <p className="text-lg font-bold text-delulu-dark">
                          {stakeAmount[0]} cUSD
                        </p>
                      </div>
                    </div>

                    <div className="inline-block px-6 py-3 bg-delulu-dark/10 rounded-full">
                      <p className="text-sm font-bold text-delulu-dark">
                        Staking as BELIEVER
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 left-0 right-0 px-6 py-4 bg-delulu-yellow border-t border-delulu-dark/10">
              {currentStep < 3 ? (
                <div className="w-full max-w-md mx-auto flex items-center gap-4">
                  {currentStep > 0 && (
                    <button
                      onClick={handleBack}
                      className={cn(
                        "w-14 h-14",
                        "bg-delulu-dark text-white",
                        "btn-game",
                        "flex items-center justify-center"
                      )}
                    >
                      <ArrowLeft className="w-6 h-6" />
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    disabled={!canGoNext()}
                    className={cn(
                      "flex-1",
                      "px-8 py-4",
                      "bg-white text-delulu-dark text-lg",
                      "btn-game"
                    )}
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-md mx-auto flex items-center gap-4">
                  <button
                    onClick={handleBack}
                    className={cn(
                      "w-14 h-14",
                      "bg-delulu-dark text-white",
                      "btn-game",
                      "flex items-center justify-center"
                    )}
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  {needsApproval(stakeAmount[0]) && !isApprovalSuccess && !isLoadingAllowance ? (
                    <button
                      onClick={() => approve(stakeAmount[0])}
                      disabled={isApproving || isApprovingConfirming || isLoadingAllowance}
                      className={cn(
                        "flex-1",
                        "px-8 py-4",
                        "bg-white text-delulu-dark text-lg",
                        "btn-game",
                        "flex items-center justify-center gap-2"
                      )}
                    >
                      {isApproving || isApprovingConfirming || isLoadingAllowance ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Approving...</span>
                        </>
                      ) : (
                        <span>Approve cUSD</span>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          const deadlineDate = new Date(deadline);
                          await createDelulu(
                            delusionText,
                            deadlineDate,
                            stakeAmount[0],
                            user?.username,
                            user?.pfpUrl
                          );
                        } catch (error) {
                          setErrorMessage(
                            error instanceof Error
                              ? error.message
                              : "Failed to create delusion"
                          );
                          setShowErrorModal(true);
                        }
                      }}
                      disabled={isCreating || isConfirming}
                      className={cn(
                        "flex-1",
                        "px-8 py-4",
                        "bg-white text-delulu-dark text-lg",
                        "btn-game",
                        "flex items-center justify-center gap-2"
                      )}
                    >
                      {isCreating || isConfirming ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <span>CREATE DELUSION</span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Success Modal */}
      <FeedbackModal
        isOpen={showSuccessModal}
        type="success"
        title="Delusion Created! 🎉"
        message="Your delusion has been successfully manifested on the blockchain. Let's see if it comes true!"
        onClose={handleSuccessClose}
        actionText="View Delusions"
      />

      {/* Error Modal */}
      <FeedbackModal
        isOpen={showErrorModal}
        type="error"
        title="Oops! Something went wrong"
        message={errorMessage || "Failed to create delusion. Please try again."}
        onClose={() => {
          setShowErrorModal(false);
        }}
        actionText="Try Again"
      />
    </>
  );
}
