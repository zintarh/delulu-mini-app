"use client";

import { useState } from "react";
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
import { useAccount } from "wagmi";

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
  const { address, isConnected } = useAccount();

  const [currentStep, setCurrentStep] = useState(0);
  const [stakeAmount, setStakeAmount] = useState([100]);
  const [delusionText, setDelusionText] = useState("");
  const { balance, balanceFormatted } = useCUSDBalance();

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
    setTimeout(() => router.push("/"), 2000);
  });

  const handleCreate = () => {
    const deadlineTimestamp = BigInt(
      Math.floor(new Date(deadline).getTime() / 1000)
    );

    creation.createDelusion(
      delusionText,
      deadlineTimestamp,
      stakeAmountBigInt,
      true
    );
  };


  

  const hasInsufficientBalance =
    balance !== undefined && balance < stakeAmountBigInt;
  const canCreate = !approval.needsApproval && !hasInsufficientBalance;

  const canGoNext = () => {
    if (currentStep === 0) return delusionText.trim().length > 0;
    if (currentStep === 1) return true;
    if (currentStep === 2) return !hasInsufficientBalance;
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
            <div className="w-full max-w-2xl animate-fade-in space-y-12">
              <div className="text-center">
                <div className="text-8xl font-black text-delulu-dark mb-2">
                  ${stakeAmount[0]}
                </div>
                <p className="text-2xl text-delulu-dark/70 font-medium">cUSD</p>
              </div>
              
              <div className="px-8">
                <Slider
                  value={stakeAmount}
                  onValueChange={setStakeAmount}
                  min={5}
                  max={500}
                  step={5}
                  className="delulu-slider"
                />
                <div className="flex justify-between text-sm text-delulu-dark/50 font-medium mt-4">
                  <span>$5</span>
                  <span>$500</span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-delulu-dark/60">
                  Balance: <span className="font-bold">{balanceFormatted} cUSD</span>
                </p>
                {hasInsufficientBalance && (
                  <p className="text-sm text-red-600 mt-2 font-bold">Insufficient balance</p>
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
                      ${stakeAmount[0]}
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
    </div>
  );
}

