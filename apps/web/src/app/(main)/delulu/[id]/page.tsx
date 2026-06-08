"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useWaitForTransactionReceipt, useBalance } from "wagmi";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { useAuth } from "@/hooks/use-auth";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { useQueryClient } from "@tanstack/react-query";
import { useApolloClient } from "@apollo/client/react";
import {
  refetchDeluluData,
  refetchAfterClaim,
  refetchAllActiveQueries,
} from "@/lib/graph/refetch-utils";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useUserPosition } from "@/hooks/use-user-position";
import { useClaimWinnings } from "@/hooks/use-claim-winnings";
import { useUserClaimableAmount } from "@/hooks/use-user-claimable-amount";
import { useGraphDelulu, useGraphDeluluStakes } from "@/hooks/graph";
import { useChallenges } from "@/hooks/use-challenges";
import { useJoinChallenge } from "@/hooks/use-join-challenge";
import { useDeluluMetadata } from "@/hooks/use-delulu-metadata";
import type { EditSheetMode } from "@/components/edit-delulu-sheet";
import { DeluluPageLoading } from "@/components/delulu-detail/delulu-page-loading";

const DeluluDetailHeader = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-detail-header").then(
      (m) => m.DeluluDetailHeader,
    ),
);
const DeluluDetailPinCard = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-detail-pin-card").then(
      (m) => m.DeluluDetailPinCard,
    ),
);
const DeluluDetailCommentsSection = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-detail-comments-section").then(
      (m) => m.DeluluDetailCommentsSection,
    ),
  { ssr: false },
);
const DeluluClaimSection = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-claim-section").then(
      (m) => m.DeluluClaimSection,
    ),
  { ssr: false },
);
const DeluluLeaderboardSection = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-leaderboard-section").then(
      (m) => m.DeluluLeaderboardSection,
    ),
  { ssr: false },
);
const DeluluCampaignSection = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-campaign-section").then(
      (m) => m.DeluluCampaignSection,
    ),
  { ssr: false },
);

const DeluluMilestonesSidebar = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-milestones-sidebar").then(
      (m) => m.DeluluMilestonesSidebar,
    ),
  { ssr: false },
);

const DeluluDetailOverlays = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-detail-overlays").then(
      (m) => m.DeluluDetailOverlays,
    ),
  { ssr: false },
);

const DeluluShareMenu = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-share-menu").then(
      (m) => m.DeluluShareMenu,
    ),
  { ssr: false },
);

const RelatedDelulusSection = dynamic(
  () =>
    import("@/components/related-delulus-section").then(
      (m) => m.RelatedDelulusSection,
    ),
  { ssr: false },
);

import { usePfps } from "@/hooks/use-profile-pfp";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { cn } from "@/lib/utils";
import { normalizeDeluluImageSrc } from "@/lib/normalize-image-src";
import {
  DELULU_CHAIN_ID,
  getDeluluContractAddress,
} from "@/lib/constant";
import {
  formatUsdEquivalent,
  getDefaultTipAmount,
  getTipQuickAmounts,
  getTokenSymbol,
  parseTokenAmount,
} from "@/lib/token-amounts";
import { DELULU_ABI } from "@/lib/abi";
import {
  resolveIPFSContent,
  type DeluluIPFSMetadata,
} from "@/lib/graph/ipfs-cache";
import {
  getMilestoneEndTimeMs,
  getDeluluCreatedAtMs,
  getMilestoneLabel,
  formatMilestoneCountdown,
  formatResolutionEndsLine,
} from "@/lib/milestone-utils";
import { getContractErrorDisplay, isInsufficientGasError } from "@/lib/contract-error";
import { sumDeluluEarnedPoints } from "@/lib/delulu-earned-points";
import {
  buildDeluluLeaderboard,
  getDeluluRemainingDaysTotal,
  getMaxDaysPerRow,
  getNewMilestoneTiming,
} from "./delulu-page-helpers";

export default function DeluluPage() {
  const router = useRouter();
  const params = useParams();
  const deluluId = params.id as string;

  const { authenticated, isConnected, address } = useAuth();
  const { redirectToSignIn } = useRedirectToSignIn();
  const { username: currentUserUsername } = useUsernameByAddress(address as `0x${string}` | undefined);
  const apolloClient = useApolloClient();
  const queryClient = useQueryClient();

  const {
    delulu,
    milestones,
    isLoading: isLoadingDelulu,
    error: deluluError,
    refetch: refetchDelulu,
  } = useGraphDelulu(deluluId);

  const parsedRouteDeluluId = useMemo(() => {
    const n = Number.parseInt(deluluId, 10);
    if (deluluId === "" || Number.isNaN(n) || !Number.isFinite(n) || n < 0) return null;
    return n;
  }, [deluluId]);

  const [ipfsMetadata, setIpfsMetadata] = useState<DeluluIPFSMetadata | null>(
    null,
  );

  useEffect(() => {
    if (!delulu?.contentHash) {
      setIpfsMetadata(null);
      return;
    }

    let cancelled = false;

    resolveIPFSContent(delulu.contentHash)
      .then((meta) => {
        if (!cancelled) {
          setIpfsMetadata(meta);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIpfsMetadata(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [delulu?.contentHash]);

  const deluluIdForState = useMemo(() => {
    if (!delulu) return parsedRouteDeluluId;
    if (typeof delulu.id === "number" && Number.isFinite(delulu.id) && delulu.id >= 0) {
      return delulu.id;
    }
    if (
      delulu.onChainId != null &&
      delulu.onChainId !== "" &&
      !Number.isNaN(Number(delulu.onChainId))
    ) {
      return Number(delulu.onChainId);
    }
    return parsedRouteDeluluId;
  }, [delulu, parsedRouteDeluluId]);

  const marketToken = delulu?.tokenAddress;
  const deluluIdForHooks =
    deluluIdForState !== null && Number.isFinite(deluluIdForState) && isConnected
      ? deluluIdForState
      : null;

  const { balance: tokenBalance, isLoading: isLoadingBalance } =
    useTokenBalance(marketToken);

  const { data: celoBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: DELULU_CHAIN_ID,
    query: { enabled: !!address },
  });
  const { isClaimed } = useUserPosition(deluluIdForHooks);

  const { claimableAmount, isLoading: isLoadingClaimableAmount, creatorClaimHint, isWalletMarketCreator, onChainResolutionReached, canAttemptClaimOnChain } =
    useUserClaimableAmount(deluluIdForHooks);

  const {
    claim,
    isPending: isClaiming,
    isConfirming: isClaimConfirming,
    isSuccess: isClaimSuccess,
    error: claimError,
  } = useClaimWinnings();

  const {
    data: stakes,
    isLoading: isLoadingStakes,
    refetch: refetchStakes,
  } = useGraphDeluluStakes(deluluId || null, delulu?.tokenAddress);

  const leaderboard = useMemo(() => {
    return buildDeluluLeaderboard(stakes as any);
  }, [stakes]);

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorTitle, setErrorTitle] = useState("Staking Failed");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastClaimedAmount, setLastClaimedAmount] = useState<number | null>(null);
  const pendingClaimAmountRef = useRef<number | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/delulu/${deluluId}`
      : `/delulu/${deluluId}`;
  const shareTitle = ipfsMetadata?.text ?? `Delulu #${delulu?.onChainId ?? ""}`;

  const searchParams = useSearchParams();
  const creatorPfps = usePfps(
    delulu ? [delulu.creator.toLowerCase()] : [],
  );
  const [showMilestoneForm, setShowMilestoneForm] = useState(
    () => searchParams.get("milestones") === "1",
  );
  const [showMilestonePreview, setShowMilestonePreview] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmountInput, setTipAmountInput] = useState("");
  const [tipError, setTipError] = useState<string | null>(null);
  const [milestoneMinError, setMilestoneMinError] = useState(false);
  const [newMilestones, setNewMilestones] = useState<
    { description: string; days: string }[]
  >([{ description: "", days: "" }]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState<{
    id: string;
    label?: string;
  } | null>(null);
  const [milestoneProofLinks, setMilestoneProofLinks] = useState<
    Record<string, string>
  >({});
  const [activeProofMilestoneId, setActiveProofMilestoneId] = useState<
    string | null
  >(null);
  const [proofSubmitSuccess, setProofSubmitSuccess] = useState(false);
  const [proofAiError, setProofAiError] = useState<string | null>(null);
  const [isVerifyingAi, setIsVerifyingAi] = useState(false);
  const proofSubmittedRef = useRef<string | null>(null);
  const [openMilestoneId, setOpenMilestoneId] = useState<string | null>(null);
  const [isWaitingForMilestones, setIsWaitingForMilestones] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const schedule = () => {
      void import("@/components/delulu-detail/delulu-detail-overlays");
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(schedule, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(schedule, 2000);
    return () => window.clearTimeout(timer);
  }, [deluluId]);

  useEffect(() => {
    if (searchParams.get("milestones") !== "1" || !delulu) return;
    const timer = setTimeout(() => {
      document
        .getElementById("milestones")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchParams, delulu]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    // When the PWA resumes from background, timers were suspended so `now`
    // can lag by minutes/hours. Snap it back to real time immediately.
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const {
    joinChallenge,
    isJoining,
    isConfirming: isConfirmingJoin,
    isSuccess: isJoinSuccess,
    errorMessage: joinErrorMessage,
  } = useJoinChallenge();

  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(
    null,
  );
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const { challenges } = useChallenges({
    enabled:
      !!delulu &&
      (!!delulu.challengeId ||
        joinModalOpen ||
        (!!address &&
          address.toLowerCase() === delulu.creator.toLowerCase())),
  });

  const currentCampaign = useMemo(() => {
    if (!delulu?.challengeId || !challenges?.length) return null;
    return (
      challenges.find((c: { id: number }) => c.id === delulu.challengeId) ??
      null
    );
  }, [delulu?.challengeId, challenges]);

  const deluluEarnedPoints = useMemo(
    () => sumDeluluEarnedPoints(milestones),
    [milestones],
  );

  const supportAmount = delulu?.totalSupportCollected || 0;

  // ── Supabase metadata override ──────────────────────────────────────────────
  const { data: deluluMeta } = useDeluluMetadata(delulu?.onChainId ?? null);

  const deluluTitle =
    deluluMeta?.title_override ||
    ipfsMetadata?.text ||
    ipfsMetadata?.content ||
    delulu?.content ||
    "";

  const deluluDescription =
    deluluMeta?.description_override ??
    (ipfsMetadata as any)?.description ??
    "";

  const supportersCount =
    delulu?.totalSupporters ?? (stakes ? stakes.length : 0);

  const milestoneView = useMemo(() => {
    if (!milestones || milestones.length === 0 || !delulu)
      return { sorted: [], endTimesMs: [], currentIndex: -1, passedCount: 0 };
    const sorted = [...milestones].sort(
      (a, b) => Number(a.milestoneId) - Number(b.milestoneId),
    );
    const deluluCreatedAtMs = getDeluluCreatedAtMs(
      { createdAt: delulu.createdAt, stakingDeadline: delulu.stakingDeadline },
      now,
    );
    const endTimesMs: number[] = [];
    let prevEnd: number | null = null;
    for (const m of sorted) {
      const endMs = getMilestoneEndTimeMs(m, prevEnd, deluluCreatedAtMs);
      endTimesMs.push(endMs);
      prevEnd = endMs;
    }
    const currentIndex = endTimesMs.findIndex((endMs) => endMs > now);
    const passedCount = currentIndex === -1 ? sorted.length : currentIndex;
    return { sorted, endTimesMs, currentIndex, passedCount };
  }, [milestones, delulu, now]);

  const gDollarUsdPrice = null;
  const totalSupportUsdStr = formatUsdEquivalent(
    supportAmount,
    delulu?.tokenAddress,
    gDollarUsdPrice,
  );
  const totalSupportUsd = totalSupportUsdStr
    ? parseFloat(totalSupportUsdStr)
    : null;
  const avgSupportUsd =
    totalSupportUsd && supportersCount > 0
      ? totalSupportUsd / supportersCount
      : null;
  const tokenSymbol = getTokenSymbol(marketToken);
  const walletBalanceNum = Number(tokenBalance?.formatted ?? "0");
  const walletBalanceLabel = Number.isFinite(walletBalanceNum)
    ? walletBalanceNum.toFixed(2)
    : "0.00";
  const celoBalanceNum = celoBalance ? Number(celoBalance.formatted) : null;
  const hasNoGas = celoBalanceNum !== null && celoBalanceNum < 0.001;

  const toUsd = (amount: number | null | undefined): string | null => {
    if (!amount || !Number.isFinite(amount) || amount <= 0) return null;
    return formatUsdEquivalent(amount, marketToken, gDollarUsdPrice);
  };

  const isCreator =
    authenticated &&
    address &&
    delulu?.creator &&
    address.toLowerCase() === delulu.creator.toLowerCase();

  const [showAiMilestonesModal, setShowAiMilestonesModal] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editSheetMode, setEditSheetMode] = useState<EditSheetMode>("update");
  const [showCreatorActions, setShowCreatorActions] = useState(false);
  const creatorActionsRef = useRef<HTMLDivElement>(null);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (deluluMeta?.is_hidden) setIsHidden(true);
  }, [deluluMeta?.is_hidden]);

  useEffect(() => {
    if (!showCreatorActions) return;
    const handler = (e: MouseEvent) => {
      if (creatorActionsRef.current && !creatorActionsRef.current.contains(e.target as Node)) {
        setShowCreatorActions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCreatorActions]);

  const {
    writeContract: writeAddMilestones,
    data: addMilestonesHash,
    isPending: isAddingMilestones,
    error: addMilestonesError,
  } = useUnifiedWriteContract();
  const {
    isLoading: isConfirmingAddMilestones,
    isSuccess: isAddMilestonesSuccess,
  } = useWaitForTransactionReceipt({ hash: addMilestonesHash });
  const {
    writeContract: writeSubmitMilestone,
    data: submitMilestoneHash,
    isPending: isSubmittingMilestone,
    error: submitMilestoneError,
  } = useUnifiedWriteContract();
  const {
    isLoading: isConfirmingSubmitMilestone,
    isSuccess: isSubmitMilestoneSuccess,
  } = useWaitForTransactionReceipt({ hash: submitMilestoneHash });
  const {
    writeContract: writeResetMilestones,
    data: resetMilestonesHash,
    isPending: isResettingMilestones,
    error: resetMilestonesError,
  } = useUnifiedWriteContract();
  const {
    isLoading: isConfirmingResetMilestones,
    isSuccess: isResetMilestonesSuccess,
  } = useWaitForTransactionReceipt({ hash: resetMilestonesHash });
  const {
    writeContract: writeDeleteMilestone,
    data: deleteMilestoneHash,
    isPending: isDeletingMilestone,
    error: deleteMilestoneError,
  } = useUnifiedWriteContract();
  const {
    isLoading: isConfirmingDeleteMilestone,
    isSuccess: isDeleteMilestoneSuccess,
  } = useWaitForTransactionReceipt({ hash: deleteMilestoneHash });
  const {
    writeContract: writeTipMilestone,
    data: tipMilestoneHash,
    isPending: isTippingMilestone,
    error: tipMilestoneError,
  } = useUnifiedWriteContract();
  const {
    isLoading: isConfirmingTipMilestone,
    isSuccess: isTipMilestoneSuccess,
  } = useWaitForTransactionReceipt({ hash: tipMilestoneHash });

  useEffect(() => {
    const err =
      submitMilestoneError ??
      addMilestonesError ??
      resetMilestonesError ??
      claimError ??
      null;
    if (err) {
      const { title, message } = getContractErrorDisplay(err);
      setErrorTitle(title);
      setErrorMessage(message);
      setShowErrorModal(true);
    }
  }, [
    submitMilestoneError,
    addMilestonesError,
    resetMilestonesError,
    claimError,
  ]);

  useEffect(() => {
    if (!tipMilestoneError) return;
    if (isInsufficientGasError(tipMilestoneError)) return; // global NoGasModal handles it
    const { message } = getContractErrorDisplay(tipMilestoneError);
    setTipError(message);
  }, [tipMilestoneError]);

  useEffect(() => {
    if (!isTipMilestoneSuccess) return;
    setShowTipModal(false);
    setTipAmountInput("");
    setTipError(null);
    refetchDelulu();
    refetchStakes();
    queryClient.invalidateQueries();

    // Notify creator of the tip
    if (address && delulu?.creator && deluluIdForState !== null) {
      fetch("/api/notifications/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipperAddress: address,
          creatorAddress: delulu.creator,
          deluluId: deluluIdForState,
          amount: tipAmountInput || null,
          tokenSymbol,
        }),
      }).catch(() => {});
    }
    (async () => {
      try {
        const confettiModule = await import("canvas-confetti");
        const confetti = (confettiModule as any).default || confettiModule;
        if (typeof confetti === "function") {
          confetti({
            particleCount: 80,
            spread: 65,
            origin: { y: 0.55 },
            colors: ["#f6c324", "#22C55E", "#3B82F6"],
          });
        }
      } catch {}
    })();
  }, [isTipMilestoneSuccess, refetchDelulu, refetchStakes, queryClient]);

  const handleSubmitTip = async () => {
    if (!delulu || !marketToken) return;
    const amountNum = Number(tipAmountInput);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setTipError("Enter a valid tip amount greater than 0.");
      return;
    }
    if (amountNum > walletBalanceNum) {
      setTipError(
        `Insufficient balance. You have ${walletBalanceLabel} ${tokenSymbol} available.`,
      );
      return;
    }
    let amountWei: bigint;
    try {
      amountWei = parseTokenAmount(tipAmountInput, marketToken);
    } catch {
      setTipError("Tip amount format is invalid.");
      return;
    }
    if (amountWei <= 0n) {
      setTipError("Enter a valid tip amount greater than 0.");
      return;
    }
    setTipError(null);
    writeTipMilestone({
      address: getDeluluContractAddress(DELULU_CHAIN_ID),
      abi: DELULU_ABI,
      functionName: "tipMilestone",
      // General support mode: milestoneId kept at 0 for analytics compatibility.
      args: [BigInt(delulu.onChainId ?? delulu.id), 0n, amountWei],
    });
  };

  const applyQuickTip = (amount: number) => {
    setTipAmountInput(String(amount));
  };

  const deluluRemainingDaysTotal = useMemo(() => {
    const sortedMilestones = milestones
      ? [...milestones].sort((a, b) => Number(a.milestoneId) - Number(b.milestoneId))
      : [];
    return getDeluluRemainingDaysTotal({
      resolutionDeadline: delulu?.resolutionDeadline,
      lastMilestoneDeadline: sortedMilestones.length > 0
        ? sortedMilestones[sortedMilestones.length - 1]?.deadline
        : null,
      nowMs: now,
    });
  }, [delulu?.resolutionDeadline, milestones, now]);





  const maxDaysPerRow = useMemo(() => {
    return getMaxDaysPerRow(newMilestones, deluluRemainingDaysTotal);
  }, [newMilestones, deluluRemainingDaysTotal]);

  const handleAddMilestoneRow = () => {
    setNewMilestones((prev) => {
      const next = [...prev, { description: "", days: "" }];
      if (next.length >= 3) setMilestoneMinError(false);
      return next;
    });
  };



  const handleRemoveMilestoneRow = (index: number) =>
    setNewMilestones((prev) => prev.filter((_, i) => i !== index));
  const handleNewMilestoneChange = (
    index: number,
    field: "description" | "days",
    value: string,
  ) => {
    if (field === "days") {
      setNewMilestones((prev) => {
        const daysUsedByPrevious = prev
          .slice(0, index)
          .reduce((sum, m) => sum + (Number(m.days) || 0), 0);
        const maxDays = Math.max(
          0,
          Math.floor(deluluRemainingDaysTotal - daysUsedByPrevious),
        );
        if (value === "" || value === null || value === undefined) {
          return prev.map((m, i) => (i === index ? { ...m, days: "" } : m));
        }
        const parsed = Number(value);
        if (Number.isNaN(parsed) || parsed < 0) return prev;
        const clamped = Math.min(maxDays, Math.max(0, Math.floor(parsed)));
        return prev.map((m, i) =>
          i === index
            ? { ...m, days: clamped === 0 ? "" : String(clamped) }
            : m,
        );
      });
      return;
    }
    setNewMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  };

  const handleContinueMilestones = () => {
    if (!isCreator || !delulu) return;
    const validMilestones = newMilestones.filter(
      (m) => m.description.trim().length > 0 && m.days.trim().length > 0,
    );

    if (validMilestones.length < 3) {
      setMilestoneMinError(true);
      return;
    }
    setMilestoneMinError(false);

    const incompleteMilestones = newMilestones.filter(
      (m) =>
        (m.description.trim().length > 0 && m.days.trim().length === 0) ||
        (m.description.trim().length === 0 && m.days.trim().length > 0),
    );

    if (incompleteMilestones.length > 0) {
      setErrorTitle("Incomplete");
      setErrorMessage("Fill description and days for each step.");
      setShowErrorModal(true);
      return;
    }

    const invalidDays = validMilestones.filter((m) => {
      const days = Number(m.days);
      return Number.isNaN(days) || days <= 0;
    });

    if (invalidDays.length > 0) {
      setErrorTitle("Invalid");
      setErrorMessage("Min 1 day per step.");
      setShowErrorModal(true);
      return;
    }

    const totalDurationSeconds = validMilestones.reduce((sum, m) => {
      const days = Number(m.days);
      return sum + days * 24 * 60 * 60;
    }, 0);

    let startTimeSeconds = Math.floor(Date.now() / 1000);
    if (milestones && milestones.length > 0) {
      const lastMilestone = milestones[milestones.length - 1];
      if (lastMilestone && lastMilestone.deadline) {
        startTimeSeconds = Math.floor(lastMilestone.deadline.getTime() / 1000);
      }
    }

    const resolutionSeconds = Math.floor(
      delulu.resolutionDeadline.getTime() / 1000,
    );

    if (startTimeSeconds + totalDurationSeconds > resolutionSeconds) {
      setErrorTitle("Too long");
      setErrorMessage("Total days exceed deadline.");
      setShowErrorModal(true);
      return;
    }

    // All valid — open preview
    setShowMilestonePreview(true);
  };

  const handleCreateMilestones = () => {
    if (!isCreator || !delulu) return;
    const validMilestones = newMilestones.filter(
      (m) => m.description.trim().length > 0 && m.days.trim().length > 0,
    );
    const mURIs = validMilestones.map((m) => m.description.trim());
    const mDurations = validMilestones.map((m) =>
      BigInt(Math.floor(Number(m.days) * 24 * 60 * 60)),
    );
    writeAddMilestones({
      address: getDeluluContractAddress(DELULU_CHAIN_ID),
      abi: DELULU_ABI,
      functionName: "addMilestones",
      args: [BigInt(delulu.id), mURIs, mDurations],
    });
  };

  const handleSubmitMilestoneProof = async (
    milestoneId: string,
    imageUrl: string,
  ) => {
    const link = imageUrl.trim();

    const activeMilestone = milestones?.find(
      (m) => m.milestoneId === milestoneId,
    );
    const milestoneDescription = activeMilestone?.milestoneURI ?? "";

    setProofAiError(null);
    setIsVerifyingAi(true);
    try {
      const res = await fetch("/api/ai/verify-milestone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: link,
          deluluGoal: deluluTitle,
          milestoneDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        setProofAiError(data.reason ?? "Your image doesn't clearly show this milestone was completed. Please upload a photo or screenshot that directly demonstrates your progress.");
        return;
      }
    } catch {
      setProofAiError("Could not reach the verification service. Please try again.");
      return;
    } finally {
      setIsVerifyingAi(false);
    }

    writeSubmitMilestone({
      address: getDeluluContractAddress(DELULU_CHAIN_ID),
      abi: DELULU_ABI,
      functionName: "submitMilestone",
      args: [BigInt(delulu!.id), BigInt(milestoneId), link, true],
    });
  };

  const openProofModal = (
    milestoneId: string,
    existingProof?: string | null,
  ) => {
    proofSubmittedRef.current = null;
    setProofSubmitSuccess(false);
    setProofAiError(null);
    setMilestoneProofLinks((prev) => ({
      ...prev,
      [milestoneId]: prev[milestoneId] ?? existingProof ?? "",
    }));
    setActiveProofMilestoneId(milestoneId);
  };

  const handleJoinCampaign = async () => {
    if (!isCreator || !deluluIdForState || !selectedChallengeId) return;
    try {
      await joinChallenge(Number(deluluIdForState), selectedChallengeId);
    } catch {
    }
  };

  const handleClaimRequest = () => {
    pendingClaimAmountRef.current =
      claimableAmount > 0 ? claimableAmount : pendingClaimAmountRef.current;
    const chainIdArg =
      deluluIdForState !== null && Number.isFinite(deluluIdForState)
        ? deluluIdForState
        : Number(safeDelulu.onChainId ?? safeDelulu.id);
    void claim(chainIdArg);
  };

  useEffect(() => {
    if (isClaimSuccess) {
      setLastClaimedAmount(pendingClaimAmountRef.current ?? claimableAmount);
      refetchAfterClaim(apolloClient, queryClient, deluluId);
      (async () => {
        try {
          const confettiModule = await import("canvas-confetti");
          const confetti = (confettiModule as any).default || confettiModule;
          if (typeof confetti === "function") {
            confetti({
              particleCount: 90,
              spread: 70,
              origin: { y: 0.5 },
              colors: ["#f6c324", "#22C55E", "#1F2937"],
            });
          }
        } catch {}
      })();
    }
  }, [isClaimSuccess, deluluId, apolloClient, queryClient]);

  const displayedClaimAmount =
    isClaimed || isClaimSuccess
      ? (lastClaimedAmount ?? (isCreator ? supportAmount : claimableAmount))
      : claimableAmount;

  useEffect(() => {
    if (isResetMilestonesSuccess) {
      refetchDeluluData(apolloClient, deluluId);
      setNewMilestones([{ description: "", days: "" }]);
      setShowMilestoneForm(true);
    }
  }, [isResetMilestonesSuccess, deluluId, apolloClient]);

  useEffect(() => {
    if (isDeleteMilestoneSuccess) {
      setIsWaitingForMilestones(true);
      setTimeout(() => refetchDelulu(), 3000);
      refetchDeluluData(apolloClient, deluluId);
      // Close modal after a short delay so the success message is visible
      setTimeout(() => {
        setShowDeleteModal(false);
        setMilestoneToDelete(null);
      }, 1500);
    }
  }, [isDeleteMilestoneSuccess, deluluId, apolloClient]);

  const handleDeleteMilestone = (milestoneId: string) => {
    if (!isCreator || !delulu) return;

    const milestone = milestones?.find((m) => m.milestoneId === milestoneId);
    if (!milestone) return;

    // Check if milestone can be deleted
    if (milestone.isSubmitted || milestone.isVerified) {
      setErrorTitle("Can't delete");
      setErrorMessage("Submitted or verified.");
      setShowErrorModal(true);
      return;
    }

    // Check if milestone deadline has passed (past milestone)
    const isPast = milestone.deadline.getTime() < Date.now();
    if (isPast || milestone.isMissed) {
      setErrorTitle("Can't delete");
      setErrorMessage("Deadline passed.");
      setShowErrorModal(true);
      return;
    }

    // Show confirmation modal
    const milestoneLabel =
      milestone.milestoneURI && milestone.milestoneURI.length > 0
        ? milestone.milestoneURI
        : `Step ${milestoneId}`;
    setMilestoneToDelete({
      id: milestoneId,
      label: milestoneLabel,
    });
    setShowDeleteModal(true);
  };

  const confirmDeleteMilestone = () => {
    if (!milestoneToDelete || !delulu) return;

    writeDeleteMilestone({
      address: getDeluluContractAddress(DELULU_CHAIN_ID),
      abi: DELULU_ABI,
      functionName: "deleteMilestone",
      args: [BigInt(delulu.id), BigInt(milestoneToDelete.id)],
    });
  };

  const handleDeleteModalClose = () => {
    if (!isDeletingMilestone && !isConfirmingDeleteMilestone) {
      setShowDeleteModal(false);
      setMilestoneToDelete(null);
    }
  };

  useEffect(() => {
    if (!selectedChallengeId && challenges.length > 0) {
      const now = new Date();
      const activeChallenges = challenges.filter(
        (c: { active: boolean; startTime: Date; endTime: Date }) =>
          c.active && c.startTime <= now && c.endTime > now,
      );
      const initial = activeChallenges[0] ?? challenges[0];
      if (initial) {
        setSelectedChallengeId(initial.id);
      }
    }
  }, [challenges, selectedChallengeId]);

  useEffect(() => {
    if (isJoinSuccess) {
      refetchDeluluData(apolloClient, deluluId);
      setJoinModalOpen(false);
      (async () => {
        try {
          const confettiModule = await import("canvas-confetti");
          const confetti = (confettiModule as any).default || confettiModule;
          if (typeof confetti === "function") {
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.4 },
              colors: ["#FCD34D", "#4B5563", "#A855F7"],
            });
          }
        } catch {}
      })();
    }
  }, [isJoinSuccess, apolloClient, deluluId]);

  useEffect(() => {
    if (milestones !== undefined) {
      setIsWaitingForMilestones(false);
    }
  }, [milestones]);

  useEffect(() => {
    if (isAddMilestonesSuccess) {
      setShowMilestoneForm(false);
      setTimeout(() => setShowMilestonePreview(false), 1200);
      setIsWaitingForMilestones(true);
      // Directly refetch the useGraphDelulu query (avoids document reference mismatch in refetchDeluluData)
      setTimeout(() => refetchDelulu(), 3000);
      refetchDeluluData(apolloClient, deluluId);
      refetchAllActiveQueries(apolloClient, 5000); 
      (async () => {
        try {
          const confettiModule = await import("canvas-confetti");
          const confetti = (confettiModule as any).default || confettiModule;
          if (typeof confetti === "function") {
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.4 },
              colors: ["#FCD34D", "#4B5563", "#A855F7"],
            });
          }
        } catch {
          // Confetti is optional and purely visual
        }
      })();
    }
  }, [isAddMilestonesSuccess, apolloClient, deluluId]);

  // Refetch queries when milestone proof is submitted
  useEffect(() => {
    if (isSubmitMilestoneSuccess) {
      refetchDeluluData(apolloClient, deluluId);
      refetchAllActiveQueries(apolloClient, 5000);
    }
  }, [isSubmitMilestoneSuccess, apolloClient, deluluId]);

  useEffect(() => {
    if (
      isSubmitMilestoneSuccess &&
      activeProofMilestoneId &&
      proofSubmittedRef.current === activeProofMilestoneId
    ) {
      setProofSubmitSuccess(true);
      proofSubmittedRef.current = null;
    }
  }, [isSubmitMilestoneSuccess, activeProofMilestoneId]);

  if (isLoadingDelulu && !delulu) {
    return <DeluluPageLoading />;
  }

  if (!isLoadingDelulu && !delulu) {
    if (deluluError) {
      return (
        <div className="p-20 text-center text-foreground">
          Unable to load this delulu right now. Please refresh in a moment.
        </div>
      );
    }
    return (
      <div className="p-20 text-center text-foreground">Delulu not found</div>
    );
  }

  const safeDelulu = delulu!;

  const bannerImage =
    normalizeDeluluImageSrc(safeDelulu.bgImageUrl) ?? "/templates/t0.png";
  const canAddMilestones =
    safeDelulu.resolutionDeadline && new Date() < safeDelulu.resolutionDeadline;
  const isDeluluEnded =
    safeDelulu.resolutionDeadline && new Date() >= safeDelulu.resolutionDeadline;
  const canAttemptClaim = canAttemptClaimOnChain;
  const claimUiEnded = onChainResolutionReached || !!isDeluluEnded;
  const shouldShowClaimSection =
    (isCreator || isWalletMarketCreator) &&
    (claimUiEnded ||
      claimableAmount > 0 ||
      canAttemptClaimOnChain ||
      isClaiming ||
      isClaimConfirming ||
      isClaimSuccess ||
      !!claimError);

  const showOverlays =
    showTipModal ||
    showDeleteModal ||
    showSuccessModal ||
    showErrorModal ||
    joinModalOpen ||
    showMilestonePreview ||
    showAiMilestonesModal ||
    !!activeProofMilestoneId ||
    showEditSheet;

  return (
    <>
      <main className="h-full min-h-0 overflow-y-auto scrollbar-hide bg-background pb-20 lg:pb-8">
        <DeluluDetailHeader
          onBack={() => router.back()}
          title={
            deluluTitle
              ? deluluTitle.length > 48
                ? `${deluluTitle.slice(0, 48)}…`
                : deluluTitle
              : "Delulu"
          }
          shareSlot={
            <DeluluShareMenu
              shareUrl={shareUrl}
              shareTitle={shareTitle}
              creatorHandle={safeDelulu.username}
              variant="mobile"
            />
          }
        />

        <div className="w-full px-3 py-5 pt-3 lg:px-8 lg:pt-6">
          <div className="grid grid-cols-1 items-start gap-6 lg:min-h-[calc(100dvh-7.5rem)] lg:grid-cols-[minmax(0,2.15fr)_minmax(280px,1fr)] lg:gap-6 lg:pb-4">
            <div className="min-w-0 space-y-4">
              <DeluluDetailPinCard
                delulu={safeDelulu}
                title={deluluTitle || safeDelulu.content || "Delulu"}
                description={deluluDescription}
                bannerImage={bannerImage}
                supportAmount={supportAmount}
                supportersCount={supportersCount}
                totalSupportUsd={totalSupportUsd}
                marketToken={marketToken}
                creatorPfpUrl={creatorPfps[safeDelulu.creator.toLowerCase()]}
                isCreator={!!isCreator}
                isHidden={isHidden}
                showCreatorActions={showCreatorActions}
                onToggleCreatorActions={() => setShowCreatorActions((v) => !v)}
                creatorActionsRef={creatorActionsRef}
                onEdit={() => {
                  setEditSheetMode("update");
                  setShowEditSheet(true);
                  setShowCreatorActions(false);
                }}
                onDelete={() => {
                  setEditSheetMode("hide");
                  setShowEditSheet(true);
                  setShowCreatorActions(false);
                }}
                shareSlot={
                  <DeluluShareMenu
                    shareUrl={shareUrl}
                    shareTitle={shareTitle}
                    creatorHandle={safeDelulu.username}
                    variant="mobile"
                  />
                }
                showTip
                tipDisabled={claimUiEnded || !!isCreator}
                onTip={async () => {
                  setTipAmountInput(String(getDefaultTipAmount(marketToken)));
                  setShowTipModal(true);
                }}
                onRequireAuth={() => redirectToSignIn()}
                userAddress={address}
                username={safeDelulu.username}
              />

              <DeluluDetailCommentsSection
                deluluId={safeDelulu.id}
                deluluCreator={safeDelulu.creator}
                userAddress={address}
                username={currentUserUsername ?? null}
                onRequireAuth={() => redirectToSignIn()}
              />

                {shouldShowClaimSection ? (
                  <DeluluClaimSection
                    isCreator={!!isCreator}
                    isLoadingClaimableAmount={isLoadingClaimableAmount}
                    displayedClaimAmount={displayedClaimAmount}
                    tokenSymbol={tokenSymbol}
                    usdLabel={toUsd(displayedClaimAmount)}
                    isClaimed={isClaimed}
                    isClaimSuccess={isClaimSuccess}
                    isClaiming={isClaiming}
                    isClaimConfirming={isClaimConfirming}
                    canAttemptClaim={canAttemptClaim}
                    onChainResolutionReached={onChainResolutionReached}
                    claimUiEnded={claimUiEnded}
                    creatorClaimHint={creatorClaimHint}
                    claimError={claimError}
                    onClaim={handleClaimRequest}
                  />
                ) : null}

                <DeluluLeaderboardSection leaderboard={leaderboard} />

                {safeDelulu.challengeId ? (
                  <DeluluCampaignSection
                    campaignTitle={
                      currentCampaign?.title ||
                      `Campaign #${Number(safeDelulu.challengeId)}`
                    }
                    deluluEarnedPoints={deluluEarnedPoints}
                  />
                ) : null}
            </div>

            <DeluluMilestonesSidebar
              showOnboardingBanner={searchParams.get("milestones") === "1"}
              delulu={safeDelulu}
              deluluTitle={deluluTitle}
              deluluId={String(safeDelulu.id)}
              milestoneView={milestoneView}
              milestones={milestones}
              isCreator={!!isCreator}
              canAddMilestones={!!canAddMilestones}
              showMilestoneForm={showMilestoneForm}
              milestoneMinError={milestoneMinError}
              deluluRemainingDaysTotal={deluluRemainingDaysTotal}
              newMilestones={newMilestones}
              maxDaysPerRow={maxDaysPerRow}
              now={now}
              openMilestoneId={openMilestoneId}
              onToggleMilestone={(id) =>
                setOpenMilestoneId((prev) => (prev === id ? null : id))
              }
              onNewMilestoneChange={handleNewMilestoneChange}
              onAddMilestoneRow={handleAddMilestoneRow}
              onRemoveMilestoneRow={handleRemoveMilestoneRow}
              onContinueMilestones={handleContinueMilestones}
              onOpenProof={openProofModal}
              onDeleteMilestone={handleDeleteMilestone}
              onOpenAiMilestones={() => setShowAiMilestonesModal(true)}
              isWaitingForMilestones={isWaitingForMilestones}
            />
          </div>

          <RelatedDelulusSection
            excludeId={safeDelulu.id}
            creatorAddress={safeDelulu.creator}
          />
        </div>
      </main>

      {showOverlays ? (
      <DeluluDetailOverlays
        isCreator={!!isCreator}
        deluluId={deluluId}
        deluluTitle={deluluTitle}
        deluluRemainingDaysTotal={deluluRemainingDaysTotal}
        showAiMilestonesModal={showAiMilestonesModal}
        onAiMilestonesOpenChange={setShowAiMilestonesModal}
        onAiMilestonesDone={() => {
          setShowAiMilestonesModal(false);
          setIsWaitingForMilestones(true);
          setTimeout(() => refetchDelulu(), 3000);
          refetchDeluluData(apolloClient, deluluId);
        }}
        tipModal={{
          open: showTipModal,
          onOpenChange: (open) => {
            setShowTipModal(open);
            if (open) {
              setTipAmountInput(String(getDefaultTipAmount(marketToken)));
            }
            if (!open) setTipError(null);
          },
          tokenSymbol,
          tipAmountInput,
          onTipAmountChange: (value) => {
            setTipAmountInput(value);
            if (tipError) setTipError(null);
          },
          walletBalanceNum,
          walletBalanceLabel,
          isLoadingBalance,
          toUsd,
          marketToken,
          hasNoGas,
          tipError,
          isTipping: isTippingMilestone,
          isConfirming: isConfirmingTipMilestone,
          onMax: () => {
            setTipAmountInput(String(Math.max(0, walletBalanceNum)));
            if (tipError) setTipError(null);
          },
          onQuickTip: applyQuickTip,
          onSubmit: handleSubmitTip,
        }}
        proofModal={{
          activeMilestoneId: activeProofMilestoneId,
          onOpenChange: (open) => {
            if (!open) {
              setActiveProofMilestoneId(null);
              setProofSubmitSuccess(false);
              setProofAiError(null);
            }
          },
          onSubmit: (imageUrl) => {
            if (activeProofMilestoneId) {
              proofSubmittedRef.current = activeProofMilestoneId;
              handleSubmitMilestoneProof(activeProofMilestoneId, imageUrl);
            }
          },
          isSubmitting:
            isSubmittingMilestone ||
            isConfirmingSubmitMilestone ||
            isVerifyingAi,
          submitSuccess: proofSubmitSuccess,
          submitError: proofAiError
            ? new Error(proofAiError)
            : submitMilestoneError ?? null,
          onDone: () => {
            setActiveProofMilestoneId(null);
            setProofSubmitSuccess(false);
            setProofAiError(null);
          },
        }}
        feedbackModals={{
          showSuccess: showSuccessModal,
          onCloseSuccess: () => setShowSuccessModal(false),
          showError: showErrorModal,
          errorTitle,
          errorMessage,
          onCloseError: () => setShowErrorModal(false),
        }}
        joinCampaignModal={{
          open: joinModalOpen && !safeDelulu.challengeId,
          challenges,
          selectedChallengeId,
          onSelectChallenge: setSelectedChallengeId,
          joinErrorMessage,
          isJoining,
          isConfirming: isConfirmingJoin,
          onCancel: () => {
            if (!isJoining && !isConfirmingJoin) setJoinModalOpen(false);
          },
          onJoin: handleJoinCampaign,
        }}
        deleteMilestoneModal={{
          open: showDeleteModal,
          onOpenChange: handleDeleteModalClose,
          milestoneLabel: milestoneToDelete?.label,
          deleteError: deleteMilestoneError ?? null,
          isSuccess: isDeleteMilestoneSuccess,
          isDeleting: isDeletingMilestone,
          isConfirming: isConfirmingDeleteMilestone,
          onConfirm: confirmDeleteMilestone,
        }}
        milestonePreviewModal={{
          open: showMilestonePreview,
          onOpenChange: (open) => {
            if (!open && !isAddingMilestones && !isConfirmingAddMilestones) {
              setShowMilestonePreview(false);
            }
          },
          newMilestones,
          existingMilestones: milestones,
          isAdding: isAddingMilestones,
          isConfirming: isConfirmingAddMilestones,
          isSuccess: isAddMilestonesSuccess,
          onBack: () => setShowMilestonePreview(false),
          onConfirm: handleCreateMilestones,
        }}
        editSheet={
          isCreator && delulu?.onChainId && address
            ? {
                open: showEditSheet,
                onOpenChange: setShowEditSheet,
                mode: editSheetMode,
                onChainId: String(delulu.onChainId),
                creatorAddress: address,
                currentTitle: deluluTitle,
                currentDescription: deluluDescription,
                onDeleted: () => {
                  setIsHidden(true);
                  setShowEditSheet(false);
                },
              }
            : null
        }
      />
      ) : null}
    </>
  );
}
