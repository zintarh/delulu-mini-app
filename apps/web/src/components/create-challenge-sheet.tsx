"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useAccount } from "wagmi";
import { useApolloClient } from "@apollo/client/react";
import { refetchAllActiveQueries } from "@/lib/graph/refetch-utils";
import { FeedbackModal } from "@/components/feedback-modal";
import { useCreateChallenge } from "@/hooks/use-create-challenge";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { TokenBadge } from "@/components/token-badge";
import { useSupportedTokens } from "@/hooks/use-supported-tokens";
import { TOKEN_LOGOS } from "@/lib/constant";
import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { uploadToIPFS } from "@/lib/ipfs";
import * as Select from "@radix-ui/react-select";

interface CreateChallengeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const DURATION_OPTIONS = [
  { label: "Weekly", value: 7 * 24 * 60 * 60, display: "Weekly" },
  { label: "Bi-weekly", value: 14 * 24 * 60 * 60, display: "Bi-weekly" },
];

export function CreateChallengeSheet({
  open,
  onOpenChange,
  onSuccess,
}: CreateChallengeSheetProps) {
  const { isConnected, address } = useAccount();
  const apolloClient = useApolloClient();
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [poolAmount, setPoolAmount] = useState([100]);
  const [selectedDuration, setSelectedDuration] = useState(DURATION_OPTIONS[0].value);
  const supportedTokens = useSupportedTokens();
  const initialToken = supportedTokens.find((t) => t.symbol === "G$")?.address ?? supportedTokens[0]?.address ?? "";
  const [selectedToken, setSelectedToken] = useState<string>(initialToken);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const {
    createChallenge,
    isPending: isCreating,
    isSuccess,
    isError,
    errorMessage: createErrorMessage,
    isConfirming,
  } = useCreateChallenge();

  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    refetchAllowance,
    isLoadingAllowance,
  } = useTokenApproval(selectedToken);

  // Token balances
  const cusdToken = supportedTokens.find((t) => t.symbol === "USDm");
  const gToken = supportedTokens.find((t) => t.symbol === "G$");

  const cusd = useTokenBalance(cusdToken?.address);
  const good = useTokenBalance(gToken?.address);

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
  const isLoadingBalance = tokenBalances.some((tb) => tb.isLoading);

  useEffect(() => {
    if (isSuccess) {
      setShowSuccessModal(true);
      refetchAllActiveQueries(apolloClient);
    }
  }, [isSuccess, apolloClient]);

  useEffect(() => {
    if (isError && createErrorMessage) {
      setErrorMessage(createErrorMessage);
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

  const currentPoolAmount =
    poolAmount[0] != null && isFinite(poolAmount[0]) ? poolAmount[0] : 100;

  const hasInsufficientBalance = selectedTokenBalance?.balance
    ? parseFloat(selectedTokenBalance.formatted) < currentPoolAmount
    : false;

  const canGoNext = () => {
    return (
      challengeTitle.trim().length > 0 &&
      challengeDescription.trim().length > 0 &&
      challengeDescription.trim().length <= 500 &&
      currentPoolAmount >= 1 &&
      !hasInsufficientBalance &&
      selectedDuration > 0
    );
  };


  const handleClose = () => {
    setPoolAmount([100]);
    setChallengeTitle("");
    setChallengeDescription("");
    const preferredToken = supportedTokens.find((t) => t.symbol === "G$")?.address ?? supportedTokens[0]?.address ?? "";
    setSelectedToken(preferredToken);
    setIsTokenDropdownOpen(false);
    setSelectedDuration(DURATION_OPTIONS[0].value);
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
    onSuccess?.();
  };

  const handleCreate = async () => {
    if (isCreating || isConfirming || isUploading || isApproving || isApprovingConfirming) {
      return;
    }

    try {
      if (!challengeTitle.trim()) {
        throw new Error("Please enter a campaign title");
      }
      if (!challengeDescription.trim()) {
        throw new Error("Please enter a campaign description");
      }
      if (!isFinite(currentPoolAmount) || currentPoolAmount < 1) {
        throw new Error("Pool amount must be at least 1");
      }
      if (selectedDuration <= 0) {
        throw new Error("Please select a valid duration");
      }

      // Handle approval automatically if needed
      if (needsApproval(currentPoolAmount) && !isApprovalSuccess) {
        await approve(currentPoolAmount);
        // Wait for approval transaction to be confirmed
        // The approval state will update via the hook, so we wait a bit
        // and then check allowance again
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await refetchAllowance();

        // Wait a bit more for the allowance to update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Double-check that approval succeeded
        if (needsApproval(currentPoolAmount)) {
          throw new Error("Token approval failed. Please try again.");
        }
      }

      setIsUploading(true);

      // Upload challenge title and description to IPFS
      const contentHash = await uploadToIPFS(
        challengeTitle,
        challengeDescription || undefined,
        undefined, // username
        undefined, // pfpUrl
        new Date(), // createdAt
        undefined, // gatekeeper
        undefined // bgImageUrl
      );

      if (!contentHash || typeof contentHash !== "string") {
        throw new Error("Failed to upload campaign description to IPFS");
      }

      setIsUploading(false);
      await createChallenge(contentHash, currentPoolAmount, selectedDuration);
    } catch (error) {
      setIsUploading(false);
      setErrorMessage(error instanceof Error ? error.message : "Failed to create campaign");
      setShowErrorModal(true);
    }
  };

  return (
    <>
      <Modal open={open} onOpenChange={handleClose}>
        <ModalContent className="max-w-2xl max-h-auto overflow-y-auto bg-white">
          <ModalHeader>
            <ModalTitle className="text-2xl font-black text-delulu-charcoal mb-2">
              Create Campaign
            </ModalTitle>
          </ModalHeader>

          <div className="pt-4">
            <div>
              <label className="block text-sm font-bold text-delulu-charcoal mb-2">
                Title
              </label>
              <input
                type="text"
                value={challengeTitle}
                onChange={(e) => {
                  if (e.target.value.length <= 100) {
                    setChallengeTitle(e.target.value);
                  }
                }}
                maxLength={100}
                placeholder="#CampaignName"
                className="w-full bg-white border capitalize border-gray-400 rounded-sm px-4 py-3 text-delulu-charcoal placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-delulu-charcoal/20 focus:border-gray-600"
                autoFocus
              />
              <div className="text-right mt-1">
                <span className="text-xs text-gray-500">
                  {challengeTitle.length}/100
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-delulu-charcoal mb-2">
                Description
              </label>
              <TextareaAutosize
                value={challengeDescription}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setChallengeDescription(e.target.value);
                  }
                }}
                maxLength={500}
                placeholder="Describe the campaign... What do participants need to achieve?"
                className="w-full bg-white border border-gray-400 rounded-lg px-4 py-3 text-delulu-charcoal placeholder:text-gray-400 resize-none focus:outline-none focus:ring-1 focus:ring-delulu-charcoal/20 focus:border-gray-600"
                minRows={4}
              />
              <div className="text-right mt-1">
                <span className="text-xs text-gray-500">
                  {challengeDescription.length}/500
                </span>
              </div>
            </div>

            <div>
              <div
                className={cn(
                  "bg-gray-50 rounded-2xl p-4 border transition-colors",
                  hasInsufficientBalance || currentPoolAmount < 1
                    ? "border-red-400"
                    : "border-gray-400"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Prize Pool</span>
                  {isConnected && selectedTokenBalance && (
                    <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                      Balance: {parseFloat(selectedTokenBalance.formatted).toFixed(2)}{" "}
                      <TokenBadge tokenAddress={selectedToken} size="sm" showText={false} />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={poolAmount[0]}
                    onChange={(e) => {
                      const value = e.target.value;

                      const numValue = parseFloat(value);
                      if (!isNaN(numValue) && numValue >= 1) {
                        const clampedValue = Math.max(1, Math.min(numValue, 100000));
                        setPoolAmount([clampedValue]);
                      } else if (!isNaN(numValue) && numValue < 1) {
                        setPoolAmount([1]);
                      }
                    }}
                    onBlur={(e) => {
                      const currentValue = parseFloat(e.target.value);
                      if (
                        e.target.value === "" ||
                        isNaN(currentValue) ||
                        currentValue < 1
                      ) {
                        setPoolAmount([100]);
                      } else {
                        const clampedValue = Math.max(1, currentValue);
                        setPoolAmount([clampedValue]);
                      }
                    }}
                    placeholder="0.00"
                    min={1}
                    max={100000}
                    step="0.01"
                    className={cn(
                      "flex-1 min-w-0 bg-transparent text-2xl font-bold focus:outline-none placeholder:text-gray-300",
                      hasInsufficientBalance || currentPoolAmount < 1
                        ? "text-red-500"
                        : "text-delulu-charcoal"
                    )}
                  />
                  <div ref={tokenDropdownRef} className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-400 bg-white hover:bg-gray-50 transition-colors",
                        isTokenDropdownOpen && "bg-gray-50"
                      )}
                    >
                      {(() => {
                        const selectedTokenInfo = supportedTokens.find(
                          (t) => t.address === selectedToken
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
                            <span className="text-sm font-bold text-delulu-charcoal">
                              {selectedTokenInfo?.symbol || "Select"}
                            </span>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-gray-500 transition-transform",
                                isTokenDropdownOpen && "rotate-180"
                              )}
                            />
                          </>
                        );
                      })()}
                    </button>

                    {isTokenDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 bg-white rounded-lg border border-gray-400 shadow-lg z-50 overflow-hidden min-w-[200px]">
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
                                  ? "bg-gray-100 text-delulu-charcoal font-bold"
                                  : "bg-white text-delulu-charcoal hover:bg-gray-50"
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
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {isLoading
                                      ? "..."
                                      : `${balance.toFixed(2)}`}
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
              </div>
              {isConnected && (currentPoolAmount < 1 || hasInsufficientBalance) && (
                <p className="text-sm text-red-600 mt-2 font-bold">
                  {currentPoolAmount < 1
                    ? "Minimum amount is 1"
                    : "Insufficient balance"}
                </p>
              )}
            </div>





            <div className="mt-4">


              <label className="block text-sm font-bold text-delulu-charcoal mb-2 ">
                Duration
              </label>

              <Select.Root
                value={selectedDuration.toString()}
                onValueChange={(value) => {
                  setSelectedDuration(Number(value));
                }}
              >
                <Select.Trigger className="w-full px-4 py-3 rounded-md bg-white border border-gray-400 text-delulu-charcoal font-normal text-base focus:outline-none focus:ring-1 focus:ring-delulu-charcoal/20 focus:border-gray-600 cursor-pointer flex items-center justify-between">
                  <Select.Value>
                    {DURATION_OPTIONS.find((opt) => opt.value === selectedDuration)?.display || "Select duration"}
                  </Select.Value>
                  <Select.Icon>
                    <ChevronDown className="h-4 w-4" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="overflow-hidden bg-white rounded-lg border border-gray-400 shadow-lg z-50">
                    <Select.Viewport className="p-1">
                      {DURATION_OPTIONS.map((option) => (
                        <Select.Item
                          key={option.value}
                          value={option.value.toString()}
                          className="relative flex items-center px-4 py-2 text-delulu-charcoal font-normal text-sm cursor-pointer outline-none hover:bg-gray-100 focus:bg-gray-100 data-[highlighted]:bg-gray-100"
                        >
                          <Select.ItemIndicator className="absolute left-0 w-6 inline-flex items-center justify-center">
                          </Select.ItemIndicator>
                          <Select.ItemText className="pl-8">{option.display}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handleCreate}
              disabled={
                isCreating ||
                isConfirming ||
                isUploading ||
                isApproving ||
                isApprovingConfirming ||
                !canGoNext()
              }
              className={cn(
                "flex-1",
                "px-8 py-4",
                "bg-delulu-yellow text-delulu-charcoal text-lg font-bold",
                "rounded-md border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                "flex items-center justify-center gap-2 hover:bg-delulu-yellow/90 transition-colors",
                (!canGoNext() ||
                  isCreating ||
                  isConfirming ||
                  isUploading ||
                  isApproving ||
                  isApprovingConfirming) &&
                "opacity-50 cursor-not-allowed"
              )}
            >
              {isApproving || isApprovingConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Approving...</span>
                </>
              ) : isCreating || isConfirming || isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isUploading ? "Uploading..." : "Creating..."}</span>
                </>
              ) : (
                <span>Launch Campaign</span>
              )}
            </button>
          </div>
        </ModalContent>
      </Modal>

      {/* Success Modal */}
      <FeedbackModal
        isOpen={showSuccessModal}
        type="success"
        title="Campaign Created! 🎉"
        message="Your campaign has been successfully launched. Participants can now join and compete!"
        onClose={handleSuccessClose}
        actionText="Done"
      />

      {/* Error Modal */}
      <FeedbackModal
        isOpen={showErrorModal}
        type="error"
        title="Oops! Something went wrong"
        message={errorMessage || "Failed to create campaign. Please try again."}
        onClose={() => {
          setShowErrorModal(false);
        }}
        actionText="Try Again"
      />
    </>
  );
}
