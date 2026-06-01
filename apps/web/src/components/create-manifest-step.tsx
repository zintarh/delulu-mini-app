"use client";

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Loader2,
  Upload,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useApolloClient } from "@apollo/client/react";
import { refetchAllActiveQueries } from "@/lib/graph/refetch-utils";
import { useCreateDelulu } from "@/hooks/use-delulu-contract";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { TokenBadge } from "@/components/token-badge";
import { useSupportedTokens } from "@/hooks/use-supported-tokens";
import { GOODDOLLAR_ADDRESSES, TOKEN_LOGOS } from "@/lib/constant";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { useBalance } from "wagmi";
import { useAuth } from "@/hooks/use-auth";
import { useRequireGoodDollarWhitelist } from "@/hooks/use-require-gooddollar-whitelist";
import { cn } from "@/lib/utils";
import { CELO_MAINNET_ID } from "@/lib/constant";
import { useUserStore } from "@/stores/useUserStore";
import { type GatekeeperConfig } from "@/lib/ipfs";
import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";
import {
  MAX_DELULU_LENGTH,
  MIN_STAKE,
  MIN_DURATION_DAYS,
  MAX_DURATION_DAYS,
  getDefaultDeadline,
  getMinDeadline,
  getMaxDeadline,
  validateDeluluInputs,
  calculateMaxStakeValue,
  getErrorMessage,
  checkAllowanceWithRetry,
  getProgressStep,
} from "@/lib/create-delulu-helpers";
import {
  TEMPLATES,
  type DelusionTemplate,
  type SideEffectHabit,
} from "@/components/create-delusion-shared";
import {
  createFlowPx,
  createFlowPy,
  createFlowGap,
  createFlowFieldGap,
} from "@/components/create-flow-layout";

const FeedbackModal = dynamic(
  () => import("@/components/feedback-modal").then((m) => m.FeedbackModal),
  { ssr: false }
);
const FaucetModal = dynamic(
  () => import("@/components/faucet-modal").then((m) => m.FaucetModal),
  { ssr: false }
);
const AiMilestonesModal = dynamic(
  () => import("@/components/ai-milestones-modal").then((m) => m.AiMilestonesModal),
  { ssr: false }
);
const DateTimePicker = dynamic(
  () => import("@/components/date-time-picker").then((m) => m.DateTimePicker),
  { ssr: false }
);

export interface CreateManifestStepProps {
  onClose: () => void;
  activeHabit: SideEffectHabit | null;
  roadmapHabits: SideEffectHabit[];
  goalSeriesIdRef: React.MutableRefObject<string | null>;
  activeHabitRef: React.MutableRefObject<SideEffectHabit | null>;
  delusionText: string;
  setDelusionText: Dispatch<SetStateAction<string>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  selectedTemplate: DelusionTemplate | null;
  setSelectedTemplate: Dispatch<SetStateAction<DelusionTemplate | null>>;
  customImage: string | null;
  setCustomImage: Dispatch<SetStateAction<string | null>>;
  selectedImage: string | null;
  setSelectedImage: Dispatch<SetStateAction<string | null>>;
  customUploadFile: File | null;
  setCustomUploadFile: Dispatch<SetStateAction<File | null>>;
  deadline: Date;
  setDeadline: Dispatch<SetStateAction<Date>>;
  durationMode: "fast" | "calendar";
  setDurationMode: Dispatch<SetStateAction<"fast" | "calendar">>;
  fastDurationValue: string;
  setFastDurationValue: Dispatch<SetStateAction<string>>;
  updateDeadlineFromFastMode: (value: string) => void;
  gatekeeper: GatekeeperConfig | null;
}

export function CreateManifestStep({
  onClose,
  activeHabit,
  roadmapHabits,
  goalSeriesIdRef,
  activeHabitRef,
  delusionText,
  setDelusionText,
  description,
  setDescription,
  selectedTemplate,
  setSelectedTemplate,
  customImage,
  setCustomImage,
  selectedImage,
  setSelectedImage,
  customUploadFile,
  setCustomUploadFile,
  deadline,
  setDeadline,
  durationMode,
  setDurationMode,
  fastDurationValue,
  setFastDurationValue,
  updateDeadlineFromFastMode,
  gatekeeper,
}: CreateManifestStepProps) {
  const router = useRouter();
  const { ensureWhitelisted } = useRequireGoodDollarWhitelist();
  const { user } = useUserStore();
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const apolloClient = useApolloClient();
  const { address, isConnected } = useAuth();

  const supportedTokens = useSupportedTokens();
  const defaultToken =
    supportedTokens.find((t) => t.symbol === "G$")?.address ??
    supportedTokens[0]?.address ??
    GOODDOLLAR_ADDRESSES.mainnet;
  const [selectedToken, setSelectedToken] = useState(defaultToken);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);
  const [stakeAmount, setStakeAmount] = useState(0);
  const [inputText, setInputText] = useState("");
  const [stakeInputTouched, setStakeInputTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const { usd: gDollarUsdPrice } = useGoodDollarPrice();

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
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showMilestonesModal, setShowMilestonesModal] = useState(false);
  const [manifestedDurationDays, setManifestedDurationDays] = useState(7);
  const [errorMessage, setErrorMessage] = useState("");
  const [showFaucet, setShowFaucet] = useState(false);
  const [showNewUserGdModal, setShowNewUserGdModal] = useState(false);
  const [isNewUserSession, setIsNewUserSession] = useState(false);

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
    createdDeluluId,
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
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isTokenDropdownOpen]);

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
    try {
      window.sessionStorage.removeItem("delulu:new-user");
    } catch {
      /* ignore */
    }
    setIsNewUserSession(false);
    setShowNewUserGdModal(false);
  }, [isConnected, isNewUserSession, good.isLoading, gdBalance]);

  const selectedTokenBalance = tokenBalances.find(
    (tb) => tb.token.address === selectedToken
  );
  const tokenBalance = selectedTokenBalance?.balance;

  useEffect(() => {
    if (!isSuccess) return;
    refetchAllActiveQueries(apolloClient);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("delulu:created"));
    }

    const sid = goalSeriesIdRef.current;
    const habit = activeHabitRef.current;
    if (createdDeluluId && sid && habit && address) {
      Promise.all([
        fetch("/api/goals/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            onChainId: String(createdDeluluId),
            creatorAddress: address,
            goalSeriesId: sid,
            habitId: habit.id,
          }),
        }),
        fetch(`/api/goals/series/${sid}/habits/${habit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorAddress: address,
            status: "active",
            onChainId: String(createdDeluluId),
          }),
        }),
      ]).catch(console.error);
    }

    if (createdDeluluId) {
      const days =
        durationMode === "fast"
          ? Math.max(1, Math.min(7, parseInt(fastDurationValue) || 7))
          : Math.max(
              1,
              Math.min(
                7,
                Math.round((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
              )
            );
      setManifestedDurationDays(days);
      setShowMilestonesModal(true);
    } else {
      setShowSuccessModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, createdDeluluId, apolloClient]);

  useEffect(() => {
    if (isError && createErrorMessage) {
      setErrorMessage(getErrorMessage(new Error(createErrorMessage)));
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
    const {
      deadline: deadlineDate,
      finalImageUrl,
      token,
      text,
      amount,
      username,
      pfpUrl,
      gatekeeper: gate,
      description: desc,
    } = pendingCreation;
    setIsWaitingForApproval(false);
    setIsUploadingImage(true);
    checkAllowanceWithRetry(refetchAllowance, amount)
      .then((hasAllowance) => {
        if (!hasAllowance) {
          throw new Error("Token allowance not updated. Please try again.");
        }
        return createDelulu(
          token,
          text,
          deadlineDate,
          amount,
          username,
          pfpUrl,
          gate,
          finalImageUrl,
          desc || undefined
        );
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

  const handleTemplateSelect = (template: DelusionTemplate) => {
    setSelectedTemplate(template);
    setSelectedImage(template.image);
    setCustomImage(null);
    setCustomUploadFile(null);
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file");
      setShowErrorModal(true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Image size must be less than 5MB");
      setShowErrorModal(true);
      return;
    }
    setCustomUploadFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (result && typeof result === "string") {
        setCustomImage(result);
        setSelectedImage(result);
        setSelectedTemplate(null);
      } else {
        setErrorMessage("Failed to load image. Please try again.");
        setShowErrorModal(true);
      }
    };
    reader.onerror = () => {
      setErrorMessage("Failed to read image file. Please try again.");
      setShowErrorModal(true);
    };
    reader.readAsDataURL(file);
  };

  const maxStakeValue = calculateMaxStakeValue(tokenBalance);
  const validation = validateDeluluInputs(
    delusionText,
    stakeAmount,
    maxStakeValue,
    selectedImage
  );
  const canCreate = validation.canCreate && !isUploadingImage;
  const exceedsBalance = stakeAmount > maxStakeValue;
  const hasInsufficientBalanceForStake =
    stakeAmount >= MIN_STAKE && maxStakeValue < MIN_STAKE;

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
    if (isProcessing) return;

    const allowed = await ensureWhitelisted("create");
    if (!allowed) return;

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
      const maxVal = calculateMaxStakeValue(tokenBalance);
      const v = validateDeluluInputs(delusionText, stakeAmount, maxVal, selectedImage);
      if (!v.isValid) {
        const firstError =
          v.errors.text || v.errors.stake || v.errors.balance || v.errors.image;
        setIsUploadingImage(false);
        throw new Error(firstError || "Please check your inputs");
      }

      const deadlineDate =
        deadline instanceof Date && !isNaN(deadline.getTime())
          ? deadline
          : getDefaultDeadline();

      let finalImageUrl: string;

      if (customUploadFile) {
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
      } else if (selectedTemplate?.image) {
        finalImageUrl = selectedTemplate.image;
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
      setErrorMessage(getErrorMessage(error));
      setShowErrorModal(true);
    }
  };

  return (
    <>
      <div className="flex flex-1 min-h-0 flex-col overflow-y-auto scrollbar-hide pb-24 lg:pb-8">
        <div className={cn(createFlowPx, createFlowPy)}>
          <div className={cn("flex flex-col lg:flex-row lg:items-start", createFlowGap, "lg:gap-10")}>
            <div className="w-full shrink-0 space-y-4 lg:sticky lg:top-4 lg:w-[300px]">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cover image
              </p>
              <label className="group block cursor-pointer">
                <div
                  className={cn(
                    "relative overflow-hidden rounded-2xl bg-muted transition-all",
                    selectedImage
                      ? "aspect-[4/5] lg:aspect-[3/4]"
                      : "aspect-[4/5] border-2 border-dashed border-border hover:border-foreground/25 lg:aspect-[3/4]"
                  )}
                >
                  {selectedImage ? (
                    <>
                      <img
                        src={selectedImage}
                        alt="Vision"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {delusionText && (
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <p className="line-clamp-3 text-base font-bold leading-snug text-white drop-shadow-md">
                            {delusionText}
                          </p>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/35">
                        <span className="rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                          Change image
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
                      <Upload className="h-8 w-8" />
                      <p className="text-sm font-medium">Tap to upload</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    handleCustomUpload(e);
                    e.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>

              {selectedTemplate && !customImage && !showTemplatePicker && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2.5">
                  <p className="min-w-0 truncate text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Template:</span>{" "}
                    {selectedTemplate.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowTemplatePicker(true)}
                    className="shrink-0 text-xs font-semibold text-foreground hover:underline"
                  >
                    Change
                  </button>
                </div>
              )}

              {showTemplatePicker ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pick a template
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowTemplatePicker(false)}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {TEMPLATES.map((template) => {
                      const isSelected = selectedTemplate?.id === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => {
                            handleTemplateSelect(template);
                            setShowTemplatePicker(false);
                          }}
                          className={cn(
                            "group overflow-hidden rounded-xl border text-left transition-all",
                            isSelected
                              ? "border-foreground bg-secondary ring-2 ring-foreground ring-offset-2 ring-offset-background"
                              : "border-border/80 bg-secondary/50 hover:border-foreground/25 hover:bg-secondary"
                          )}
                        >
                          <div className="relative aspect-[5/4] overflow-hidden bg-muted">
                            <img
                              src={template.image}
                              alt={template.name}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            />
                            {isSelected && (
                              <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm">
                                <Check className="h-3 w-3" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <p
                            className={cn(
                              "truncate px-2.5 py-2 text-[11px] font-semibold leading-tight",
                              isSelected ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {template.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                !selectedTemplate && (
                  <button
                    type="button"
                    onClick={() => setShowTemplatePicker(true)}
                    className="flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4 shrink-0" />
                    <span>
                      Prefer a template?{" "}
                      <span className="font-semibold text-foreground">Browse vision boards</span>
                    </span>
                  </button>
                )
              )}

              {validation.errors.image && submitAttempted && (
                <p className="text-xs text-destructive">{validation.errors.image}</p>
              )}
            </div>

            <div className={cn("min-w-0 flex-1", createFlowFieldGap)}>
              <div>
                <h2 className="text-xl font-black tracking-tight lg:text-2xl">Manifest</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Title, deadline, and stake
                </p>
              </div>

              {activeHabit && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Starting with:</span>{" "}
                  {activeHabit.title}
                </p>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
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
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base font-medium placeholder:text-muted-foreground focus-delulu"
                  autoFocus={!activeHabit}
                />
                <div className="text-right">
                  <span className="text-[11px] text-muted-foreground">
                    {delusionText.length}/{MAX_DELULU_LENGTH}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Description{" "}
                  <span className="font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <TextareaAutosize
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does manifesting this mean to you?"
                  className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-delulu"
                  minRows={2}
                />
              </div>

              <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Deadline
              </label>
              <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => setDurationMode("fast")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[10px] font-bold transition-all",
                    durationMode === "fast"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  # Days
                </button>
                <button
                  type="button"
                  onClick={() => setDurationMode("calendar")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[10px] font-bold transition-all",
                    durationMode === "calendar"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  Calendar
                </button>
              </div>
            </div>

            {durationMode === "calendar" ? (
              <button
                type="button"
                onClick={() => setShowCalendarModal(true)}
                className="group flex w-full items-center justify-between rounded-2xl border border-border bg-secondary px-4 py-3 text-left transition-colors hover:bg-secondary/80"
              >
                <span className="text-base font-medium">
                  {deadline.toLocaleString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors group-hover:bg-muted/60">
                  Change
                </span>
              </button>
            ) : (
              <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 focus-within-delulu">
                <input
                  min={MIN_DURATION_DAYS}
                  max={MAX_DURATION_DAYS}
                  step={1}
                  value={fastDurationValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Allow free typing — only accept digits, no clamping mid-type
                    if (val === "" || /^\d+$/.test(val)) {
                      setFastDurationValue(val);
                    }
                  }}
                  onBlur={() => {
                    const num = Number(fastDurationValue);
                    const clamped = isNaN(num) || num < MIN_DURATION_DAYS
                      ? MIN_DURATION_DAYS
                      : num > MAX_DURATION_DAYS
                        ? MAX_DURATION_DAYS
                        : Math.floor(num);
                    setFastDurationValue(String(clamped));
                    updateDeadlineFromFastMode(String(clamped));
                  }}
                  className="flex-1 bg-transparent text-base font-medium placeholder:text-muted-foreground focus:outline-none"
                  placeholder="Number of days"
                />
                <span className="text-sm font-medium text-muted-foreground">days</span>
              </div>
            )}
          </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Stake
                </label>
                <div className="space-y-1 rounded-2xl border border-border bg-secondary p-3">
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
                    if (!isNaN(numValue) && numValue >= 0) {
                      setStakeAmount(numValue);
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
                    } else {
                      setStakeAmount(currentValue);
                      setInputText(currentValue.toFixed(0));
                    }
                  }}
                  placeholder={`Min ${MIN_STAKE} G$`}
                  className="min-w-0 flex-1 bg-transparent text-2xl font-bold placeholder:text-muted-foreground/40 focus:outline-none"
                />

                <div ref={tokenDropdownRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 shadow-sm transition-colors hover:bg-secondary/80",
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
                    <div className="absolute right-0 top-full z-50 mt-2 min-w-[190px] overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                      {supportedTokens.map((t) => {
                        const tokenBalanceInfo = tokenBalances.find(
                          (tb) =>
                            tb.token.address.toLowerCase() === t.address.toLowerCase()
                        );
                        const balance = tokenBalanceInfo
                          ? parseFloat(tokenBalanceInfo.formatted)
                          : 0;
                        const isLoadingBal = tokenBalanceInfo?.isLoading ?? false;
                        const logoUrl = TOKEN_LOGOS[t.address.toLowerCase()];
                        const isSelected =
                          selectedToken?.toLowerCase() === t.address.toLowerCase();

                        return (
                          <button
                            key={t.address}
                            type="button"
                            onClick={() => {
                              setSelectedToken(t.address);
                              setIsTokenDropdownOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                              isSelected
                                ? "bg-secondary text-foreground"
                                : "bg-secondary/60 text-foreground hover:bg-secondary/80"
                            )}
                          >
                            {logoUrl && (
                              <img
                                src={logoUrl}
                                alt={t.symbol}
                                className="h-5 w-5 shrink-0 rounded-full"
                              />
                            )}
                            <div className="flex flex-1 items-center justify-between gap-2">
                              <span className="text-sm font-bold">{t.symbol}</span>
                              {isConnected && (
                                <span className="text-xs text-muted-foreground">
                                  {isLoadingBal ? "..." : balance.toFixed(2)}
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 shrink-0 text-delulu-yellow-reserved" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs text-muted-foreground">
                  {approxUsdValue && approxUsdValue > 0
                    ? `≈ $${approxUsdValue.toFixed(2)} USD`
                    : `Enter at least ${MIN_STAKE} G$`}
                </span>
                {isConnected && selectedTokenBalance ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                    <TokenBadge tokenAddress={selectedToken} size="sm" showText={false} />
                    {parseFloat(selectedTokenBalance.formatted).toFixed(2)}{" "}
                    <span className="font-normal text-muted-foreground">available</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Connect wallet</span>
                )}
              </div>
            </div>

            {isConnected && (stakeInputTouched || submitAttempted) && (
              <>
                {stakeAmount <= 0 && (
                  <p className="mt-1.5 text-xs text-destructive">
                    A stake of at least {MIN_STAKE} G$ is required
                  </p>
                )}
                {stakeAmount > 0 && stakeAmount < MIN_STAKE && (
                  <p className="mt-1.5 text-xs text-destructive">
                    Minimum stake is {MIN_STAKE} G$
                  </p>
                )}
                {stakeAmount >= MIN_STAKE &&
                  (hasInsufficientBalanceForStake || exceedsBalance) && (
                    <p className="mt-1.5 text-xs text-destructive">
                      {hasInsufficientBalanceForStake
                        ? `You need at least ${MIN_STAKE} G$. Claim your free G$ first.`
                        : "Amount exceeds your balance"}
                    </p>
                  )}
              </>
            )}
          </div>

              <div>
                <button
                  type="button"
                  onClick={handleCreate}
              disabled={!canCreate || isProcessing}
              className={cn(
                "w-full rounded-full py-4 text-base font-bold transition-all bg-foreground text-background active:scale-[0.98]",
                (!canCreate || isProcessing) && "cursor-not-allowed opacity-40"
              )}
            >
              {!isGoodDollarSelected && (isApproving || isApprovingConfirming) ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </span>
              ) : isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progressStep?.label || "Processing..."}
                </span>
              ) : (
                "Manifest this dream"
              )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
              className="w-full rounded-full bg-foreground py-3.5 text-sm font-bold text-background active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </ModalContent>
      </Modal>

      <FeedbackModal
        isOpen={showSuccessModal}
        type="success"
        title="Vision Manifested!"
        message="Your delulu is live! Head to the Milestones tab to add your roadmap."
        onClose={() => {
          setShowSuccessModal(false);
          onClose();
        }}
        actionText="Add Milestones"
      />

      <FeedbackModal
        isOpen={showErrorModal}
        type="error"
        title="Creation Failed"
        message={errorMessage || "Failed to create delulu. Please try again."}
        onClose={() => setShowErrorModal(false)}
        actionText="Try Again"
      />

      <FaucetModal open={showFaucet} onOpenChange={setShowFaucet} />

      <AiMilestonesModal
        open={showMilestonesModal}
        onOpenChange={setShowMilestonesModal}
        deluluId={createdDeluluId}
        dreamTitle={delusionText}
        durationDays={manifestedDurationDays}
        onDone={() => {
          setShowMilestonesModal(false);
          router.push("/");
        }}
      />

      <Modal open={showNewUserGdModal} onOpenChange={setShowNewUserGdModal}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Claim free G$ first</ModalTitle>
          </ModalHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You need G$ to stake your dream. G$ is free on mainnet.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowNewUserGdModal(false);
                onClose();
                window.location.href = "/daily-claim/verify?returnTo=%2Fboard";
              }}
              className="w-full rounded-xl border border-border bg-delulu-yellow py-3 text-sm font-black text-delulu-charcoal"
            >
              Verify & Claim G$
            </button>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
