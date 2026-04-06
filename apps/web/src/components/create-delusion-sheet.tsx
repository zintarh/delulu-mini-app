"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, ChevronDown } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useAccount } from "wagmi";
import { useApolloClient } from "@apollo/client/react";
import { refetchAllActiveQueries } from "@/lib/graph/refetch-utils";
import { FeedbackModal } from "@/components/feedback-modal";
import { Slider } from "@/components/slider";
import { useCreateDelulu } from "@/hooks/use-delulu-contract";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { TokenBadge } from "@/components/token-badge";
import { useSupportedTokens } from "@/hooks/use-supported-tokens";
import { TOKEN_LOGOS } from "@/lib/constant";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/useUserStore";
import { GatekeeperStep } from "@/components/create/gatekeeper-step";
import { type GatekeeperConfig } from "@/lib/ipfs";
import { UserSetupModal } from "@/components/user-setup-modal";
import { useUserSetupCheck } from "@/hooks/use-user-setup-check";
import {
  getErrorMessage,
  getDefaultDeadline,
  getMinDeadline,
  getMaxDeadline,
} from "@/lib/create-delulu-helpers";
import { DateTimePicker } from "@/components/date-time-picker";

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
    subtitle: "Your stake buys your first shares — stake big, start strong",
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

/**
 * Estimate how many initial shares a G$ stake buys on the bonding curve.
 * Mirrors the contract's _sharesForBudget: sum(i² for i=1..N) / 16000 * 1.01 ≤ budgetG
 */
function estimateInitialShares(budgetG: number): number {
  if (budgetG <= 0) return 0;
  const FEE_FACTOR = 1.01;
  let shares = 0;
  for (let n = 1; n <= 2000; n++) {
    const sumSq = (n * (n + 1) * (2 * n + 1)) / 6;
    const total = (sumSq / 16000) * FEE_FACTOR;
    if (total <= budgetG) {
      shares = n;
    } else {
      break;
    }
  }
  return shares;
}

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
  const apolloClient = useApolloClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [stakeAmount, setStakeAmount] = useState([0]);
  const [delusionText, setDelusionText] = useState("");
  const [gatekeeper, setGatekeeper] = useState<GatekeeperConfig | null>(null);
  const supportedTokens = useSupportedTokens();
  // Prefer G$ if available, otherwise use first token
  const initialToken = supportedTokens.find((t) => t.symbol === "G$")?.address ?? supportedTokens[0]?.address ?? "";
  const [selectedToken, setSelectedToken] = useState<string>(initialToken);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);

  // Sync selectedToken when chain changes (e.g. mainnet → sepolia)
  useEffect(() => {
    const preferredToken = supportedTokens.find((t) => t.symbol === "G$")?.address ?? supportedTokens[0]?.address;
    if (preferredToken && selectedToken && !supportedTokens.some((t) => t.address === selectedToken)) {
      setSelectedToken(preferredToken);
    } else if (preferredToken && !selectedToken) {
      setSelectedToken(preferredToken);
    }
  }, [supportedTokens, selectedToken]);

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
  } = useTokenApproval(selectedToken);

  // Simple per-token balances using useTokenBalance
  const cusdToken = supportedTokens.find((t) => t.symbol === "USDm");
  const gToken = supportedTokens.find((t) => t.symbol === "G$");

  const cusd = useTokenBalance(cusdToken?.address);
  const good = useTokenBalance(gToken?.address);

  // Debug logging for balances
  useEffect(() => {
    console.log('[CreateDelusionSheet] Token balances:', {
      supportedTokens: supportedTokens.map(t => ({ symbol: t.symbol, address: t.address })),
      cusdToken: cusdToken?.address,
      gToken: gToken?.address,
      cusdBalance: cusd.balance?.value?.toString(),
      cusdFormatted: cusd.formatted,
      cusdLoading: cusd.isLoading,
      cusdError: cusd.error?.message,
      goodBalance: good.balance?.value?.toString(),
      goodFormatted: good.formatted,
      goodLoading: good.isLoading,
      goodError: good.error?.message,
      goodBalanceData: good.balance,
    });
  }, [supportedTokens, cusdToken, gToken, cusd, good]);

  const tokenBalances = [
    ...(cusdToken
      ? [
          {
            token: cusdToken,
            balance: cusd.balance,
            formatted: cusd.formatted,
            isLoading: cusd.isLoading,
            error: cusd.error,
          },
        ]
      : []),
    ...(gToken
      ? [
          {
            token: gToken,
            balance: good.balance,
            formatted: good.formatted,
            isLoading: good.isLoading,
            error: good.error,
          },
        ]
      : []),
  ];

  const selectedTokenBalance = tokenBalances.find(
    (tb) => tb.token.address === selectedToken
  );
  const tokenBalance = selectedTokenBalance?.balance;
  const isLoadingBalance = tokenBalances.some((tb) => tb.isLoading);

  useEffect(() => {
    if (isSuccess) {
      setShowSuccessModal(true);
      refetchAllActiveQueries(apolloClient);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("delulu:created"));
      }
    }
  }, [isSuccess, apolloClient]);

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
    return getDefaultDeadline();
  });

  const currentStakeAmount =
    stakeAmount[0] != null && isFinite(stakeAmount[0]) ? stakeAmount[0] : 0;

  const hasInsufficientBalance =
    currentStakeAmount > 0 && selectedTokenBalance?.balance
      ? parseFloat(selectedTokenBalance.formatted) < currentStakeAmount
      : false;

  const canGoNext = () => {
    if (currentStep === 0)
      return (
        delusionText.trim().length > 0 &&
        delusionText.trim().length <= MAX_DELULU_LENGTH
      );
    if (currentStep === 1) return true;
    if (currentStep === 2) {
      const stakeValid =
        currentStakeAmount === 0 || currentStakeAmount >= 100;
      return stakeValid && !hasInsufficientBalance;
    }
    if (currentStep === 3) return true;
    return false;
  };

  const handleNext = () => {
    if (canGoNext() && currentStep < 4) {
      console.log("Moving to next step. Current stakeAmount:", stakeAmount);
      // Stake is optional: we only enforce a minimum of 100 G$ when the user
      // actually chooses to stake a non-zero amount. Empty / 0 stays as 0.
      if (currentStep === 2 && stakeAmount[0] > 0 && stakeAmount[0] < 1) { // TODO: restore to 100 after testing
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
    setStakeAmount([0]);
    setDelusionText("");
    const preferredToken = supportedTokens.find((t) => t.symbol === "G$")?.address ?? supportedTokens[0]?.address ?? "";
    setSelectedToken(preferredToken);
    setIsTokenDropdownOpen(false);
    setDeadline(getDefaultDeadline());
    setGatekeeper(null);
    onOpenChange(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tokenDropdownRef.current &&
        !tokenDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTokenDropdownOpen(false);
      }
    };

    if (isTokenDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isTokenDropdownOpen]);

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
                        Staking Deadline
                      </h2>
                      <p className="text-sm text-white/60 text-center mb-6">
                        Select when staking will end for this delulu
                      </p>
                      <DateTimePicker
                        value={deadline}
                        onChange={(date) => {
                          if (date) {
                            setDeadline(date);
                          }
                        }}
                        minDate={getMinDeadline()}
                        maxDate={getMaxDeadline()}
                      />
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 overflow-y-auto">
                    <div className="w-full max-w-2xl space-y-8">
                      <div className="text-center">
                        <p className="text-xs text-delulu-dark/60 uppercase tracking-wide mb-3">
                          Market Currency
                        </p>
                        <div className="flex justify-center mb-6" ref={tokenDropdownRef}>
                          <div className="relative">
                            <button
                              onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                              className={cn(
                                "px-4 py-3 rounded-lg font-bold text-sm border-2 transition-all flex items-center gap-3 min-w-[200px] justify-between",
                                "bg-delulu-yellow-reserved text-delulu-charcoal border-delulu-charcoal hover:bg-delulu-yellow-reserved/90"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const selectedTokenInfo = supportedTokens.find(
                                    (t) => t.address === selectedToken
                                  );
                                  const selectedBalanceInfo = tokenBalances.find(
                                    (tb) => tb.token.address === selectedToken
                                  );
                                  const logoUrl = selectedToken
                                    ? TOKEN_LOGOS[selectedToken.toLowerCase()]
                                    : undefined;
                                  return (
                                    <>
                                      {logoUrl && (
                                        <img
                                          src={logoUrl}
                                          alt=""
                                          className="h-5 w-5 rounded-full"
                                        />
                                      )}
                                      <span>{selectedTokenInfo?.symbol || "Select"}</span>
                                      {isConnected && selectedBalanceInfo && (
                                        <span className="text-xs opacity-70 whitespace-nowrap">
                                          {selectedBalanceInfo.isLoading
                                            ? "..."
                                            : `${parseFloat(selectedBalanceInfo.formatted).toFixed(2)} ${selectedTokenInfo?.symbol || ""}`}
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  isTokenDropdownOpen && "rotate-180"
                                )}
                              />
                            </button>
                            {isTokenDropdownOpen && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg border-2 border-delulu-charcoal shadow-lg z-50 overflow-hidden">
                                {supportedTokens.map((t) => {
                                  const tokenBalanceInfo = tokenBalances.find(
                                    (tb) => tb.token.address.toLowerCase() === t.address.toLowerCase()
                                  );
                                  const balance = tokenBalanceInfo
                                    ? parseFloat(tokenBalanceInfo.formatted)
                                    : 0;
                                  const isLoading = tokenBalanceInfo?.isLoading ?? false;
                                  const logoUrl = TOKEN_LOGOS[t.address.toLowerCase()];
                                  const isSelected = selectedToken?.toLowerCase() === t.address.toLowerCase();
                                  
                                  // Debug logging for G$ specifically
                                  if (t.symbol === "G$") {
                                    console.log('[CreateDelusionSheet] G$ Balance Debug:', {
                                      tokenAddress: t.address,
                                      tokenBalanceInfo: tokenBalanceInfo ? {
                                        address: tokenBalanceInfo.token.address,
                                        formatted: tokenBalanceInfo.formatted,
                                        isLoading: tokenBalanceInfo.isLoading,
                                        error: tokenBalanceInfo.error?.message,
                                        balanceValue: tokenBalanceInfo.balance?.value?.toString(),
                                      } : null,
                                      allTokenBalances: tokenBalances.map(tb => ({
                                        symbol: tb.token.symbol,
                                        address: tb.token.address,
                                        formatted: tb.formatted,
                                      })),
                                    });
                                  }
                                  return (
                                    <button
                                      key={t.address}
                                      onClick={() => {
                                        setSelectedToken(t.address);
                                        setIsTokenDropdownOpen(false);
                                      }}
                                      className={cn(
                                        "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
                                        isSelected
                                          ? "bg-delulu-yellow-reserved text-delulu-charcoal font-bold"
                                          : "bg-white text-delulu-charcoal hover:bg-gray-100"
                                      )}
                                    >
                                      {logoUrl && (
                                        <img
                                          src={logoUrl}
                                          alt={t.symbol}
                                          className="h-5 w-5 rounded-full flex-shrink-0"
                                        />
                                      )}
                                      <div className="flex-1 flex items-center justify-between gap-2">
                                        <span className="font-bold">{t.symbol}</span>
                                        {isConnected && (
                                          <span className="text-xs opacity-70 whitespace-nowrap">
                                            {isLoading
                                              ? "..."
                                              : tokenBalanceInfo && parseFloat(tokenBalanceInfo.formatted) > 0
                                              ? `${parseFloat(tokenBalanceInfo.formatted).toFixed(2)} ${t.symbol}`
                                              : "0.00"}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
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
                                // Empty input represents no stake
                                setStakeAmount([0]);
                                return;
                              }
                              const numValue = parseFloat(value);
                              if (
                                !isNaN(numValue) &&
                                numValue >= 0 &&
                                numValue <= 10000
                              ) {
                                const clampedValue =
                                  numValue > 0
                                    ? Math.max(100, numValue)
                                    : 0;
                                setStakeAmount([clampedValue]);
                                console.log(
                                  "Stake amount set to:",
                                  clampedValue
                                );
                              }
                            }}
                            onBlur={(e) => {
                              const currentValue = parseFloat(e.target.value);
                              if (
                                e.target.value === "" ||
                                isNaN(currentValue) ||
                                currentValue < 0
                              ) {
                                setStakeAmount([0]);
                                console.log("Reset stake amount to 0");
                              } else {
                                const clampedValue =
                                  currentValue > 0
                                    ? Math.max(100, currentValue)
                                    : 0;
                                setStakeAmount([clampedValue]);
                                console.log(
                                  "Stake amount confirmed on blur:",
                                  clampedValue
                                );
                              }
                            }}
                            min={0}
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
                          <TokenBadge tokenAddress={selectedToken} size="md" />
                        </p>
                      </div>

                      <div className="px-8">
                        <Slider
                          value={stakeAmount}
                          onValueChange={(values) => {
                            const clamped = values.map((v) =>
                              v > 0 ? Math.max(100, v) : 0
                            );
                            setStakeAmount(clamped);
                          }}
                          min={0}
                          max={10000}
                          step={0.01}
                          className="delulu-slider"
                        />
                        <div className="flex justify-between text-sm text-delulu-dark/50 font-medium mt-4">
                          <span>100 G$</span>
                          <span>10,000 G$</span>
                        </div>
                      </div>

                      {/* Share estimate banner */}
                      {currentStakeAmount >= 1 && (
                        <div className="rounded-2xl bg-black/10 border border-black/10 px-5 py-4 text-center">
                          <p className="text-xs text-delulu-dark/50 uppercase tracking-widest mb-1 font-bold">
                            You start with
                          </p>
                          <p className="text-3xl font-black text-delulu-dark">
                            {estimateInitialShares(currentStakeAmount).toLocaleString()}
                          </p>
                          <p className="text-xs text-delulu-dark/60 mt-0.5">
                            initial shares · the more you stake, the stronger your position
                          </p>
                        </div>
                      )}

                      <div className="text-center">
                        <p className="text-sm text-delulu-dark/60">
                          {!isConnected ? (
                            <span className="font-bold text-delulu-dark/40">
                              Not connected
                            </span>
                          ) : isLoadingBalance ? (
                            <span className="font-bold">Loading...</span>
                          ) : selectedTokenBalance?.balance ? (
                            <span className="font-bold inline-flex items-center gap-2">
                              {parseFloat(selectedTokenBalance.formatted).toFixed(2)}{" "}
                              <TokenBadge tokenAddress={selectedToken} size="sm" />
                            </span>
                          ) : (
                            <span className="font-bold text-red-600">
                              Error loading balance
                            </span>
                          )}
                        </p>
                        {isConnected && !isLoadingBalance && !tokenBalance && (
                          <p className="text-xs text-delulu-dark/40 mt-1">
                            Check console for details
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
                                ? deadline.toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })
                                : "Invalid date"}
                            </p>
                          </div>
                          <div className="w-px h-12 bg-black/20" />
                          <div>
                            <p className="text-xs text-delulu-dark/50 uppercase tracking-wide mb-1">
                              Initial Shares
                            </p>
                            <p className="text-lg font-bold text-delulu-dark inline-flex items-center gap-2">
                              {estimateInitialShares(currentStakeAmount).toLocaleString()}
                            </p>
                            <p className="text-xs text-delulu-dark/40 mt-0.5">
                              {currentStakeAmount > 0 ? `${currentStakeAmount} ` : ""}
                              <TokenBadge tokenAddress={selectedToken} size="sm" />
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
                            if (!isFinite(stakeAmount[0])) {
                              throw new Error("Invalid stake amount");
                            }
                            if (
                              stakeAmount[0] > 0 &&
                              stakeAmount[0] < 1 // TODO: restore to 100 after testing
                            ) {
                              throw new Error(
                                "Minimum stake is 1 G$ or 0"
                              );
                            }

                            // Validate deadline
                            const deadlineDate =
                              deadline instanceof Date &&
                              !isNaN(deadline.getTime())
                                ? deadline
                                : getDefaultDeadline();

                            await createDelulu(
                              selectedToken,
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

      {/* User Setup Modal - only show when username is not set (needsSetup) */}
      <UserSetupModal
        open={showUserSetupModal && needsSetup}
        onOpenChange={(open) => {
          setShowUserSetupModal(open);
          // If user closes modal without completing, close the create sheet
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
