"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  X,
  Upload,
  ChevronDown,
  Check,
  Dumbbell,
  GraduationCap,
  BookOpen,
  Briefcase,
  PiggyBank,
  Moon,
  Flame,
  DollarSign,
  Heart,
  Users,
  Brain,
  Target,
  ArrowRight,
  Clock,
  Droplets,
  Video,
  type LucideIcon,
} from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useApolloClient } from "@apollo/client/react";
import { refetchAllActiveQueries } from "@/lib/graph/refetch-utils";
import { FeedbackModal } from "@/components/feedback-modal";
import { AiMilestonesModal } from "@/components/ai-milestones-modal";
import { useCreateDelulu } from "@/hooks/use-delulu-contract";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { TokenBadge } from "@/components/token-badge";
import { useSupportedTokens } from "@/hooks/use-supported-tokens";
import { GOODDOLLAR_ADDRESSES, TOKEN_LOGOS } from "@/lib/constant";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { useBalance } from "wagmi";
import { useAuth } from "@/hooks/use-auth";
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
  getOrigin,
} from "@/lib/create-delulu-helpers";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SideEffectHabit {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  suggestedDays: number;
  category: "finance" | "health" | "career" | "education" | "social" | "mindset" | "other";
  emoji: string;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

const GOAL_SUGGESTIONS: { icon: LucideIcon; label: string }[] = [
  { icon: BookOpen,      label: "Read daily" },
  { icon: Flame,         label: "Get fit" },
  { icon: Droplets,      label: "Stay hydrated" },
  { icon: Video,         label: "Create content" },
  { icon: Heart,         label: "Relationship" },
  { icon: Moon,          label: "Sleep better" },
  { icon: GraduationCap,         label: "Study every day" },
  { icon: Briefcase,     label: "Get a new job" },
  { icon: PiggyBank,     label: "Save money" },
];

const CATEGORY_ICONS: Record<SideEffectHabit["category"], LucideIcon> = {
  finance:   DollarSign,
  health:    Heart,
  career:    Briefcase,
  education: BookOpen,
  social:    Users,
  mindset:   Brain,
  other:     Target,
};

const PRIORITY_COLOR = {
  high:   "bg-rose-500",
  medium: "bg-amber-400",
  low:    "bg-sky-400",
} as const;

// ─── Templates ───────────────────────────────────────────────────────────────

const TEMPLATES = [
  { id: 1, name: "New Job", image: "/templates/t0.png", fontWeight: "700" },
  { id: 2, name: "Software Engineer", image: "/templates/t1.jpg", fontWeight: "700" },
  { id: 3, name: "Traveller", image: "/templates/t2.png", fontWeight: "700" },
  { id: 4, name: "Startup", image: "/templates/t9.jpg", fontWeight: "700" },
  { id: 5, name: "Relationship", image: "/templates/t3.png", fontWeight: "700" },
  { id: 6, name: "Graduate", image: "/templates/t6.jpg", fontWeight: "700" },
  { id: 7, name: "Workout", image: "/templates/t8.jpg", fontWeight: "700" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateDelusionContentProps {
  onClose: () => void;
}

// ─── Step type ────────────────────────────────────────────────────────────────

type Step = "dream" | "checklist" | "roadmap" | "gallery";

const STEP_TITLES: Record<Step, string> = {
  dream: "New Vision",
  checklist: "Side Effects",
  roadmap: "Your Roadmap",
  gallery: "Manifest It",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateDelusionContent({ onClose }: CreateDelusionContentProps) {
  const router = useRouter();
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

  // ── Step management ─────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("dream");
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // ── AI / Series state ────────────────────────────────────────────────────────
  const [ultimateGoal, setUltimateGoal] = useState("");
  const [aiHabits, setAiHabits] = useState<SideEffectHabit[]>([]);
  const [alreadyHas, setAlreadyHas] = useState<Set<string>>(new Set());
  const [habitDurations, setHabitDurations] = useState<Record<string, number>>({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [goalSeriesId, setGoalSeriesId] = useState<string | null>(null);
  const [isSavingRoadmap, setIsSavingRoadmap] = useState(false);
  const [activeHabit, setActiveHabit] = useState<SideEffectHabit | null>(null);

  // refs for isSuccess effect (avoid stale closure)
  const goalSeriesIdRef = useRef<string | null>(null);
  const activeHabitRef = useRef<SideEffectHabit | null>(null);
  useEffect(() => { goalSeriesIdRef.current = goalSeriesId; }, [goalSeriesId]);
  useEffect(() => { activeHabitRef.current = activeHabit; }, [activeHabit]);

  // ── Image / template state ───────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<(typeof TEMPLATES)[0] | null>(null);
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

  // ── Form state ───────────────────────────────────────────────────────────────
  const [delusionText, setDelusionText] = useState("");
  const [description, setDescription] = useState("");
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const supportedTokens = useSupportedTokens();
  const initialToken =
    supportedTokens.find((t) => t.symbol === "G$")?.address ??
    supportedTokens[0]?.address ??
    "";
  const [selectedToken, setSelectedToken] = useState<string>(initialToken);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAuth();
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

  const [deadline, setDeadline] = useState<Date>(() => getDefaultDeadline());
  const [durationMode, setDurationMode] = useState<"fast" | "calendar">("calendar");
  const [fastDurationValue, setFastDurationValue] = useState<string>("7");

  const updateDeadlineFromFastMode = useCallback((value: string) => {
    if (!value || value === "" || isNaN(Number(value))) return;
    let numValue = Math.floor(Number(value));
    if (numValue < MIN_DURATION_DAYS) numValue = MIN_DURATION_DAYS;
    if (numValue > MAX_DURATION_DAYS) numValue = MAX_DURATION_DAYS;
    const now = new Date();
    const newDeadline = new Date(now);
    newDeadline.setTime(now.getTime() + numValue * 24 * 60 * 60 * 1000);
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
      ? [{ token: cusdToken, balance: cusd.balance, formatted: cusd.formatted, isLoading: cusd.isLoading, error: cusd.error }]
      : []),
    ...(gToken
      ? [{ token: gToken, balance: good.balance, formatted: good.formatted, isLoading: good.isLoading, error: good.error }]
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
    if (typeof window !== "undefined") {
      try { window.sessionStorage.removeItem("delulu:new-user"); } catch { }
    }
    setIsNewUserSession(false);
    setShowNewUserGdModal(false);
  }, [isConnected, isNewUserSession, good.isLoading, gdBalance]);

  const selectedTokenBalance = tokenBalances.find((tb) => tb.token.address === selectedToken);
  const tokenBalance = selectedTokenBalance?.balance;

  // ── isSuccess: link to Supabase series, then show milestone modal ───────────
  useEffect(() => {
    if (isSuccess) {
      refetchAllActiveQueries(apolloClient);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("delulu:created"));
      }

      // Link to goal series if this came from the AI create flow
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
        // Capture the exact duration the user chose before showing the milestone modal
        const days =
          durationMode === "fast"
            ? Math.max(1, Math.min(7, parseInt(fastDurationValue) || 7))
            : Math.max(1, Math.min(7, Math.round((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))));
        setManifestedDurationDays(days);
        setShowMilestonesModal(true);
      } else {
        setShowSuccessModal(true);
      }
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

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleTemplateSelect = (template: (typeof TEMPLATES)[0]) => {
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

  const handleClose = () => {
    setStep("dream");
    setUltimateGoal("");
    setAiHabits([]);
    setAlreadyHas(new Set());
    setHabitDurations({});
    setAiError(null);
    setGoalSeriesId(null);
    setActiveHabit(null);
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

  const handleBack = () => {
    if (step === "checklist") { setStep("dream"); return; }
    if (step === "roadmap") { setStep("checklist"); return; }
    if (step === "gallery") {
      if (aiHabits.length > 0) { setStep("roadmap"); return; }
    }
    onClose();
  };

  // ── AI: analyse goal ────────────────────────────────────────────────────────

  const handleAnalyzeGoal = async () => {
    if (!ultimateGoal.trim()) return;
    setIsLoadingAI(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/side-effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: ultimateGoal }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "AI analysis failed");
      }
      const { habits } = await res.json();
      setAiHabits(habits);
      const durations: Record<string, number> = {};
      habits.forEach((h: SideEffectHabit) => { durations[h.id] = Math.min(MAX_DURATION_DAYS, h.suggestedDays); });
      setHabitDurations(durations);
      setStep("checklist");
    } catch (err: any) {
      setAiError(err.message || "Failed to analyse dream");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const toggleAlreadyHas = (id: string) => {
    setAlreadyHas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // sorted roadmap: only unchecked, HIGH → MEDIUM → LOW
  const roadmapHabits = aiHabits
    .filter((h) => !alreadyHas.has(h.id))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  // ── Save roadmap & advance to gallery ───────────────────────────────────────

  const handleSaveRoadmap = async () => {
    if (!address) return;
    setIsSavingRoadmap(true);
    setAiError(null);
    try {
      const pendingHabits = roadmapHabits.map((h) => ({
        id: h.id,
        title: h.title,
        description: h.description,
        priority: h.priority,
        category: h.category,
        suggestedDays: habitDurations[h.id] ?? h.suggestedDays,
        alreadyHas: false,
        emoji: h.emoji,
      }));
      const skippedHabits = aiHabits
        .filter((h) => alreadyHas.has(h.id))
        .map((h) => ({
          id: h.id,
          title: h.title,
          description: h.description,
          priority: h.priority,
          category: h.category,
          suggestedDays: h.suggestedDays,
          alreadyHas: true,
          emoji: h.emoji,
        }));

      let seriesId: string | null = null;
      try {
        const res = await fetch("/api/goals/series", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorAddress: address,
            ultimateGoal,
            aiSideEffects: aiHabits,
            habits: [...pendingHabits, ...skippedHabits],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          seriesId = json.seriesId ?? null;
        } else {
          console.warn("[goals/series] save failed, continuing without series tracking");
        }
      } catch (err) {
        console.warn("[goals/series] save error, continuing without series tracking", err);
      }
      if (seriesId) setGoalSeriesId(seriesId);

      // Pre-fill gallery with first habit
      const first = roadmapHabits[0];
      if (first) {
        setActiveHabit(first);
        setDelusionText(first.title);
        setDescription(first.description || "");
        const days = String(Math.min(MAX_DURATION_DAYS, habitDurations[first.id] ?? first.suggestedDays));
        setFastDurationValue(days);
        setDurationMode("fast");
        updateDeadlineFromFastMode(days);
      }
      setStep("gallery");
    } catch (err: any) {
      setAiError(err.message || "Failed to save roadmap");
    } finally {
      setIsSavingRoadmap(false);
    }
  };

  // ── Create on-chain ──────────────────────────────────────────────────────────

  const maxStakeValue = calculateMaxStakeValue(tokenBalance);
  const validation = validateDeluluInputs(delusionText, stakeAmount, maxStakeValue, selectedImage);
  const canCreate = validation.canCreate && !isUploadingImage;
  const exceedsBalance = stakeAmount > maxStakeValue;
  const hasInsufficientBalanceForStake = stakeAmount >= MIN_STAKE && maxStakeValue < MIN_STAKE;

  const progressStep = getProgressStep(
    isUploadingImage, isApproving, isApprovingConfirming, isCreating, isConfirming
  );

  const isProcessing =
    isCreating || isApproving || isApprovingConfirming || isUploadingImage ||
    (isWaitingForApproval && !isApprovalSuccess);

  const handleCreate = async () => {
    setSubmitAttempted(true);
    if (isProcessing) return;

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
      const validation = validateDeluluInputs(delusionText, stakeAmount, maxStakeValue, selectedImage);
      if (!validation.isValid) {
        const firstError =
          validation.errors.text || validation.errors.stake ||
          validation.errors.balance || validation.errors.image;
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
      setErrorMessage(getErrorMessage(error));
      setShowErrorModal(true);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="relative h-screen bg-background text-foreground flex flex-col overflow-hidden">
        <div className="max-w-xl mx-auto w-full flex flex-col flex-1 overflow-hidden">

        {/* ── Header ── */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {/* Step dots */}
          {step !== "gallery" ? (
            <div className="flex items-center gap-1.5">
              {(["dream","checklist","roadmap"] as const).map((s) => (
                <div
                  key={s}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    step === s
                      ? "w-4 h-1.5 bg-foreground"
                      : ["checklist","roadmap"].indexOf(step) > ["dream","checklist","roadmap"].indexOf(s)
                        ? "w-1.5 h-1.5 bg-foreground/40"
                        : "w-1.5 h-1.5 bg-foreground/20"
                  )}
                />
              ))}
            </div>
          ) : (
            <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
              Create
            </span>
          )}
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ════════════════════════════════════════════════
            STEP A — Dream input
        ════════════════════════════════════════════════ */}
        {step === "dream" && (
          <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
            <div className="my-auto px-5 py-8 flex flex-col gap-6">

              {/* Headline */}
              <div>
                <h2 className="text-[22px] font-black leading-tight mb-1">What&apos;s your dream?</h2>
                <p className="text-sm text-muted-foreground">We&apos;ll map the habits that make it real.</p>
              </div>

              {/* Input */}
              <input
                type="text"
                value={ultimateGoal}
                onChange={(e) => setUltimateGoal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && ultimateGoal.trim()) handleAnalyzeGoal(); }}
                placeholder="e.g. sleep better, create content, get fit…"
                className="w-full bg-transparent border-2 border-border  rounded-xl px-4 py-5 text-base font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/15 transition-all"
                autoFocus
              />

              {/* Inspiration grid */}
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">Inspiration</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GOAL_SUGGESTIONS.map((s) => {
                    const Icon = s.icon;
                    const selected = ultimateGoal === s.label;
                    return (
                      <button
                        key={s.label}
                        onClick={() => setUltimateGoal(s.label)}
                        className={cn(
                          "flex bg-secondary items-center gap-3 px-3.5 py-1 rounded-xl border-2 text-left transition-all",
                          selected
                            ? "border-delulu-yellow-reserved border-[0.5px] bg-delulu-yellow-reserved/10"
                            : "border-border hover:border-border/80 hover:bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                          selected ? "bg-delulu-yellow-reserved/30" : "bg-muted"
                        )}>
                          <Icon className={cn("w-4 h-4 flex-shrink-0", selected ? "text-foreground" : "text-muted-foreground")} strokeWidth={1.75} />
                        </div>
                        <span className={cn("text-xs font-semibold leading-tight", selected ? "text-foreground" : "text-muted-foreground")}>
                          {s.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {aiError && <p className="text-xs text-destructive -mt-2">{aiError}</p>}

              {/* CTA */}
              <div className="flex items-center mt-4 flex-col gap-2 pt-1">
                <button
                  onClick={handleAnalyzeGoal}
                  disabled={!ultimateGoal.trim() || isLoadingAI}
                  className={cn(
                    "w-fit py-3.5 px-5 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all",
                    "bg-delulu-yellow text-delulu-charcoal active:scale-[0.98]",
                    (!ultimateGoal.trim() || isLoadingAI) && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {isLoadingAI
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analysing…</>
                    : <>Map my journey</>}
                </button>
                <button onClick={() => setStep("gallery")} className="text-xs text-center text-muted-foreground py-1 hover:text-foreground transition-colors">
                  Skip, create directly
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            STEP B — Checklist
        ════════════════════════════════════════════════ */}
        {step === "checklist" && (
          <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
            <div className="my-auto px-5 py-8 flex flex-col gap-5">

              {/* Header */}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{ultimateGoal}</p>
                <h2 className="text-[22px] font-black leading-tight">What do you already have?</h2>
              </div>

              {/* Checklist — needs + already have */}
              <div className="space-y-1">
                {/* Needs work */}
                {aiHabits.filter((h) => !alreadyHas.has(h.id)).map((habit) => (
                  <button
                    key={habit.id}
                    onClick={() => toggleAlreadyHas(habit.id)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-muted/50 text-left transition-colors group"
                  >
                    {/* Square checkbox */}
                    <div className="flex-shrink-0 w-5 h-5 rounded-[4px] border-2 border-border flex items-center justify-center transition-all group-hover:border-foreground/40" />
                    <span className="flex-1 text-sm font-medium">{habit.title}</span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
                      habit.priority === "high" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                      habit.priority === "medium" && "bg-amber-400/15 text-amber-600 dark:text-amber-400",
                      habit.priority === "low" && "bg-sky-400/15 text-sky-600 dark:text-sky-400"
                    )}>
                      {habit.priority}
                    </span>
                  </button>
                ))}

                {/* Divider + already have */}
                {alreadyHas.size > 0 && (
                  <>
                    <div className="flex items-center gap-2 py-1">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Already have · {alreadyHas.size}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {aiHabits.filter((h) => alreadyHas.has(h.id)).map((habit) => (
                      <button
                        key={habit.id}
                        onClick={() => toggleAlreadyHas(habit.id)}
                        className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-muted/30 text-left transition-colors"
                      >
                        {/* Checked square */}
                        <div className="flex-shrink-0 w-5 h-5 rounded-[4px] border-2 border-foreground/30 bg-foreground/10 flex items-center justify-center">
                          <Check className="w-3 h-3 text-foreground/50" strokeWidth={3} />
                        </div>
                        <span className="flex-1 text-sm font-medium line-through text-muted-foreground/50">{habit.title}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* CTA */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => roadmapHabits.length > 0 ? setStep("roadmap") : setStep("gallery")}
                  className="w-full py-3.5 rounded-2xl bg-delulu-yellow text-delulu-charcoal font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  {roadmapHabits.length > 0
                    ? `${roadmapHabits.length} step${roadmapHabits.length !== 1 ? "s" : ""} to go, see my plan`
                    : "Create my dream"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            STEP C — Roadmap preview
        ════════════════════════════════════════════════ */}
        {step === "roadmap" && (
          <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
            <div className="my-auto px-5 py-8 flex flex-col gap-5">

              {/* Header */}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{ultimateGoal}</p>
                <h2 className="text-[22px] font-black leading-tight">Your plan</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{roadmapHabits.length} step{roadmapHabits.length !== 1 ? "s" : ""} · set your timeline</p>
              </div>

              {/* Info banner */}
              <div className="flex items-start gap-2.5 bg-delulu-yellow-reserved/10 border border-delulu-yellow-reserved/30 rounded-xl px-3.5 py-3">
                <div className="w-1.5 h-1.5 rounded-full bg-delulu-yellow-reserved mt-1.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Step 1 gets created on-chain first. The rest of your plan stays saved. You&apos;ll unlock each step after the previous one ends.
                </p>
              </div>

              {/* Timeline */}
              <div>
                {roadmapHabits.map((habit, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === roadmapHabits.length - 1;
                  const days = habitDurations[habit.id] ?? habit.suggestedDays;
                  return (
                    <div key={habit.id} className="flex gap-4">
                      {/* Line + number */}
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-black flex-shrink-0 z-10",
                          isFirst
                            ? "border-delulu-yellow-reserved bg-delulu-yellow-reserved text-delulu-charcoal"
                            : "border-border bg-background text-muted-foreground"
                        )}>
                          {idx + 1}
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-border my-1" />}
                      </div>

                      {/* Card */}
                      <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
                        <div className={cn(
                          "border rounded-2xl px-4 py-3 flex items-center gap-3",
                          isFirst
                            ? "bg-delulu-yellow-reserved/5 border-delulu-yellow-reserved/30"
                            : "bg-card border-border"
                        )}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{habit.title}</p>
                            <p className="text-xs text-muted-foreground capitalize mt-0.5">{habit.category}</p>
                          </div>
                          {/* +/- duration stepper */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setHabitDurations((prev) => ({ ...prev, [habit.id]: Math.max(1, days - 1) }))}
                              className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 font-bold text-base leading-none transition-colors"
                              aria-label="Decrease days"
                            >
                              −
                            </button>
                            <div className="flex items-baseline gap-0.5 min-w-[42px] justify-center">
                              <span className="text-sm font-bold tabular-nums">{days}</span>
                              <span className="text-[10px] text-muted-foreground">d</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setHabitDurations((prev) => ({ ...prev, [habit.id]: Math.min(MAX_DURATION_DAYS, days + 1) }))}
                              className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 font-bold text-base leading-none transition-colors"
                              aria-label="Increase days"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {aiError && <p className="text-xs text-destructive">{aiError}</p>}

              {/* CTA */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSaveRoadmap}
                  disabled={isSavingRoadmap || !address}
                  className={cn(
                    "w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                    "bg-delulu-yellow text-delulu-charcoal active:scale-[0.98]",
                    (isSavingRoadmap || !address) && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {isSavingRoadmap
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                    : <>Save & start step 1 <ArrowRight className="w-3.5 h-3.5" /></>}
                </button>
                <button onClick={() => setStep("gallery")} className="text-xs text-center text-muted-foreground py-1 hover:text-foreground transition-colors">
                  Skip, create directly
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            STEP D — Gallery / Manifest form (existing)
        ════════════════════════════════════════════════ */}
        {step === "gallery" && (
          <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
            <div className="my-auto px-4 py-6 space-y-3">

              {/* Active habit banner (shown when coming from AI flow) */}
              {activeHabit && (() => {
                const Icon = CATEGORY_ICONS[activeHabit.category] ?? Target;
                return (
                  <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                        Step 1 of {roadmapHabits.length}
                      </p>
                      <p className="text-sm font-semibold truncate">{activeHabit.title}</p>
                    </div>
                    <div className={cn("w-1.5 h-5 rounded-full flex-shrink-0", PRIORITY_COLOR[activeHabit.priority])} />
                  </div>
                );
              })()}

              {/* Vision board preview + template strip */}
              <div>
                <div
                  className={cn(
                    "relative rounded-2xl overflow-hidden bg-muted mb-3 transition-all",
                    selectedImage ? "h-56" : "h-44 border-2 border-dashed border-border"
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

                {/* Template strip */}
                <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
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
                    <input type="file" accept="image/*" onChange={handleCustomUpload} className="hidden" />
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
                        <img src={template.image} alt={template.name} className="w-full h-full object-cover" />
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
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-base font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border focus:border-foreground/30 transition-all"
                  autoFocus={!activeHabit}
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
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-border focus:border-foreground/30 transition-all"
                  minRows={2}
                />
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    Deadline
                  </label>
                  {/* Toggle pills */}
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setDurationMode("fast")}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all",
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
                        "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all",
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
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 flex items-center justify-between hover:bg-muted transition-colors text-left group"
                  >
                    <span className="text-base font-medium">
                      {deadline.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="text-xs text-muted-foreground bg-background group-hover:bg-muted/60 px-2.5 py-1 rounded-full transition-colors border border-border">
                      Change
                    </span>
                  </button>
                ) : (
                  <div className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 flex items-center gap-3 focus-within:ring-1 focus-within:ring-border focus-within:border-foreground/30 transition-all">
                    <input
                      min={1}
                      step={1}
                      value={fastDurationValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") { setFastDurationValue(val); return; }
                        const num = Number(val);
                        if (!isNaN(num) && num > 0) {
                          const capped = String(Math.min(MAX_DURATION_DAYS, Math.floor(num)));
                          setFastDurationValue(capped);
                          updateDeadlineFromFastMode(capped);
                        }
                      }}
                      onBlur={() => {
                        if (fastDurationValue === "" || isNaN(Number(fastDurationValue)) || Number(fastDurationValue) < 1) {
                          setFastDurationValue("1");
                          updateDeadlineFromFastMode("1");
                        }
                      }}
                      className="flex-1 bg-transparent text-base font-medium focus:outline-none placeholder:text-muted-foreground"
                      placeholder="Number of days"
                    />
                    <span className="text-muted-foreground font-medium text-sm">days</span>
                  </div>
                )}
              </div>

              {/* Stake */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  Stake
                </label>
                <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => {
                        const value = e.target.value;
                        setInputText(value);
                        if (value.trim() === "") { setStakeAmount(0); return; }
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue) && numValue >= 0) {
                          setStakeAmount(numValue);
                        }
                      }}
                      onBlur={(e) => {
                        setStakeInputTouched(true);
                        const currentValue = parseFloat(e.target.value);
                        if (e.target.value === "" || isNaN(currentValue) || currentValue < 0) {
                          setStakeAmount(0); setInputText(""); return;
                        }
                        if (currentValue > 0 && currentValue < MIN_STAKE) {
                          setStakeAmount(MIN_STAKE); setInputText(MIN_STAKE.toString());
                        } else {
                          setStakeAmount(currentValue); setInputText(currentValue.toFixed(0));
                        }
                      }}
                      placeholder={`Min ${MIN_STAKE} G$`}
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
                          const selectedTokenInfo = supportedTokens.find((t) => t.address === selectedToken);
                          const logoUrl = selectedToken ? TOKEN_LOGOS[selectedToken.toLowerCase()] : undefined;
                          return (
                            <>
                              {logoUrl && <img src={logoUrl} alt="" className="h-4 w-4 rounded-full" />}
                              <span className="text-sm font-bold">{selectedTokenInfo?.symbol || "Select"}</span>
                              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isTokenDropdownOpen && "rotate-180")} />
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
                            const balance = tokenBalanceInfo ? parseFloat(tokenBalanceInfo.formatted) : 0;
                            const isLoading = tokenBalanceInfo?.isLoading ?? false;
                            const logoUrl = TOKEN_LOGOS[t.address.toLowerCase()];
                            const isSelected = selectedToken?.toLowerCase() === t.address.toLowerCase();

                            return (
                              <button
                                key={t.address}
                                onClick={() => { setSelectedToken(t.address); setIsTokenDropdownOpen(false); }}
                                className={cn(
                                  "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
                                  isSelected ? "bg-muted text-foreground" : "hover:bg-muted/60 text-foreground"
                                )}
                              >
                                {logoUrl && <img src={logoUrl} alt={t.symbol} className="h-5 w-5 rounded-full flex-shrink-0" />}
                                <div className="flex-1 flex items-center justify-between gap-2">
                                  <span className="font-bold text-sm">{t.symbol}</span>
                                  {isConnected && (
                                    <span className="text-xs text-muted-foreground">
                                      {isLoading ? "..." : balance.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-delulu-yellow-reserved flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {approxUsdValue && approxUsdValue > 0 ? `≈ $${approxUsdValue.toFixed(2)} USD` : `Enter at least ${MIN_STAKE} G$`}
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

                {isConnected && (stakeInputTouched || submitAttempted) && (
                  <>
                    {stakeAmount <= 0 && (
                      <p className="text-xs text-destructive mt-1.5">
                        A stake of at least {MIN_STAKE} G$ is required
                      </p>
                    )}
                    {stakeAmount > 0 && stakeAmount < MIN_STAKE && (
                      <p className="text-xs text-destructive mt-1.5">
                        Minimum stake is {MIN_STAKE} G$
                      </p>
                    )}
                    {stakeAmount >= MIN_STAKE && (hasInsufficientBalanceForStake || exceedsBalance) && (
                      <p className="text-xs text-destructive mt-1.5">
                        {hasInsufficientBalanceForStake
                          ? `You need at least ${MIN_STAKE} G$. Claim your free G$ first.`
                          : "Amount exceeds your balance"}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Bottom CTA */}
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
                    "Manifest this dream"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        </div>{/* end max-w-xl centering wrapper */}

        {/* Calendar modal (gallery step only) */}
        <Modal open={showCalendarModal} onOpenChange={setShowCalendarModal}>
          <ModalContent className="max-w-md">
            <ModalHeader>
              <ModalTitle>Pick a deadline</ModalTitle>
            </ModalHeader>
            <div className="mt-4 space-y-4">
              <DateTimePicker
                value={deadline}
                onChange={(date) => { if (date) setDeadline(date); }}
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
        title="Vision Manifested!"
        message="Your delulu is live! Head to the Milestones tab to add your roadmap. Your delulu won't appear on the home feed until you add milestones."
        onClose={handleSuccessClose}
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

      <UserSetupModal
        open={showUserSetupModal && needsSetup}
        onOpenChange={(open) => {
          setShowUserSetupModal(open);
          if (!open && needsSetup) onClose();
        }}
        onComplete={(username, email) => {
          console.log("User setup completed:", { username, email });
          setShowUserSetupModal(false);
        }}
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
              You need G$ to stake your dream and others can use G$ to buy your shares. Don&apos;t
              worry, G$ is free on mainnet.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowNewUserGdModal(false);
                onClose();
                window.location.href = "/daily-claim/verify?returnTo=%2Fboard";
              }}
              className={cn(
                "w-full rounded-xl py-3 text-sm font-black",
                "bg-delulu-yellow text-delulu-charcoal border border-border"
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
