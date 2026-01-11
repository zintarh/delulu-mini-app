"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useAccount } from "wagmi";
import { FeedbackModal } from "@/components/feedback-modal";
import { Slider } from "@/components/slider";
// import { DatePicker } from "@/components/date-picker";
import { useCreateDelulu } from "@/hooks/use-delulu-contract";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useCUSDBalance } from "@/hooks/use-cusd-balance";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/useUserStore";
import { GatekeeperStep } from "@/components/create/gatekeeper-step";
import { type GatekeeperConfig } from "@/lib/ipfs";
import {
  getErrorMessage,
  getDefaultDeadline,
  getMinDeadline,
  getMaxDeadline,
} from "@/lib/create-delulu-helpers";

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
    title: "Restrict Access?",
    subtitle: "Limit who can stake (optional)",
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
  const { user } = useUserStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [stakeAmount, setStakeAmount] = useState([1]);
  const [delusionText, setDelusionText] = useState("");
  const [gatekeeper, setGatekeeper] = useState<GatekeeperConfig | null>(null);
  const MAX_DELULU_LENGTH = 280;

  const PALETTE = [
    {
      id: "delulu",
      label: "The Delulu",
      bg: "bg-yellow-400",
      text: "text-black",
    },
    { id: "void", label: "The Void", bg: "bg-black", text: "text-white" },
    {
      id: "aura",
      label: "The Aura",
      bg: "bg-gradient-to-tr from-delulu-yellow-reserved to-delulu-yellow-reserved/80",
      text: "text-white",
    },
    { id: "bag", label: "The Bag", bg: "bg-emerald-900", text: "text-white" },
    { id: "cloud", label: "The Cloud", bg: "bg-gray-100", text: "text-black" },
    {
      id: "heat",
      label: "The Heat",
      bg: "bg-gradient-to-r from-orange-500 to-red-600",
      text: "text-white",
    },
  ];

  const [selectedPalette, setSelectedPalette] = useState(PALETTE[0]);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const {
    createDelulu,
    isPending: isCreating,
    isSuccess,
    isError,
    errorMessage: createErrorMessage,
    isConfirming,
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
    if (isError && createErrorMessage) {
      const friendlyMessage = getErrorMessage(new Error(createErrorMessage));
      setErrorMessage(friendlyMessage);
      setShowErrorModal(true);
    }
  }, [isError, createErrorMessage]);

  useEffect(() => {
    if (isApprovalSuccess) {
      const refetch = async () => {
        await refetchAllowance();
        await new Promise((resolve) => setTimeout(resolve, 500));
      };
      const timeoutId = setTimeout(() => {
        refetch();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isApprovalSuccess, refetchAllowance]);

  const [deadline, setDeadline] = useState<Date>(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 60); // Default to 60 minutes
    return date;
  });
  const [selectedDuration, setSelectedDuration] = useState<number>(60);

  const currentStakeAmount =
    stakeAmount[0] != null && isFinite(stakeAmount[0]) ? stakeAmount[0] : 1;

  const hasInsufficientBalance = cusdBalance
    ? parseFloat(cusdBalance.formatted) < currentStakeAmount
    : false;

  const canGoNext = () => {
    if (currentStep === 0)
      return (
        delusionText.trim().length > 0 &&
        delusionText.trim().length <= MAX_DELULU_LENGTH
      );
    if (currentStep === 1) return true;
    if (currentStep === 2)
      return currentStakeAmount >= 1 && !hasInsufficientBalance;
    if (currentStep === 3) return true;
    return false;
  };

  const handleNext = () => {
    if (canGoNext() && currentStep < 4) {
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
    setCurrentStep(0);
    setStakeAmount([1]);
    setDelusionText("");
    const date = new Date();
    date.setMinutes(date.getMinutes() + 60);
    setDeadline(date);
    setSelectedDuration(60);
    setGatekeeper(null);
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
          className="border-t-2 border-white/10 h-screen max-h-screen overflow-hidden p-0 rounded-t-3xl [&>button]:text-white [&>button]:bg-black/80 [&>button]:hover:bg-black/20 relative bg-black !animate-none !transition-none data-[state=open]:!slide-in-from-bottom-0 data-[state=closed]:!slide-out-to-bottom-0"
        >
          <div className="relative z-10 h-full flex flex-col [&_button[data-radix-dialog-close]]:z-[100]">
            <SheetTitle className="sr-only">Manifest</SheetTitle>
            <div className="relative h-full flex flex-col overflow-hidden">
              {/* Next Button - Top Left */}
              {currentStep < 4 && (
                <button
                  onClick={handleNext}
                  disabled={!canGoNext()}
                  className={cn(
                    "absolute top-4 left-4 z-[100] px-4 py-2 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition-colors",
                    !canGoNext() && "opacity-50 cursor-not-allowed"
                  )}
                >
                  Next
                </button>
              )}

              {currentStep !== 0 && (
                <>
                  <div className="absolute top-4 left-0 right-0 flex items-center justify-center gap-2 z-10 px-6">
                    {[0, 1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1 rounded-full transition-all duration-300 ${
                          step === currentStep
                            ? "w-12 bg-black"
                            : step < currentStep
                            ? "w-12 bg-black/80"
                            : "w-12 bg-black/20"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="absolute top-16 left-0 right-0 text-center px-6 z-10">
                    <p
                      className="text-sm font-bold text-white/80 "
                      style={{ fontFamily: "var(--font-gloria)" }}
                    >
                      {HYPE_TEXT[currentStep]?.subtitle || "Continue"}
                    </p>
                  </div>
                </>
              )}

              {/* Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {currentStep === 0 && (
                  <div className="flex-1 flex flex-col relative h-full">
                    {/* Canvas - Background (Full Height) */}
                    <div
                      className={cn(
                        "absolute inset-0 flex items-center justify-center",
                        selectedPalette.bg
                      )}
                    >
                      {/* Text Input - Centered */}
                      <div className="w-full max-w-2xl px-6 z-10">
                        <TextareaAutosize
                          placeholder="What is your delusion?"
                          value={delusionText}
                          onChange={(e) => {
                            if (e.target.value.length <= MAX_DELULU_LENGTH) {
                              setDelusionText(e.target.value);
                            }
                          }}
                          maxLength={MAX_DELULU_LENGTH}
                          className="w-full bg-transparent border-none outline-none text-4xl md:text-5xl font-bold text-center placeholder:opacity-50 resize-none leading-tight text-white focus:outline-none"
                          style={{
                            caretColor: "#ffffff",
                          }}
                          autoFocus
                        />
                      </div>

                      {/* Color Palette - Bottom Overlay */}
                      <div className="absolute bottom-0 left-0 right-0  py-6 z-20  bg-[#0a0a0a]">
                        <div className="grid grid-cols-6 justify-between items-center  ">
                          {PALETTE.map((palette) => (
                            <button
                              key={palette.id}
                              onClick={() => setSelectedPalette(palette)}
                              className={cn(
                                "flex-shrink-0 transition-all",
                                selectedPalette.id === palette.id
                                  ? "scale-110"
                                  : "opacity-70 hover:opacity-100"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-full",
                                  palette.bg
                                )}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 1 && (
                  <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 overflow-y-auto">
                    <div className="w-full max-w-2xl">
                      <h2 className="text-2xl font-black text-white/90 mb-6 text-center">
                        Staking Duration
                      </h2>
                      <div className="grid grid-cols-3 gap-3">
                        {[10, 20, 30, 40, 50, 60].map((minutes) => (
                          <button
                            key={minutes}
                            onClick={() => {
                              const date = new Date();
                              date.setMinutes(date.getMinutes() + minutes);
                              setDeadline(date);
                              setSelectedDuration(minutes);
                            }}
                            className={cn(
                              "py-4 px-6 rounded-lg font-bold text-lg transition-all border-2",
                              selectedDuration === minutes
                                ? "bg-delulu-yellow-reserved text-delulu-charcoal border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]"
                                : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                            )}
                          >
                            {minutes} min
                          </button>
                        ))}
                      </div>
                      <p className="text-sm text-white/50 text-center mt-4">
                        Max 1 hour
                      </p>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 overflow-y-auto">
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
                                const clampedValue = Math.max(
                                  1,
                                  Math.min(numValue, 10000)
                                );
                                setStakeAmount([clampedValue]);
                                console.log(
                                  "Stake amount set to:",
                                  clampedValue
                                );
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
                            className="text-6xl font-black text-delulu-dark bg-transparent border-none outline-none text-center w-auto inline-block [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:bg-black rounded-2xl px-4 transition-colors"
                            style={{
                              width: `${
                                Math.max(stakeAmount[0].toString().length, 2) *
                                0.75
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
                            const clamped = values.map((v) => Math.max(1, v));
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
                              {(() => {
                                const balance = parseFloat(
                                  cusdBalance.formatted
                                );
                                return isNaN(balance)
                                  ? "0.00"
                                  : balance.toFixed(2);
                              })()}{" "}
                              cUSD
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
                        {isConnected && currentStakeAmount < 1 && (
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
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 overflow-y-auto">
                    <div className="w-full max-w-2xl">
                      <GatekeeperStep
                        value={gatekeeper}
                        onChange={setGatekeeper}
                      />
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 overflow-y-auto">
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
                              {deadline instanceof Date &&
                              !isNaN(deadline.getTime())
                                ? deadline.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "Invalid date"}
                            </p>
                          </div>
                          <div className="w-px h-12 bg-black/20" />
                          <div>
                            <p className="text-xs text-delulu-dark/50 uppercase tracking-wide mb-1">
                              Stake
                            </p>
                            <p className="text-lg font-bold text-delulu-dark">
                              {stakeAmount[0] != null &&
                              isFinite(stakeAmount[0])
                                ? stakeAmount[0]
                                : "1.00"}{" "}
                              cUSD
                            </p>
                          </div>
                        </div>

                        {gatekeeper?.enabled && (
                          <div className="inline-block px-4 py-2 bg-[#0a0a0a] rounded-full border border-white/10">
                            <p className="text-xs font-bold text-delulu-dark">
                              {gatekeeper.label} Only
                            </p>
                          </div>
                        )}

                        <div className="inline-block px-6 py-3 bg-black/80 rounded-full">
                          <p className="text-sm font-bold text-delulu-dark">
                            Staking as BELIEVER
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 left-0 right-0 px-6 py-4 bg-black border-t border-white/10">
                {currentStep < 4 ? (
                  <div className="w-full max-w-md mx-auto flex items-center gap-4">
                    {currentStep > 0 && (
                      <button
                        onClick={handleBack}
                        className={cn(
                          "w-14 h-14",
                          "bg-black text-white",
                          "rounded-md border-2 border-black shadow-[3px_3px_0px_0px_#000000]",
                          "flex items-center justify-center"
                        )}
                      >
                        <ArrowLeft className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="w-full max-w-md mx-auto flex items-center gap-4">
                    <button
                      onClick={handleBack}
                      className={cn(
                        "w-14 h-14",
                        "bg-black text-white",
                        "rounded-md border-2 border-black shadow-[3px_3px_0px_0px_#000000]",
                        "flex items-center justify-center"
                      )}
                    >
                      <ArrowLeft className="w-6 h-6" />
                    </button>
                    {stakeAmount[0] != null &&
                    isFinite(stakeAmount[0]) &&
                    needsApproval(stakeAmount[0]) &&
                    !isApprovalSuccess &&
                    !isLoadingAllowance ? (
                      <button
                        onClick={() => {
                          if (
                            stakeAmount[0] != null &&
                            isFinite(stakeAmount[0])
                          ) {
                            approve(stakeAmount[0]);
                          }
                        }}
                        disabled={
                          isApproving ||
                          isApprovingConfirming ||
                          isLoadingAllowance
                        }
                        className={cn(
                          "flex-1",
                          "px-8 py-4",
                          "bg-black text-delulu-dark text-lg",
                          "rounded-md border-2 border-black shadow-[3px_3px_0px_0px_#000000]",
                          "flex items-center justify-center gap-2"
                        )}
                      >
                        {isApproving ||
                        isApprovingConfirming ||
                        isLoadingAllowance ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Approving...</span>
                          </>
                        ) : (
                          <span>Approve</span>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          if (isCreating || isConfirming) {
                            return;
                          }

                          try {
                            // Validate inputs
                            if (!delusionText.trim()) {
                              throw new Error("Please enter your delulu text");
                            }

                            if (
                              !isFinite(stakeAmount[0]) ||
                              stakeAmount[0] < 1
                            ) {
                              throw new Error(
                                "Stake amount must be at least 1 cUSD"
                              );
                            }

                            // Validate deadline
                            const deadlineDate =
                              deadline instanceof Date &&
                              !isNaN(deadline.getTime())
                                ? deadline
                                : getDefaultDeadline();

                            await createDelulu(
                              delusionText,
                              deadlineDate,
                              stakeAmount[0],
                              user?.username,
                              user?.pfpUrl,
                              gatekeeper
                            );
                          } catch (error) {
                            const friendlyMessage = getErrorMessage(error);
                            setErrorMessage(friendlyMessage);
                            setShowErrorModal(true);
                          }
                        }}
                        disabled={isCreating || isConfirming}
                        className={cn(
                          "flex-1",
                          "px-8 py-4",
                          "bg-black text-delulu-dark text-lg",
                          "rounded-md border-2 border-black shadow-[3px_3px_0px_0px_#000000]",
                          "flex items-center justify-center gap-2"
                        )}
                      >
                        {isCreating || isConfirming ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Creating...</span>
                          </>
                        ) : (
                          <span>Manifest</span>
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
