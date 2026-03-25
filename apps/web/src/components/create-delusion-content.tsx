"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Loader2, X, Upload, ChevronDown, Check } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import TextareaAutosize from "react-textarea-autosize";
import { useApolloClient } from "@apollo/client/react";
import { refetchAllActiveQueries } from "@/lib/graph/refetch-utils";
import { FeedbackModal } from "@/components/feedback-modal";
import { useCreateDelulu } from "@/hooks/use-delulu-contract";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { TokenBadge } from "@/components/token-badge";
import { useSupportedTokens } from "@/hooks/use-supported-tokens";
import { GOODDOLLAR_ADDRESSES, TOKEN_LOGOS } from "@/lib/constant";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { useAccount, useBalance } from "wagmi";
import { cn } from "@/lib/utils";
import { DateTimePicker } from "@/components/date-time-picker";
import { CELO_MAINNET_ID } from "@/lib/constant";
import { FaucetModal } from "@/components/faucet-modal";
import { useUserStore } from "@/stores/useUserStore";
import { type GatekeeperConfig } from "@/lib/ipfs";
import { UserSetupModal } from "@/components/user-setup-modal";
import { useUserSetupCheck } from "@/hooks/use-user-setup-check";
import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";
import {
  MAX_DELULU_LENGTH,
  MIN_STAKE,
  getDefaultDeadline,
  getMinDeadline,
  getMaxDeadline,
  validateDeluluInputs,
  calculateMaxStakeValue,
  getErrorMessage,
  checkAllowanceWithRetry,
  getProgressStep,
  getOrigin,
} from "@/lib/create-delulu-helpers";

interface CreateDelusionContentProps {
  onClose: () => void;
}

const TEMPLATES = [
  {
    id: 1,
    name: "New Job",
    image: "/templates/t0.png",
    fontWeight: "700",
  },
  {
    id: 2,
    name: "Software Engineer",
    image: "/templates/t1.jpg",
    fontWeight: "700",
  },
  {
    id: 3,
    name: "Traveller",
    image: "/templates/t2.png",
    fontWeight: "700",
  },

  {
    id: 4,
    name: "Startup",
    image: "/templates/t9.jpg",
    fontWeight: "700",
  },
  {
    id: 5,
    name: "Relationship",
    image: "/templates/t3.png",
    fontWeight: "700",
  },

  {
    id: 6,
    name: "Graduate",
    image: "/templates/t6.jpg",
    fontWeight: "700",
  },

  {
    id: 7,
    name: "Workout",
    image: "/templates/t8.jpg",
    fontWeight: "700",
  },
];

type Step = "gallery";

export function CreateDelusionContent({ onClose }: CreateDelusionContentProps) {
  const { user } = useUserStore();
  const apolloClient = useApolloClient();
  const { needsSetup, isChecking } = useUserSetupCheck();
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);

  useEffect(() => {
    if (!isChecking) {
      if (needsSetup) {
        setShowUserSetupModal(true);
      } else {
        setShowUserSetupModal(false);
      }
    }
  }, [needsSetup, isChecking]);

  if (!user) {
    console.warn("[CreateDelusionContent] User not authenticated");
  }

  // Step management
  const [step, setStep] = useState<Step>("gallery");
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<
    (typeof TEMPLATES)[0] | null
  >(null);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [customUploadFile, setCustomUploadFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pendingCreation, setPendingCreation] = useState<{
    deadline: Date;
    finalImageUrl: string;
  } | null>(null);

  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);

  // Form state
  const [delusionText, setDelusionText] = useState("");
  const [description, setDescription] = useState("");
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const supportedTokens = useSupportedTokens();
  // Prefer G$ if available, otherwise use first token
  const initialToken = supportedTokens.find((t) => t.symbol === "G$")?.address ?? supportedTokens[0]?.address ?? "";
  const [selectedToken, setSelectedToken] = useState<string>(initialToken);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();
  const [inputText, setInputText] = useState<string>("");
  const [stakeInputTouched, setStakeInputTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [gatekeeper, setGatekeeper] = useState<GatekeeperConfig | null>(null);
  const { usd: gDollarUsdPrice } = useGoodDollarPrice();

  const isGoodDollarSelected =
    selectedToken.toLowerCase() === GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();
  const approxUsdValue =
    isGoodDollarSelected && gDollarUsdPrice && stakeAmount > 0
      ? stakeAmount * gDollarUsdPrice
      : !isGoodDollarSelected && stakeAmount > 0
      ? stakeAmount
      : null;

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

  const [deadline, setDeadline] = useState<Date>(() => {
    return getDefaultDeadline();
  });

  const [durationMode, setDurationMode] = useState<"fast" | "calendar">("calendar");
  const [fastDurationValue, setFastDurationValue] = useState<string>("7");
  const [fastDurationUnit, setFastDurationUnit] = useState<"minutes" | "hours" | "days">("days");

  const updateDeadlineFromFastMode = useCallback((
    value: string,
    unit: "minutes" | "hours" | "days"
  ) => {
    if (!value || value === "" || isNaN(Number(value)) || Number(value) <= 0) {
      return;
    }

    let numValue = Number(value);
    // Enforce minimum of 30 minutes when using minute granularity
    if (unit === "minutes" && numValue < 30) {
      numValue = 30;
    }

    const now = new Date();
    const newDeadline = new Date(now);

    // Calculate milliseconds to add based on unit
    let millisecondsToAdd = 0;
    if (unit === "minutes") {
      millisecondsToAdd = numValue * 60 * 1000;
    } else if (unit === "hours") {
      millisecondsToAdd = numValue * 60 * 60 * 1000;
    } else if (unit === "days") {
      millisecondsToAdd = numValue * 24 * 60 * 60 * 1000;
    }

    newDeadline.setTime(now.getTime() + millisecondsToAdd);

    const minDeadline = getMinDeadline();
    const maxDeadline = getMaxDeadline();

    // For days, keep the existing behavior: clamp to min/max and snap to end of day.
    if (unit === "days") {
      if (newDeadline.getTime() < minDeadline.getTime()) {
        setDeadline(minDeadline);
      } else if (newDeadline.getTime() > maxDeadline.getTime()) {
        setDeadline(maxDeadline);
      } else {
        newDeadline.setUTCHours(23, 59, 59, 999);
        setDeadline(newDeadline);
      }
      return;
    }

    // For minutes/hours, respect the exact offset (no day snapping, no 24h minimum clamp),
    // but still clamp to the global max deadline.
    if (newDeadline.getTime() > maxDeadline.getTime()) {
      setDeadline(maxDeadline);
    } else {
      setDeadline(newDeadline);
    }
  }, [setDeadline]);

  useEffect(() => {
    if (durationMode === "fast" && fastDurationValue !== "") {
      updateDeadlineFromFastMode(fastDurationValue, fastDurationUnit);
    }
  }, [durationMode, fastDurationValue, fastDurationUnit, updateDeadlineFromFastMode]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showFaucet, setShowFaucet] = useState(false);

  // CELO gas balance for faucet redirect
  const { data: celoBalance } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!address },
  });

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
  } = useTokenApproval(selectedToken);

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
  const tokenBalance = selectedTokenBalance?.balance;

  // Effects
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
    return () => {
      setPendingCreation(null);
      setIsWaitingForApproval(false);
    };
  }, []);


  useEffect(() => {
    if (isApprovalSuccess && pendingCreation) {
      setIsWaitingForApproval(false);
    }
  }, [isApprovalSuccess, pendingCreation]);


  const handleTemplateSelect = (template: (typeof TEMPLATES)[0]) => {
    setSelectedTemplate(template);
    setSelectedImage(template.image);
    setCustomImage(null);
    setShowTemplateModal(false);
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file");
      setShowErrorModal(true);
      return;
    }

    const maxSize = 10 * 1024 * 1024; 
    if (file.size > maxSize) {
      setErrorMessage("Image size must be less than 10MB");
      setShowErrorModal(true);
      return;
    }

    // Store the File object for later upload
    setCustomUploadFile(file);

    // Also create a preview URL for display
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (result && typeof result === "string") {
        setCustomImage(result);
        setSelectedImage(result);
        setSelectedTemplate(null);
        setShowTemplateModal(false);
      } else {
        console.error("Failed to read file");
        setErrorMessage("Failed to load image. Please try again.");
        setShowErrorModal(true);
      }
    };
    reader.onerror = () => {
      console.error("FileReader error");
      setErrorMessage("Failed to read image file. Please try again.");
      setShowErrorModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleBack = () => {
    // Navigate back to home feed, same as close button
    onClose();
  };

  const handleClose = () => {
    setStep("gallery");
    setStakeAmount(0);
    setInputText("");
    setStakeInputTouched(false);
    setSubmitAttempted(false);
    setDelusionText("");
    setDescription("");
    setDeadline(getDefaultDeadline());
    setDurationMode("calendar");
    setFastDurationValue("7");
    setFastDurationUnit("days");
    setGatekeeper(null);
    setSelectedTemplate(null);
    setCustomImage(null);
    setSelectedImage(null);
    setCustomUploadFile(null);
    setIsUploadingImage(false);
    setPendingCreation(null);
    setIsWaitingForApproval(false);
    onClose();
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    handleClose();
  };

  // Calculate validation values using helpers (moved before handleCreate)
  const maxStakeValue = calculateMaxStakeValue(tokenBalance);
  const validation = validateDeluluInputs(
    delusionText,
    stakeAmount,
    maxStakeValue,
    selectedImage
  );

  const canCreate = validation.canCreate && !isUploadingImage;
  const hasInputError = !validation.isValid;
  const exceedsBalance = stakeAmount > maxStakeValue;
  // Only treat balance as "insufficient" when user is actually trying to stake > 0
  const hasInsufficientBalanceForStake =
    stakeAmount > 0 && maxStakeValue < MIN_STAKE;

  const progressStep = getProgressStep(
    isUploadingImage,
    isApproving,
    isApprovingConfirming,
    isCreating,
    isConfirming
  );

  const isProcessing =
    isCreating ||
    isApproving ||
    isApprovingConfirming ||
    isUploadingImage ||
    (isWaitingForApproval && !isApprovalSuccess);

  const handleCreate = async () => {
    setSubmitAttempted(true);
    // Prevent multiple simultaneous calls
    if (isProcessing) {
      return;
    }

    // If user has (almost) no CELO, open faucet modal instead of letting tx fail
    const nativeBalance =
      celoBalance && Number(celoBalance.formatted) > 0
        ? Number(celoBalance.formatted)
        : 0;
    if (nativeBalance < 0.005) {
      setShowFaucet(true);
      return;
    }

    setIsUploadingImage(true);

    try {
      const maxStakeValue = calculateMaxStakeValue(tokenBalance);
      const validation = validateDeluluInputs(
        delusionText,
        stakeAmount,
        maxStakeValue,
        selectedImage
      );

      if (!validation.isValid) {
        const firstError =
          validation.errors.text ||
          validation.errors.stake ||
          validation.errors.balance ||
          validation.errors.image;
        setIsUploadingImage(false);
        throw new Error(firstError || "Please check your inputs");
      }

      if (pendingCreation && !isApproving && !isApprovingConfirming) {
        if (
          !pendingCreation.deadline ||
          !(pendingCreation.deadline instanceof Date) ||
          isNaN(pendingCreation.deadline.getTime()) ||
          !pendingCreation.finalImageUrl ||
          typeof pendingCreation.finalImageUrl !== "string"
        ) {
          setIsUploadingImage(false);
          throw new Error("Invalid creation data. Please start over.");
        }

        let hasAllowance = false;
        try {
          hasAllowance = await checkAllowanceWithRetry(
            refetchAllowance,
            stakeAmount
          );
        } catch (error) {
          console.error("[handleCreate] Allowance check failed:", error);
          setIsUploadingImage(false);
          throw new Error(
            "Failed to verify token allowance. Please try again."
          );
        }

        if (hasAllowance) {
          await createDelulu(
            selectedToken,
            delusionText,
            pendingCreation.deadline,
            stakeAmount,
            user?.username,
            user?.pfpUrl,
            gatekeeper,
            pendingCreation.finalImageUrl,
            description || undefined
          );
          setPendingCreation(null);
          setIsUploadingImage(false);
          return;
        } else {
          setIsUploadingImage(false);
          throw new Error("Token allowance not updated. Please try again.");
        }
      }

      const deadlineDate =
        deadline instanceof Date && !isNaN(deadline.getTime())
          ? deadline
          : getDefaultDeadline();

      let finalImageUrl: string;

      if (customUploadFile) {
        try {
          const formData = new FormData();
          formData.append("file", customUploadFile);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to upload image");
          }

          const data = (await response.json()) as { url?: string };
          if (!data?.url || typeof data.url !== "string") {
            throw new Error("No image URL returned from upload");
          }
          finalImageUrl = data.url;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            throw new Error("Image upload timed out. Please try again.");
          }
          throw error;
        }
      } else if (selectedTemplate?.image) {
        const origin = getOrigin();
        finalImageUrl = `${origin}${selectedTemplate.image}`;
      } else {
        setIsUploadingImage(false);
        throw new Error("Please select a template or upload an image");
      }

      if (needsApproval(stakeAmount)) {
        setPendingCreation({
          deadline: deadlineDate,
          finalImageUrl,
        });
        setIsWaitingForApproval(true);
        setIsUploadingImage(false);
        await approve(stakeAmount);
        return; 
      }

          await createDelulu(
            selectedToken,
            delusionText,
            deadlineDate,
            stakeAmount,
            user?.username,
            user?.pfpUrl,
            gatekeeper,
            finalImageUrl,
            description || undefined
          );
      setIsUploadingImage(false);
    } catch (error) {
      setIsUploadingImage(false);
      setPendingCreation(null);
      setIsWaitingForApproval(false);
      const friendlyMessage = getErrorMessage(error);
      setErrorMessage(friendlyMessage);
      setShowErrorModal(true);
    }
  };

  return (
    <>

      <div
        className={cn(
          "relative h-screen z-10 max-w-4xl mx-auto bg-background text-foreground overflow-y-auto scrollbar-hide",
          step === "gallery" && "bg-background"
        )}
      >
        {/* Top Navigation */}
        <div className="fixed top-0 left-0 right-0 z-50 px-4 py-4 flex items-center justify-between ">
          {step !== "gallery" ? (
            <div className=" w-full flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center justify-center w-12 h-12 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Back"
                aria-label="Back"
              >
                <ArrowLeft className="w-7 h-7" />
              </button>

              <h1
                className="text-4xl font-black text-delulu-yellow-reserved"
                style={{
                  fontFamily: "var(--font-gloria), cursive",
                  textShadow:
                    "3px 3px 0px #fffff, -2px -2px 0px # #fffff, 2px -2px 0px #ffffff, -2px 2px 0px  #fffff",
                }}
              >
                Delulu
              </h1>

              <button
                onClick={handleClose}
                className="flex items-center justify-center w-12 h-12 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Close"
                aria-label="Close"
              >
                <X className="w-7 h-7" />
              </button>
            </div>
          ) : (
            <div className=" w-full flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center justify-center w-12 h-12 rounded-full text-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Back"
                aria-label="Back"
              >
                <ArrowLeft className="w-7 h-7" />
              </button>

              <h1
                className="text-4xl font-black text-delulu-yellow-reserved"
                style={{
                  fontFamily: "var(--font-gloria), cursive",
                  textShadow:
                    "3px 3px 0px #000000, -2px -2px 0px #000000, 2px -2px 0px #000000, -2px 2px 0px  #000000",
                }}
              >
                Delulu
              </h1>

              <button
                onClick={handleClose}
                className="flex items-center justify-center w-12 h-12 rounded-full text-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Close"
                aria-label="Close"
              >
                <X className="w-7 h-7" />
              </button>
            </div>
          )}
        </div>

        <div className="pt-20 pb-6 px-4 lg:px-8 min-h-[calc(100vh-5rem)]">
          <div className="max-w-4xl mx-auto space-y-1">


            {/* Title Input */}
            <div>
              <label className="block text-base font-bold text-foreground mb-2">
                Title
              </label>
              <input
                type="text"
                value={delusionText}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= MAX_DELULU_LENGTH) {
                    setDelusionText(value);
                  }
                }}
                maxLength={MAX_DELULU_LENGTH}
                placeholder="Enter your delulu title..."
                className="w-full bg-card border capitalize border-border rounded-sm px-3 py-2.5 sm:px-5 sm:py-3.5 text-base sm:text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-border"
                autoFocus
              />
              <div className="text-right mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {delusionText.length}/{MAX_DELULU_LENGTH}
                </span>
              </div>
            </div>

            {/* Description Input */}
            <div>
              <label className="block text-base font-bold text-foreground mb-2">
                Description
              </label>
              <TextareaAutosize
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description (optional)..."
                className="w-full bg-card border border-border rounded-lg px-3 py-2 sm:px-5 sm:py-3.5 text-sm sm:text-lg text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring focus:border-border"
                minRows={3}
              />
            </div>

            {/* Duration Input */}
            <div>
              <label className="block text-base font-bold text-foreground mb-2">
                Duration
              </label>
              <div className="space-y-2">
                {durationMode === "calendar" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCalendarModal(true)}
                      className={cn(
                        "w-full flex items-center justify-between",
                        "px-3 py-2.5 sm:px-5 sm:py-3.5 rounded-md bg-card border border-border",
                        "text-left text-foreground font-normal text-base sm:text-lg",
                        "focus:outline-none focus:ring-1 focus:ring-ring focus:border-border",
                        "hover:bg-muted transition-colors"
                      )}
                    >
                      <span>
                        {deadline.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-xs text-muted-foreground underline">
                        Pick date
                      </span>
                    </button>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setDurationMode("fast");
                          updateDeadlineFromFastMode(
                            fastDurationValue,
                            fastDurationUnit
                          );
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Use quick duration instead
                      </button>
                    </div>
                  </>
                )}

                {durationMode === "fast" && (
                  <div className="space-y-2">
                    <div className={cn(
                      "w-full flex items-center justify-between",
                      "px-3 py-2.5 sm:px-5 sm:py-3.5 rounded-md bg-card border border-border",
                      "text-left text-foreground font-normal text-base sm:text-lg",
                      "focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:border-border",
                      "hover:bg-muted transition-colors"
                    )}>
                      <input
                        min="1"
                        value={fastDurationValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || (!isNaN(Number(val)) && Number(val) > 0)) {
                            // For minutes, enforce a minimum of 30
                            if (fastDurationUnit === "minutes") {
                              const asNum = Number(val);
                              const clamped = asNum < 30 ? 30 : asNum;
                              const nextValue = clamped.toString();
                              setFastDurationValue(nextValue);
                              updateDeadlineFromFastMode(nextValue, fastDurationUnit);
                            } else {
                              setFastDurationValue(val);
                              if (val !== "") {
                                updateDeadlineFromFastMode(val, fastDurationUnit);
                              }
                            }
                          }
                        }}
                        className={cn(
                          "flex-1 min-w-0 bg-transparent",
                          "border-0 outline-none focus:outline-none focus:ring-0",
                          "text-foreground placeholder:text-muted-foreground font-normal text-base sm:text-lg"
                        )}
                        placeholder="Number"
                      />
                      <Select.Root
                        value={fastDurationUnit}
                        onValueChange={(value) => {
                          const unit = value as "minutes" | "hours" | "days";
                          // When switching to minutes, also enforce minimum of 30
                          if (unit === "minutes" && fastDurationValue !== "") {
                            const asNum = Number(fastDurationValue);
                            const clamped = isNaN(asNum) || asNum < 30 ? 30 : asNum;
                            const nextValue = clamped.toString();
                            setFastDurationUnit(unit);
                            setFastDurationValue(nextValue);
                            updateDeadlineFromFastMode(nextValue, unit);
                          } else {
                            setFastDurationUnit(unit);
                            if (fastDurationValue !== "") {
                              updateDeadlineFromFastMode(fastDurationValue, unit);
                            }
                          }
                        }}
                      >
                        <Select.Trigger
                          className={cn(
                            "flex-shrink-0 inline-flex items-center justify-between",
                            "bg-transparent px-2 py-1",
                            "border-0 outline-none focus:outline-none focus:ring-0",
                            "text-foreground font-normal text-base sm:text-lg cursor-pointer min-w-[86px]"
                          )}
                        >
                          <Select.Value />
                          <Select.Icon className="ml-2">
                            <ChevronDown className="w-4 h-4" />
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content className="overflow-hidden bg-popover rounded-lg border border-border shadow-lg z-50">
                            <Select.Viewport className="p-1">
                              <Select.Item
                                value="minutes"
                                className="relative flex items-center px-4 py-2 text-foreground font-bold text-sm cursor-pointer outline-none hover:bg-muted focus:bg-muted data-[highlighted]:bg-muted"
                              >
                                <Select.ItemIndicator className="absolute left-2 w-6 inline-flex items-center justify-center">
                                  <Check className="w-4 h-4" />
                                </Select.ItemIndicator>
                                <Select.ItemText className="pl-8">Min</Select.ItemText>
                              </Select.Item>
                              <Select.Item
                                value="hours"
                                className="relative flex items-center px-4 py-2 text-foreground font-bold text-sm cursor-pointer outline-none hover:bg-muted focus:bg-muted data-[highlighted]:bg-muted"
                              >
                                <Select.ItemIndicator className="absolute left-2 w-6 inline-flex items-center justify-center">
                                  <Check className="w-4 h-4" />
                                </Select.ItemIndicator>
                                <Select.ItemText className="pl-8">Hrs</Select.ItemText>
                              </Select.Item>
                              <Select.Item
                                value="days"
                                className="relative flex items-center px-4 py-2 text-foreground font-bold text-sm cursor-pointer outline-none hover:bg-muted focus:bg-muted data-[highlighted]:bg-muted"
                              >
                                <Select.ItemIndicator className="absolute left-2 w-6 inline-flex items-center justify-center">
                                  <Check className="w-4 h-4" />
                                </Select.ItemIndicator>
                                <Select.ItemText className="pl-8">Days</Select.ItemText>
                              </Select.Item>
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    </div>
                    <div className="flex justify-end mb-4">
                      <button
                        type="button"
                        onClick={() => {
                          setDurationMode("calendar");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Use calendar instead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Staking Input */}
            <div>
              <div
                className={cn(
                  "bg-muted rounded-2xl p-3 sm:p-4 border transition-colors border-border",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Initial Stake Amount</span>
                  {isConnected && selectedTokenBalance && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      Balance: {parseFloat(selectedTokenBalance.formatted).toFixed(2)}{" "}
                      <TokenBadge tokenAddress={selectedToken} size="sm" showText={false} />
                    </span>
                  )}
                </div>
                <div className="flex  items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => {
                      const value = e.target.value;
                      setInputText(value);

                      if (value.trim() === "") {
                        setStakeAmount(0);
                        return;
                      }

                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        const clampedValue = numValue > 0 ? Math.max(MIN_STAKE, numValue) : 0;
                        setStakeAmount(clampedValue);
                      }
                    }}
                    onBlur={(e) => {
                      setStakeInputTouched(true);
                      const currentValue = parseFloat(e.target.value);
                      if (e.target.value === "" || isNaN(currentValue) || currentValue < 0) {
                        setStakeAmount(0);
                        setInputText("");
                        return;
                      }
                      if (currentValue > 0 && currentValue < MIN_STAKE) {
                        setStakeAmount(MIN_STAKE);
                        setInputText(MIN_STAKE.toString());
                      } else if (currentValue >= MIN_STAKE) {
                        const clampedValue = Math.max(MIN_STAKE, currentValue);
                        setStakeAmount(clampedValue);
                        setInputText(clampedValue.toFixed(0));
                      }
                    }}
                    placeholder="Min 100 G$"
                    className={cn(
                      "flex-1 min-w-0 bg-transparent text-lg sm:text-2xl font-bold focus:outline-none placeholder:text-muted-foreground",
                    )}
                  />
                  {approxUsdValue && approxUsdValue > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground font-medium">
                      ≈ ${approxUsdValue.toFixed(2)} USD
                    </p>
                  )}
                  <div ref={tokenDropdownRef} className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm",
                        isTokenDropdownOpen && "bg-muted"
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
                            <span className="text-sm font-bold text-foreground">
                              {selectedTokenInfo?.symbol || "Select"}
                            </span>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform",
                                  isTokenDropdownOpen && "rotate-180"
                                )}
                              />
                          </>
                        );
                      })()}
                    </button>

                    {isTokenDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 bg-popover rounded-lg border border-border shadow-lg z-50 overflow-hidden min-w-[200px]">
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
                                  ? "bg-muted text-foreground font-bold"
                                  : "bg-popover text-foreground hover:bg-muted"
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
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
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
              {isConnected && (
                <>
                  {stakeAmount > 0 && stakeAmount < MIN_STAKE && (stakeInputTouched || submitAttempted) && (
                    <p className="text-xs text-destructive mt-1.5">
                      Minimum stake is {MIN_STAKE} G$ or 0
                    </p>
                  )}
                  {stakeAmount >= MIN_STAKE && (hasInsufficientBalanceForStake || exceedsBalance) && (stakeInputTouched || submitAttempted) && (
                    <p className="text-xs text-destructive mt-1.5">
                      {hasInsufficientBalanceForStake
                        ? "Insufficient balance"
                        : exceedsBalance
                          ? "Amount exceeds your balance"
                          : ""}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Gatekeeper Component */}
            {/* <div className="pt-3 border-t border-gray-200">
                    <GatekeeperStep
                      value={gatekeeper}
                      onChange={setGatekeeper}
                  variant="light"
                    />
                  </div> */}

            {/* Template Selection Button */}
            <div>
         



              <div className="space-y-3 pt-4">
                {selectedImage && (
                  <div className="space-y-2">
                    {selectedTemplate && (
                      <p className="text-sm font-semibold text-delulu-charcoal">
                        {selectedTemplate.name}
                      </p>
                    )}
                    {customImage && (
                      <p className="text-sm font-semibold text-delulu-charcoal">
                        Custom Image
                      </p>
                    )}
                    <img
                      src={selectedImage}
                      alt={selectedTemplate?.name || "Custom"}
                      className="w-60 h-60 rounded-lg object-cover border-2 border-border"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  className={cn(
                    "inline-flex items-center gap-2",
                    "px-4 py-2.5 rounded-md",
                    "bg-secondary border border-border",
                    "text-foreground font-semibold text-sm",
                    "active:scale-[0.98] transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-delulu-charcoal/20"
                  )}
                >
                  <Upload className="w-4 h-4" />
                  <span>{selectedTemplate || customImage ? "Change Template" : "Choose Template"}</span>
                </button>
                {validation.errors.image && submitAttempted && (
                  <p className="text-xs text-destructive mt-1.5">
                    {validation.errors.image}
                  </p>
                )}
              </div>
            </div>

            {/* Manifest Button */}
            <div className="flex justify-end mt-10">
              <button
                onClick={handleCreate}
                disabled={!canCreate || isProcessing}
                className={cn(
                  "px-5 py-2.5 text-sm font-bold",
                  "bg-delulu-yellow text-delulu-charcoal",
                  "rounded-md border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                  "flex items-center justify-center gap-2 hover:bg-delulu-yellow/90 transition-colors",
                  (!canCreate || isProcessing) &&
                  "opacity-50 cursor-not-allowed"
                )}
              >
                {!isGoodDollarSelected && (isApproving || isApprovingConfirming) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progressStep?.label || "Processing..."}</span>
                  </>
                ) : (
                  <span>Manifest</span>
                )}
                    </button>
                  </div>
                </div>
                
        </div>








        {/* Calendar Modal */}
        <Modal open={showCalendarModal} onOpenChange={setShowCalendarModal}>
          <ModalContent className="max-w-md">
            <ModalHeader>
              <ModalTitle>Pick a deadline</ModalTitle>
            </ModalHeader>
            <div className="mt-4 space-y-4">
              <DateTimePicker
                value={deadline}
                onChange={(date) => {
                  if (date) {
                    setDeadline(date);
                  }
                }}
                minDate={getMinDeadline()}
                maxDate={getMaxDeadline()}
                className="max-w-none"
              />
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className={cn(
                  "w-full py-3 rounded-md font-bold text-sm transition-all",
                  "border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                  "bg-delulu-yellow-reserved text-delulu-charcoal hover:bg-delulu-yellow-reserved/90"
                )}
              >
                Done
              </button>
            </div>
          </ModalContent>
        </Modal>

        {/* Template Selection Modal */}
        <Modal open={showTemplateModal} onOpenChange={setShowTemplateModal}>
          <ModalContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <ModalHeader>
              <ModalTitle>Choose Template</ModalTitle>
            </ModalHeader>
            <div className="mt-4">
              <div className="grid grid-cols-4 gap-3">
                {/* Upload Custom Card */}
                <label className="relative w-full rounded-xl overflow-hidden group cursor-pointer block transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <div className="relative aspect-square">
                    <img
                      src="/templates/customize.png"
                      alt="Upload your own vision"
                      className="w-full h-full object-cover rounded-xl"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <Upload className="w-8 h-8 text-white group-hover:text-delulu-yellow-reserved transition-colors drop-shadow-lg" />
                      <p className="text-white font-bold text-xs drop-shadow-lg text-center px-2">
                        Custom
                      </p>
                    </div>
                    {customImage && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-delulu-yellow-reserved rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-delulu-charcoal" />
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCustomUpload}
                    className="hidden"
                  />
                </label>

                {TEMPLATES.map((template) => {
                  const isSelected = selectedTemplate?.id === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="relative w-full rounded-xl overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                    >
                      <div className="relative aspect-square">
                        <img
                          src={template.image}
                          alt={template.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p
                            className="text-white font-bold text-xs text-center px-2 drop-shadow-lg"
                            style={{
                              fontWeight: template.fontWeight,
                            }}
                          >
                            {template.name}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-delulu-yellow-reserved rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-delulu-charcoal" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </ModalContent>
        </Modal>

      </div>

      <FeedbackModal
        isOpen={showSuccessModal}
        type="success"
        title="Vision Manifested! 🎉"
        message="Your delulu is live! Next step: add milestones so supporters can see your roadmap and progress."
        onClose={handleSuccessClose}
        actionText="Done"
      />

      <FeedbackModal
        isOpen={showErrorModal}
        type="error"
        title="Creation Failed"
        message={errorMessage || "Failed to create delulu. Please try again."}
        onClose={() => setShowErrorModal(false)}
        actionText="Try Again"
      />

      {/* User Setup Modal - only show when username is not set (needsSetup) */}
      <UserSetupModal
        open={showUserSetupModal && needsSetup}
        onOpenChange={(open) => {
          setShowUserSetupModal(open);
          // If user closes modal without completing, close the create page
          if (!open && needsSetup) {
            onClose();
          }
        }}
        onComplete={(username, email) => {
          // TODO: Save username and email when implementation is ready
          console.log("User setup completed:", { username, email });
          setShowUserSetupModal(false);
        }}
      />

      <FaucetModal open={showFaucet} onOpenChange={setShowFaucet} />
    </>
  );
}
