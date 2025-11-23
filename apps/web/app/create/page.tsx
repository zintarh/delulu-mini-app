"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Home, Loader2 } from "lucide-react";
import { useCreateDelusion } from "@/lib/hooks/use-delulu-contract";
import {
  parseCUSD,
  useCheckAndApproveCUSD,
  useCUSDBalanceContract,
} from "@/lib/hooks/use-cusd-approval";

import { useAccount } from "wagmi";
import { FeedbackModal } from "@/components/feedback-modal";

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

export default function CreatePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [currentStep, setCurrentStep] = useState(0);
  const [stakeAmount, setStakeAmount] = useState([1]);
  const [delusionText, setDelusionText] = useState("");
  const {
    balance,
    balanceFormatted,
    isLoading: balanceLoading,
    error: balanceError,
  } = useCUSDBalanceContract();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationTimeout, setConfirmationTimeout] = useState(false);

  const getDefaultDeadline = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 16);
  };

  const getMinDeadline = () => {
    const date = new Date();
    date.setHours(date.getHours() + 24);
    return date.toISOString().slice(0, 16);
  };

  const [deadline, setDeadline] = useState(getDefaultDeadline());

  const stakeAmountBigInt = parseCUSD(stakeAmount[0].toString());

  const approval = useCheckAndApproveCUSD(stakeAmountBigInt);

  const creation = useCreateDelusion((hash) => {
    console.log("Delusion created successfully:", hash);
  });

  // Debug modal states
  useEffect(() => {
    console.log("Modal states:", {
      showSuccessModal,
      showErrorModal,
      creationSuccess: creation.isSuccess,
    });
  }, [showSuccessModal, showErrorModal, creation.isSuccess]);

  const handleCreate = async () => {
    try {
      if (!delusionText || delusionText.trim().length === 0) {
        throw new Error("Please enter your delusion text");
      }

      if (!deadline) {
        throw new Error("Please select a deadline");
      }

      if (stakeAmount[0] <= 0) {
        throw new Error("Please enter a stake amount greater than 0");
      }

      if (hasInsufficientBalance) {
        throw new Error(
          "Insufficient balance. Please add more cUSD to your wallet."
        );
      }

      // Auto-approve max if needed (only happens once)
      if (approval.needsApproval) {
        console.log(
          "⏳ Approval needed. Current allowance:",
          approval.currentAllowance?.toString(),
          "Required:",
          stakeAmountBigInt.toString()
        );
        console.log(
          "📝 Calling approveMax to approve unlimited cUSD spending..."
        );
        approval.approveMax();
        return;
      }

      console.log(
        "✅ Approval check passed. Current allowance:",
        approval.currentAllowance?.toString()
      );
      if (
        approval.currentAllowance &&
        approval.currentAllowance < stakeAmountBigInt
      ) {
        throw new Error(
          `Insufficient allowance. Current: ${approval.currentAllowance.toString()}, Required: ${stakeAmountBigInt.toString()}. Please try approving again.`
        );
      }

      // Calculate duration in seconds from now until deadline
      const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const durationInSeconds = BigInt(deadlineTimestamp - currentTimestamp);

      if (durationInSeconds <= BigInt(0)) {
        throw new Error("Deadline must be in the future");
      }

      console.log("📝 Creating delusion with params:", {
        description: delusionText,
        durationInSeconds: durationInSeconds.toString(),
        stakeAmount: stakeAmountBigInt.toString(),
      });

      // Call contract with: description, durationInSeconds, stakeAmount
      creation.createDelusion(
        delusionText,
        durationInSeconds,
        stakeAmountBigInt
      );

      console.log("✅ createDelusion function called successfully");
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to create delusion. Please try again.";
      console.error("Setting error message:", errorMsg);
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  };

  useEffect(() => {
    if (creation.isSuccess) {
      console.log("✅ Transaction successful! Showing success modal");
      setShowSuccessModal(true);
    }

    if (creation.error) {
      console.error("❌ Creation error detected:", creation.error);

      let errorMsg = "Transaction failed. Please try again.";

      if (creation.error instanceof Error) {
        errorMsg = creation.error.message;

        // Handle common error patterns
        if (errorMsg.includes("User rejected")) {
          errorMsg =
            "Transaction was rejected. Please try again when you're ready.";
        } else if (errorMsg.includes("insufficient funds")) {
          errorMsg =
            "Insufficient balance. Please add more cUSD to your wallet.";
        } else if (
          errorMsg.includes("execution reverted") ||
          errorMsg.includes("cUSD transfer failed")
        ) {
          errorMsg =
            "Transaction failed. Please ensure:\n• You have approved the contract to spend cUSD\n• You have enough cUSD balance";
        }
      }

      console.error("📢 Showing error to user:", errorMsg);
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  }, [creation.isSuccess, creation.error]);

  // Handle approval errors
  useEffect(() => {
    if (approval.error) {
      console.error("❌ Approval error detected:", approval.error);

      let errorMsg = "Approval failed. Please try again.";

      if (approval.error instanceof Error) {
        errorMsg = approval.error.message;

        if (errorMsg.includes("User rejected")) {
          errorMsg =
            "Approval was rejected. Please try again when you're ready.";
        } else if (errorMsg.includes("insufficient funds")) {
          errorMsg = "Insufficient balance for gas fees.";
        }
      }

      console.error("📢 Showing approval error to user:", errorMsg);
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  }, [approval.error]);

  // Refetch allowance after successful approval
  useEffect(() => {
    if (approval.isSuccess) {
      console.log("✅ Approval successful! Refetching allowance...");
      setTimeout(() => {
        approval.refetchAllowance();
      }, 1000);
    }
  }, [approval.isSuccess, approval.refetchAllowance]);

  const hasInsufficientBalance =
    balance !== undefined && balance < stakeAmountBigInt;

  const canGoNext = () => {
    if (currentStep === 0) return delusionText.trim().length > 0;
    if (currentStep === 1) return true;
    if (currentStep === 2) return stakeAmount[0] > 0 && !hasInsufficientBalance;
    return false;
  };

  const handleNext = () => {
    if (canGoNext() && currentStep < 3) {
      console.log("Moving to next step. Current stakeAmount:", stakeAmount);
      // Ensure stake amount is valid before moving forward
      if (currentStep === 2 && (!stakeAmount[0] || stakeAmount[0] <= 0)) {
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

  return (
    <div className="min-h-screen bg-delulu-yellow relative overflow-hidden">
      {/* Back to Home Button */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-delulu-dark/10 hover:bg-delulu-dark/20 flex items-center justify-center transition-colors"
        aria-label="Back to home"
      >
        <Home className="w-5 h-5 text-delulu-dark" />
      </button>

      <div className="absolute top-4 left-0 right-0 flex items-center justify-center gap-2 z-10">
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

      <div className="absolute top-16 left-0 right-0 text-center px-6 z-10 animate-slide-down">
        <p className="text-lg font-schoolbell text-delulu-dark/80 tracking-wide animate-float">
          {HYPE_TEXT[currentStep].subtitle}
        </p>
      </div>

      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
        {currentStep === 0 && (
          <div className="w-full max-w-2xl animate-fade-in">
            <textarea
              placeholder="Tap to type..."
              value={delusionText}
              onChange={(e) => setDelusionText(e.target.value)}
              className="w-full min-h-[300px] bg-transparent border-none outline-none text-4xl md:text-5xl font-bold text-delulu-dark text-center placeholder:text-delulu-dark/30 resize-none leading-tight caret-delulu-dark font-gloria"
              autoFocus
              style={{ caretColor: "#0a0a0a" }}
            />
          </div>
        )}

        {currentStep === 1 && (
          <div className="w-full max-w-2xl animate-fade-in">
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={getMinDeadline()}
              className="w-full bg-transparent border-none outline-none text-2xl font-bold text-delulu-dark text-center caret-delulu-dark"
              style={{
                caretColor: "#0a0a0a",
                colorScheme: "light",
              }}
            />
            <p className="text-sm text-delulu-dark/50 text-center mt-6">
              24h minimum • 1 year max
            </p>
          </div>
        )}

        {currentStep === 2 && (
          <div className="w-full max-w-2xl animate-fade-in space-y-8">
            <div className="text-center">
              {/* Big editable input - serves as both display and input */}
              <div className="relative inline-block">
                <span className="text-6xl font-black text-delulu-dark">$</span>
                <input
                  type="number"
                  value={stakeAmount[0]}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "") {
                      setStakeAmount([0.01]);
                      return;
                    }
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue) && numValue >= 0) {
                      const clampedValue = Math.min(numValue, 10000);
                      setStakeAmount([clampedValue]);
                      console.log("Stake amount set to:", clampedValue);
                    }
                  }}
                  onBlur={(e) => {
                    const currentValue = parseFloat(e.target.value);
                    if (
                      e.target.value === "" ||
                      isNaN(currentValue) ||
                      currentValue <= 0
                    ) {
                      setStakeAmount([1]);
                      console.log("Reset stake amount to 1.00");
                    } else {
                      // Ensure the value is properly set even if it looks correct
                      setStakeAmount([currentValue]);
                      console.log(
                        "Stake amount confirmed on blur:",
                        currentValue
                      );
                    }
                  }}
                  min={0}
                  max={10000}
                  step="any"
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
                onValueChange={setStakeAmount}
                min={0.001}
                max={1000}
                step={0.001}
                className="delulu-slider"
              />
              <div className="flex justify-between text-sm text-delulu-dark/50 font-medium mt-4">
                <span>$0.001</span>
                <span>$1,000</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-delulu-dark/60">
                Balance:{" "}
                {!isConnected ? (
                  <span className="font-bold text-delulu-dark/40">
                    Not connected
                  </span>
                ) : balanceLoading ? (
                  <span className="font-bold">Loading...</span>
                ) : balanceError ? (
                  <span className="font-bold text-red-600">
                    Error loading balance
                  </span>
                ) : (
                  <span className="font-bold">
                    {Number(balanceFormatted).toFixed(2)} cUSD
                  </span>
                )}
              </p>
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
          <div className="w-full max-w-2xl animate-fade-in space-y-8">
            <div className="text-center space-y-6">
              <p className="text-3xl md:text-4xl font-bold text-delulu-dark leading-tight italic">
                "{delusionText}"
              </p>

              <div className="flex items-center justify-center gap-8 text-center">
                <div>
                  <p className="text-xs text-delulu-dark/50 uppercase tracking-wide mb-1">
                    Deadline
                  </p>
                  <p className="text-lg font-bold text-delulu-dark">
                    {new Date(deadline).toLocaleDateString("en-US", {
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

      <div className="absolute bottom-8 left-0 right-0 px-6 z-20">
        {currentStep < 3 ? (
          <div className="w-full max-w-md mx-auto flex items-center gap-4">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="w-14 h-14 rounded-full bg-delulu-dark/80 backdrop-blur-sm flex items-center justify-center hover:bg-delulu-dark transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className={`flex-1 h-14 rounded-full font-bold text-lg transition-all ${
                canGoNext()
                  ? "bg-delulu-dark hover:bg-delulu-dark/90 text-white"
                  : "bg-delulu-dark/20 text-delulu-dark/40 cursor-not-allowed"
              }`}
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md mx-auto space-y-4">
            {/* One-time approval message */}
            {approval.needsApproval &&
              !approval.isPending &&
              !approval.isConfirming && (
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 text-center">
                  <p className="text-sm font-bold text-delulu-dark mb-1">
                    🔒 One-Time Security Step
                  </p>
                  <p className="text-xs text-delulu-dark/70">
                    Approve cUSD spending once. Future stakes won't need this.
                  </p>
                </div>
              )}

            <button
              onClick={handleCreate}
              disabled={
                !isConnected ||
                approval.isPending ||
                approval.isConfirming ||
                creation.isPending ||
                creation.isConfirming ||
                hasInsufficientBalance
              }
              className="w-full h-14 rounded-full bg-delulu-dark hover:bg-delulu-dark/90 text-white font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {approval.isPending || approval.isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  APPROVING...
                </>
              ) : creation.isPending || creation.isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  CREATING...
                </>
              ) : approval.needsApproval ? (
                "APPROVE & CREATE"
              ) : (
                "CREATE DELUSION"
              )}
            </button>

            {/* Approval Status */}
            {(approval.isPending || approval.isConfirming || approval.error) &&
              !showErrorModal && (
                <div className="bg-delulu-dark text-white rounded-2xl p-4">
                  {approval.isPending && !approval.isConfirming && (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <div>
                        <p className="font-bold">Waiting for approval...</p>
                        <p className="text-sm text-white/70">
                          Confirm in your wallet
                        </p>
                      </div>
                    </div>
                  )}
                  {approval.isConfirming && (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <div>
                        <p className="font-bold">Approving cUSD...</p>
                        <p className="text-sm text-white/70">
                          Transaction confirming
                        </p>
                      </div>
                    </div>
                  )}
                  {approval.error && (
                    <div>
                      <p className="font-bold text-red-300">
                        ❌ Approval Failed
                      </p>
                      <p className="text-sm text-white/70 mt-1">
                        {approval.error instanceof Error
                          ? approval.error.message
                          : "Please try again"}
                      </p>
                    </div>
                  )}
                </div>
              )}

            {/* Creation Status */}
            {(creation.isPending || creation.isConfirming || creation.error) &&
              !showSuccessModal && (
                <div className="bg-delulu-dark text-white rounded-2xl p-4">
                  {creation.isPending && !creation.isConfirming && (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <div>
                        <p className="font-bold">Waiting for confirmation...</p>
                        <p className="text-sm text-white/70">
                          Confirm transaction in your wallet
                        </p>
                      </div>
                    </div>
                  )}
                  {creation.isConfirming && (
                    <div>
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <div className="flex-1">
                          <p className="font-bold">Creating delusion...</p>
                          <p className="text-sm text-white/70">
                            Transaction confirming on blockchain
                          </p>
                          {creation.hash && (
                            <a
                              href={`https://celo-sepolia.blockscout.com/tx/${creation.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-delulu-yellow hover:underline mt-1 inline-block"
                            >
                              View on Explorer ↗
                            </a>
                          )}
                        </div>
                      </div>
                      {confirmationTimeout && (
                        <div className="mt-3 p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                          <p className="text-sm text-yellow-200">
                            ⏰ Confirmation is taking longer than expected. Your
                            transaction has been submitted and is likely
                            processing. Check the explorer link above to verify.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {creation.error && (
                    <div>
                      <p className="font-bold text-red-300">
                        ❌ Creation Failed
                      </p>
                      <p className="text-sm text-white/70 mt-1">
                        {creation.error instanceof Error
                          ? creation.error.message
                          : "Transaction failed. Please try again."}
                      </p>
                    </div>
                  )}
                </div>
              )}

            {!isConnected && (
              <p className="text-sm text-delulu-dark/60 text-center">
                Please connect your wallet to create
              </p>
            )}
          </div>
        )}
      </div>

      {/* Success Modal */}
      <FeedbackModal
        isOpen={showSuccessModal}
        type="success"
        title="Delusion Created! 🎉"
        message="Your delusion has been successfully manifested on the blockchain. Let's see if it comes true!"
        onClose={() => {
          console.log("Success modal closed, redirecting to home");
          setShowSuccessModal(false);
          // Small delay to ensure smooth transition
          setTimeout(() => {
            router.push("/");
          }, 300);
        }}
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
    </div>
  );
}
