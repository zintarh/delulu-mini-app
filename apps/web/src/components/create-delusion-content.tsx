"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Loader2, X, Upload, ChevronDown, Check } from "lucide-react";
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
    token: string;
    text: string;
    amount: number;
    username?: string;
    pfpUrl?: string;
    gatekeeper: GatekeeperConfig | null;
    description?: string;
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

  /** Quick duration is whole days only (matches on-chain min resolution lead time). */
  const updateDeadlineFromFastMode = useCallback((value: string) => {
    if (!value || value === "" || isNaN(Number(value))) {
      return;
    }

    let numValue = Math.floor(Number(value));
    if (numValue < 1) {
      numValue = 1;
    }

    const now = new Date();
    const newDeadline = new Date(now);
    const millisecondsToAdd = numValue * 24 * 60 * 60 * 1000;
    newDeadline.setTime(now.getTime() + millisecondsToAdd);

    const minDeadline = getMinDeadline();
    const maxDeadline = getMaxDeadline();

    if (newDeadline.getTime() < minDeadline.getTime()) {
      setDeadline(minDeadline);
    } else if (newDeadline.getTime() > maxDeadline.getTime()) {
      setDeadline(maxDeadline);
    } else {
      newDeadline.setUTCHours(23, 59, 59, 999);
      setDeadline(newDeadline);
    }
  }, []);

  useEffect(() => {
    if (durationMode === "fast" && fastDurationValue !== "") {
      updateDeadlineFromFastMode(fastDurationValue);
    }
  }, [durationMode, fastDurationValue, updateDeadlineFromFastMode]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showFaucet, setShowFaucet] = useState(false);
  const [showNewUserGdModal, setShowNewUserGdModal] = useState(false);
  const [isNewUserSession, setIsNewUserSession] = useState(false);

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
  const gdBalance = Number(good.formatted || "0");

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setIsNewUserSession(window.sessionStorage.getItem("delulu:new-user") === "1");
    } catch {
      setIsNewUserSession(false);
    }
  }, []);

  useEffect(() => {
    if (!isConnected || !isNewUserSession) return;
    if (good.isLoading) return;

    if (gdBalance <= 0) {
      setShowNewUserGdModal(true);
      return;
    }

    // User now has G$; clear one-time gate marker.
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem("delulu:new-user");
      } catch {
        // ignore storage errors
      }
    }
    setIsNewUserSession(false);
    setShowNewUserGdModal(false);
  }, [isConnected, isNewUserSession, good.isLoading, gdBalance]);

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
    if (!isApprovalSuccess || !pendingCreation) return;

    const { deadline, finalImageUrl, token, text, amount, username, pfpUrl, gatekeeper: gate, description: desc } = pendingCreation;

    setIsWaitingForApproval(false);
    setIsUploadingImage(true);

    checkAllowanceWithRetry(refetchAllowance, amount)
      .then((hasAllowance) => {
        if (!hasAllowance) throw new Error("Token allowance not updated. Please try again.");
        return createDelulu(token, text, deadline, amount, username, pfpUrl, gate, finalImageUrl, desc || undefined);
      })
      .then(() => {
        setPendingCreation(null);
        setIsUploadingImage(false);
      })
      .catch((error) => {
        setPendingCreation(null);
        setIsUploadingImage(false);
        setIsWaitingForApproval(false);
        setErrorMessage(getErrorMessage(error));
        setShowErrorModal(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApprovalSuccess]);


  const handleTemplateSelect = (template: (typeof TEMPLATES)[0]) => {
    setSelectedTemplate(template);
    setSelectedImage(template.image);
    setCustomImage(null);
    setCustomUploadFile(null);
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

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMessage("Image size must be less than 5MB");
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

          const response = await fetch("/api/ipfs/upload-image", {
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
          token: selectedToken,
          text: delusionText,
          amount: stakeAmount,
          username: user?.username,
          pfpUrl: user?.pfpUrl,
          gatekeeper,
          description: description || undefined,
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
      <div className="relative h-screen bg-background text-foreground flex flex-col overflow-hidden">

        {/* Sticky header */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
            New Vision
          </span>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-xl mx-auto px-4 pt-3 pb-6 space-y-3">

          {/* Vision board preview + template strip */}
          <div>
            {/* Large preview */}
            <div
              className={cn(
                "relative rounded-2xl overflow-hidden bg-muted h-44 mb-3 transition-all",
                !selectedImage && "border-2 border-dashed border-border"
              )}
            >
              {selectedImage ? (
                <>
                  <img
                    src={selectedImage}
                    alt="Vision"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                  {delusionText && (
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="text-white text-xl font-bold leading-snug line-clamp-2 drop-shadow-md">
                        {delusionText}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <div className="w-14 h-14 rounded-full bg-background flex items-center justify-center shadow-sm">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium">Pick a vision board below</p>
                </div>
              )}
            </div>

            {/* Horizontal template strip */}
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
              {/* Custom upload tile */}
              <label className="flex-shrink-0 cursor-pointer group">
                <div
                  className={cn(
                    "w-[72px] h-[72px] rounded-xl overflow-hidden relative border-2 transition-all duration-200",
                    customImage
                      ? "border-delulu-yellow-reserved shadow-md scale-105"
                      : "border-dashed border-border hover:border-muted-foreground/50 hover:scale-105"
                  )}
                >
                  {customImage ? (
                    <>
                      <img src={customImage} alt="Custom" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white drop-shadow" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-1">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Custom
                      </span>
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
                    className={cn(
                      "flex-shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden relative border-2 transition-all duration-200",
                      isSelected
                        ? "border-delulu-yellow-reserved shadow-md scale-105"
                        : "border-transparent hover:scale-105 hover:shadow-md"
                    )}
                  >
                    <img
                      src={template.image}
                      alt={template.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <p className="absolute bottom-1.5 left-0 right-0 text-center text-white text-[9px] font-bold px-1 leading-tight drop-shadow">
                      {template.name}
                    </p>
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-delulu-yellow-reserved rounded-full flex items-center justify-center shadow">
                        <Check className="w-3 h-3 text-delulu-charcoal" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {validation.errors.image && submitAttempted && (
              <p className="text-xs text-destructive mt-2">{validation.errors.image}</p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              Title
            </label>
            <input
              type="text"
              value={delusionText}
              onChange={(e) => {
                if (e.target.value.length <= MAX_DELULU_LENGTH) {
                  setDelusionText(e.target.value);
                }
              }}
              maxLength={MAX_DELULU_LENGTH}
              placeholder="e.g. land my dream job this quarter"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-base font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border focus:border-foreground/30 transition-all"
              autoFocus
            />
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground">
                {delusionText.length}/{MAX_DELULU_LENGTH}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              Description{" "}
              <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <TextareaAutosize
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does manifesting this mean to you?"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-border focus:border-foreground/30 transition-all"
              minRows={2}
            />
          </div>

          {/* Deadline */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              Deadline
            </label>

            {durationMode === "calendar" ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowCalendarModal(true)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 flex items-center justify-between hover:bg-muted transition-colors text-left group"
                >
                  <span className="text-base font-medium">
                    {deadline.toLocaleString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground bg-muted group-hover:bg-background px-2.5 py-1 rounded-full transition-colors">
                    Change
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDurationMode("fast");
                    updateDeadlineFromFastMode(fastDurationValue);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Or enter number of days →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-full bg-background border border-border rounded-xl px-4 py-3 flex items-center gap-3 focus-within:ring-1 focus-within:ring-border focus-within:border-foreground/30 transition-all">
                  <input
                    min={1}
                    step={1}
                    value={fastDurationValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setFastDurationValue(val);
                        return;
                      }
                      if (!isNaN(Number(val)) && Number(val) > 0) {
                        setFastDurationValue(val);
                        updateDeadlineFromFastMode(val);
                      }
                    }}
                    onBlur={() => {
                      if (
                        fastDurationValue === "" ||
                        isNaN(Number(fastDurationValue)) ||
                        Number(fastDurationValue) < 1
                      ) {
                        setFastDurationValue("1");
                        updateDeadlineFromFastMode("1");
                      }
                    }}
                    className="flex-1 bg-transparent text-base font-medium focus:outline-none placeholder:text-muted-foreground"
                    placeholder="Number of days"
                  />
                  <span className="text-muted-foreground font-medium text-sm">days</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDurationMode("calendar")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Or pick a calendar date →
                </button>
              </div>
            )}
          </div>

          {/* Stake */}
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Stake
              </label>
              <span className="text-[10px] text-muted-foreground">
                min {MIN_STAKE} G$ · or leave 0
              </span>
            </div>
            <div className="bg-background border border-border rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-3">
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
                      setStakeAmount(numValue > 0 ? Math.max(MIN_STAKE, numValue) : 0);
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
                  placeholder={`0 (min ${MIN_STAKE})`}
                  className="flex-1 min-w-0 bg-transparent text-2xl font-bold focus:outline-none placeholder:text-muted-foreground/40"
                />

                <div ref={tokenDropdownRef} className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background hover:bg-muted transition-colors shadow-sm",
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
                            <img src={logoUrl} alt="" className="h-4 w-4 rounded-full" />
                          )}
                          <span className="text-sm font-bold">
                            {selectedTokenInfo?.symbol || "Select"}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground transition-transform",
                              isTokenDropdownOpen && "rotate-180"
                            )}
                          />
                        </>
                      );
                    })()}
                  </button>

                  {isTokenDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 bg-popover rounded-xl border border-border shadow-xl z-50 overflow-hidden min-w-[190px]">
                      {supportedTokens.map((t) => {
                        const tokenBalanceInfo = tokenBalances.find(
                          (tb) => tb.token.address.toLowerCase() === t.address.toLowerCase()
                        );
                        const balance = tokenBalanceInfo
                          ? parseFloat(tokenBalanceInfo.formatted)
                          : 0;
                        const isLoading = tokenBalanceInfo?.isLoading ?? false;
                        const logoUrl = TOKEN_LOGOS[t.address.toLowerCase()];
                        const isSelected =
                          selectedToken?.toLowerCase() === t.address.toLowerCase();

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
                                ? "bg-muted text-foreground"
                                : "hover:bg-muted/60 text-foreground"
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
                              <span className="font-bold text-sm">{t.symbol}</span>
                              {isConnected && (
                                <span className="text-xs text-muted-foreground">
                                  {isLoading ? "..." : balance.toFixed(2)}
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-delulu-yellow-reserved flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Balance row */}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs text-muted-foreground">
                  {approxUsdValue && approxUsdValue > 0 ? `≈ $${approxUsdValue.toFixed(2)} USD` : "Enter an amount"}
                </span>
                {isConnected && selectedTokenBalance ? (
                  <span className="text-xs font-semibold text-foreground inline-flex items-center gap-1">
                    <TokenBadge tokenAddress={selectedToken} size="sm" showText={false} />
                    {parseFloat(selectedTokenBalance.formatted).toFixed(2)}{" "}
                    <span className="text-muted-foreground font-normal">available</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Connect wallet</span>
                )}
              </div>
            </div>

            {isConnected && (
              <>
                {stakeAmount > 0 && stakeAmount < MIN_STAKE && (stakeInputTouched || submitAttempted) && (
                  <p className="text-xs text-destructive mt-1.5">
                    Minimum stake is {MIN_STAKE} G$ or 0
                  </p>
                )}
                {stakeAmount >= MIN_STAKE &&
                  (hasInsufficientBalanceForStake || exceedsBalance) &&
                  (stakeInputTouched || submitAttempted) && (
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

          {/* Bottom CTA — inside scroll so it's never covered by system/app nav on mobile */}
          <div className="pt-2 pb-6">
            <button
              onClick={handleCreate}
              disabled={!canCreate || isProcessing}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-base transition-all",
                "bg-delulu-yellow text-delulu-charcoal",
                "shadow-[0_4px_20px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.16)]",
                "active:scale-[0.98]",
                (!canCreate || isProcessing) && "opacity-40 cursor-not-allowed"
              )}
            >
              {!isGoodDollarSelected && (isApproving || isApprovingConfirming) ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Approving...
                </span>
              ) : isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progressStep?.label || "Processing..."}
                </span>
              ) : (
                "Manifest your vision ✨"
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
                  if (date) setDeadline(date);
                }}
                minDate={getMinDeadline()}
                maxDate={getMaxDeadline()}
                className="max-w-none"
              />
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className={cn(
                  "w-full py-3.5 rounded-xl font-bold text-sm transition-all",
                  "bg-delulu-yellow text-delulu-charcoal",
                  "shadow-[3px_3px_0px_0px_#1A1A1A] hover:shadow-[2px_2px_0px_0px_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px]"
                )}
              >
                Done
              </button>
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

      <Modal open={showNewUserGdModal} onOpenChange={setShowNewUserGdModal}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Claim free G$ first</ModalTitle>
          </ModalHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You need G$ to stake your goal and others can use G$ to buy your shares. Don&apos;t
              worry, G$ is free on mainnet.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowNewUserGdModal(false);
                onClose();
                window.location.href =
                  "/daily-claim/verify?returnTo=%2Fboard";
              }}
              className={cn(
                "w-full rounded-xl py-3 text-sm font-black",
                "bg-delulu-yellow text-delulu-charcoal border border-border",
              )}
            >
              Verify & Claim G$
            </button>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
