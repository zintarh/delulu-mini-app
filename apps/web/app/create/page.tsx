"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import {
 
  ArrowLeft,
} from "lucide-react";
import { useCreateDelusion } from "@/lib/hooks/use-delulu-contract";
import {
  useCheckAndApproveCUSD,
  parseCUSD,
  useCUSDBalance,
} from "@/lib/hooks/use-cusd-approval";
import {
  TransactionStatus,
  ApprovalFlow,
} from "@/components/transaction-status";
import { useAccount, useBalance } from "wagmi";
import { FeedbackModal } from "@/components/feedback-modal";
import { sepolia } from "wagmi/chains";
import { CUSD_CONTRACT_ADDRESS } from "@/lib/contracts/config";

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
  const {  isConnected } = useAccount();
  const [currentStep, setCurrentStep] = useState(0);
  const [stakeAmount, setStakeAmount] = useState([1]);
  const [delusionText, setDelusionText] = useState("");
  const { balance, balanceFormatted, isLoading: balanceLoading, error: balanceError } = useCUSDBalance();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
  

  const handleCreate = () => {
    try {
      const deadlineTimestamp = BigInt(
        Math.floor(new Date(deadline).getTime() / 1000)
      );

      creation.createDelusion(
        delusionText,
        deadlineTimestamp,
        stakeAmountBigInt,
        true
      );
    } catch (error) {
      console.error("Error creating delusion:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to create delusion");
      setShowErrorModal(true);
    }
  };

  useEffect(() => {
    if (creation.isSuccess) {
      setShowSuccessModal(true);
    }
    if (creation.error) {
      setErrorMessage(
        creation.error instanceof Error 
          ? creation.error.message 
          : "Transaction failed. Please try again."
      );
      setShowErrorModal(true);
    }
  }, [creation.isSuccess, creation.error]);




  const hasInsufficientBalance =
    balance !== undefined && balance < stakeAmountBigInt;
  const canCreate = !approval.needsApproval && !hasInsufficientBalance;

  const canGoNext = () => {
    if (currentStep === 0) return delusionText.trim().length > 0;
    if (currentStep === 1) return true;
    if (currentStep === 2) return stakeAmount[0] > 0 && !hasInsufficientBalance;
    return false;
  };

  const handleNext = () => {
    if (canGoNext() && currentStep < 3) {
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
                style={{ caretColor: '#0a0a0a' }}
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
                  caretColor: '#0a0a0a',
                  colorScheme: 'light'
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
                        return; // Allow empty while typing
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue) && numValue >= 0) {
                        const clampedValue = Math.min(numValue, 10000);
                        setStakeAmount([clampedValue]);
                      }
                    }}
                    onBlur={(e) => {
                      // Ensure valid value on blur
                      if (e.target.value === "" || parseFloat(e.target.value) <= 0) {
                        setStakeAmount([0.01]);
                      }
                    }}
                    min={0}
                    max={10000}
                    step="any"
                    className="text-6xl font-black text-delulu-dark bg-transparent border-none outline-none text-center w-auto inline-block [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:bg-delulu-dark/5 rounded-2xl px-4 transition-colors"
                    style={{ width: `${Math.max(stakeAmount[0].toString().length, 2) * 0.75}em` }}
                  />
                </div>
                <p className="text-xl text-delulu-dark/70 font-medium mt-2">cUSD</p>
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
                  Balance: {balanceLoading ? (
                    <span className="font-bold">Loading...</span>
                  ) : balanceError ? (
                    <span className="font-bold text-red-600">Error loading balance</span>
                  ) : (
                    <span className="font-bold">{balanceFormatted} cUSD</span>
                  )}
                </p>
                {hasInsufficientBalance && (
                  <p className="text-sm text-red-600 mt-2 font-bold">Insufficient balance</p>
                )}
                {!isConnected && (
                  <p className="text-xs text-delulu-dark/40 mt-1">Connect wallet to see balance</p>
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
                      {new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="w-px h-12 bg-delulu-dark/20" />
                  <div>
                    <p className="text-xs text-delulu-dark/50 uppercase tracking-wide mb-1">
                      Stake
                    </p>
                    <p className="text-lg font-bold text-delulu-dark">
                      ${stakeAmount[0].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              {approval.needsApproval && (
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4">
                  <ApprovalFlow
                    needsApproval={approval.needsApproval}
                    hasInfiniteApproval={approval.hasInfiniteApproval}
                    isPending={approval.isPending}
                    isConfirming={approval.isConfirming}
                    isSuccess={approval.isSuccess}
                    error={approval.error}
                    hash={approval.hash}
                    onApprove={() => approval.approve(stakeAmountBigInt)}
                    onApproveMax={approval.approveMax}
                  />
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={
                  !isConnected ||
                  !canCreate ||
                  creation.isPending ||
                  hasInsufficientBalance
                }
                className="w-full h-14 rounded-full bg-delulu-dark hover:bg-delulu-dark/90 text-white font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creation.isPending ? "CREATING..." : "CREATE DELUSION"}
              </button>

              {(creation.isPending ||
                creation.isConfirming ||
                creation.isSuccess ||
                creation.error) && (
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4">
                  <TransactionStatus
                    isPending={creation.isPending && !creation.isConfirming}
                    isConfirming={creation.isConfirming}
                    isSuccess={creation.isSuccess}
                    error={creation.error}
                    hash={creation.hash}
                    successMessage="Delusion manifested! Redirecting..."
                    errorMessage="Failed to create delusion"
                  />
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
          setShowSuccessModal(false);
          router.push("/");
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

