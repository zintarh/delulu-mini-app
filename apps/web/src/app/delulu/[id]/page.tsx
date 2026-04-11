"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { SharesSheet } from "@/components/shares-sheet";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useApolloClient } from "@apollo/client/react";
import {
  refetchDeluluData,
  refetchAfterClaim,
  refetchAllActiveQueries,
} from "@/lib/graph/refetch-utils";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { TokenBadge } from "@/components/token-badge";
import { useUserPosition } from "@/hooks/use-user-position";
import { useClaimWinnings } from "@/hooks/use-claim-winnings";
import { useUserClaimableAmount } from "@/hooks/use-user-claimable-amount";
import { useGraphDelulu, useGraphDeluluStakes } from "@/hooks/graph";
import { useChallenges } from "@/hooks/use-challenges";
import { useJoinChallenge } from "@/hooks/use-join-challenge";
const FeedbackModal = dynamic(
  () => import("@/components/feedback-modal").then((m) => m.FeedbackModal),
  { ssr: false },
);
const ProofModal = dynamic(
  () => import("@/components/proof-modal").then((m) => m.ProofModal),
  { ssr: false },
);
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { BottomNav } from "@/components/bottom-nav";
const ConnectorSelectionSheet = dynamic(
  () =>
    import("@/components/connector-selection-sheet").then(
      (m) => m.ConnectorSelectionSheet,
    ),
  { ssr: false },
);
import { ChallengesHeader } from "@/components/challenges-header";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import {
  Loader2,
  ArrowLeft,
  ThumbsUp,
  Trophy,
  CheckCircle2,
  XCircle,
  Target,
  Users,
  XIcon,
  Circle,
  Search,
  ChevronDown,
  ChevronUp,
  Share2,
} from "lucide-react";
import { cn, formatAddress, formatGAmount } from "@/lib/utils";
import { getDeluluContractAddress, GOODDOLLAR_ADDRESSES, KNOWN_TOKEN_SYMBOLS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import {
  resolveIPFSContent,
  type DeluluIPFSMetadata,
} from "@/lib/graph/ipfs-cache";
import {
  MS_PER_DAY,
  getMilestoneEndTimeMs,
  getMilestoneLabel,
  getDeluluCreatedAtMs,
  formatMilestoneCountdown,
  shouldShowBuyButton,
} from "@/lib/milestone-utils";
import { getContractErrorDisplay } from "@/lib/contract-error";
import { SharesMarketCard } from "@/components/shares-market-card";
import {
  buildDeluluLeaderboard,
  getDeluluRemainingDaysTotal,
  getMaxDaysPerRow,
  getNewMilestoneTiming,
} from "./delulu-page-helpers";

function ShareMenu({
  shareUrl,
  shareTitle,
  creatorHandle,
  variant = "desktop",
}: {
  shareUrl: string;
  shareTitle: string;
  creatorHandle?: string | null;
  variant?: "mobile" | "desktop";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const onX = () => {
    const truncatedTitle =
      shareTitle.length > 100 ? shareTitle.slice(0, 100) + "…" : shareTitle;
    const byLine = creatorHandle ? `@${creatorHandle}` : "someone";
    const body = [
      `${byLine} just staked real money on this 🎯`,
      ``,
      `"${truncatedTitle}"`,
      ``,
      `delusional or actually gonna happen? buy a share and back them 👀`,
    ].join("\n");
    const text = encodeURIComponent(body);
    const url = encodeURIComponent(shareUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer",
    );
    setOpen(false);
  };

  const onLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setOpen(false);
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const menu = open && (
    <div className="absolute right-0 top-11 z-50 w-44 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
      <button
        onClick={onX}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
      >
        <XIcon className="w-4 h-4" />
        Post on X
      </button>
      <button
        onClick={onLinkedIn}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium hover:bg-muted transition-colors border-t border-border"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        LinkedIn
      </button>
      <button
        onClick={onCopy}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium hover:bg-muted transition-colors border-t border-border"
      >
        <Share2 className="w-4 h-4" />
        Copy link
      </button>
    </div>
  );

  if (variant === "mobile") {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Share"
        >
          {copied ? (
            <span className="text-[11px] font-bold text-[#fcff52]">✓</span>
          ) : (
            <Share2 className="w-5 h-5" />
          )}
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Share2 className="w-4 h-4" />
        {copied ? "Copied!" : "Share"}
      </button>
      {menu}
    </div>
  );
}

export default function DeluluPage() {
  const router = useRouter();
  const params = useParams();
  const deluluId = params.id as string;

  const { authenticated } = usePrivy();
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const contractAddress = getDeluluContractAddress(chainId);
  const apolloClient = useApolloClient();
  const queryClient = useQueryClient();

  const {
    delulu,
    milestones,
    shareTrades,
    shareHoldings,
    isLoading: isLoadingDelulu,
    refetch: refetchDelulu,
  } = useGraphDelulu(deluluId);

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

  const deluluIdForState =
    delulu?.onChainId && !Number.isNaN(Number(delulu.onChainId))
      ? Number(delulu.onChainId)
      : (delulu?.id ?? null);

  // Support/staking has been removed in favor of shares.
  const marketToken = delulu?.tokenAddress;
  const deluluIdForHooks = delulu?.id && isConnected ? delulu.id : null;

  const { data: myShareBalance } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "shareBalance",
    args:
      isConnected && address && delulu?.onChainId
        ? [BigInt(delulu.onChainId), address]
        : undefined,
    query: { enabled: isConnected && !!address && !!delulu?.onChainId },
  });
  const ownsAnyShares = ((myShareBalance as bigint | undefined) ?? 0n) > 0n;

  const { balance: tokenBalance, isLoading: isLoadingBalance } =
    useTokenBalance(marketToken);
  const { hasStaked, isClaimed } = useUserPosition(deluluIdForHooks);

  const { claimableAmount, isLoading: isLoadingClaimableAmount } =
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
  } = useGraphDeluluStakes(deluluId || null);

  const leaderboard = useMemo(() => {
    return buildDeluluLeaderboard(stakes as any);
  }, [stakes]);

  const [stakeAmount, setStakeAmount] = useState("1");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorTitle, setErrorTitle] = useState("Staking Failed");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showClaimSuccessModal, setShowClaimSuccessModal] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/delulu/${deluluId}`
      : `/delulu/${deluluId}`;
  const shareTitle = ipfsMetadata?.text ?? `Delulu #${delulu?.onChainId ?? ""}`;

  const searchParams = useSearchParams();
  const [buySharesSheetOpen, setBuySharesSheetOpen] = useState(
    () => searchParams.get("action") === "buy",
  );
  const [sellSharesSheetOpen, setSellSharesSheetOpen] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "milestones">(
    "details",
  );

  const handleProfileClick = () => {
    if (!isConnected) setShowLoginSheet(true);
    else router.push("/profile");
  };
  const handleCreateClick = () => {
    if (!isConnected) setShowLoginSheet(true);
    else router.push("/board");
  };

  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showMilestonePreview, setShowMilestonePreview] = useState(false);
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
  const proofSubmittedRef = useRef<string | null>(null);
  const [openMilestoneId, setOpenMilestoneId] = useState<string | null>(null);
  const [isWaitingForMilestones, setIsWaitingForMilestones] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const { challenges } = useChallenges();

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

  const currentCampaign = useMemo(() => {
    if (!delulu?.challengeId || !challenges?.length) return null;
    return (
      challenges.find((c: { id: number }) => c.id === delulu.challengeId) ??
      null
    );
  }, [delulu?.challengeId, challenges]);

  const supportAmount = delulu?.totalSupportCollected || 0;

  const deluluTitle =
    ipfsMetadata?.text || ipfsMetadata?.content || delulu?.content || "";

  const deluluDescription = (ipfsMetadata as any)?.description ?? "";

  const supportersCount =
    delulu?.totalSupporters ?? (stakes ? stakes.length : 0);
  const holdersCount = shareHoldings?.length ?? 0;

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

  const showBuyButton = useMemo(
    () =>
      !delulu
        ? true
        : shouldShowBuyButton(milestones, now, {
            createdAt: delulu.createdAt,
            stakingDeadline: delulu.stakingDeadline,
          }),
    [milestones, now, delulu],
  );

  const { usd: gDollarUsdPrice } = useGoodDollarPrice();
  const isGoodDollarMarket =
    delulu?.tokenAddress &&
    delulu.tokenAddress.toLowerCase() ===
      GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();
  const totalSupportUsd =
    isGoodDollarMarket && gDollarUsdPrice && supportAmount > 0
      ? supportAmount * gDollarUsdPrice
      : delulu?.tokenAddress &&
          delulu.tokenAddress.toLowerCase() !==
            GOODDOLLAR_ADDRESSES.mainnet.toLowerCase()
        ? supportAmount
        : null;
  const avgSupportUsd =
    totalSupportUsd && supportersCount > 0
      ? totalSupportUsd / supportersCount
      : null;

  const isCreator =
    authenticated &&
    address &&
    delulu?.creator &&
    address.toLowerCase() === delulu.creator.toLowerCase();

  const {
    writeContract: writeAddMilestones,
    data: addMilestonesHash,
    isPending: isAddingMilestones,
    error: addMilestonesError,
  } = useWriteContract();
  const {
    isLoading: isConfirmingAddMilestones,
    isSuccess: isAddMilestonesSuccess,
  } = useWaitForTransactionReceipt({ hash: addMilestonesHash });
  const {
    writeContract: writeSubmitMilestone,
    data: submitMilestoneHash,
    isPending: isSubmittingMilestone,
    error: submitMilestoneError,
  } = useWriteContract();
  const {
    isLoading: isConfirmingSubmitMilestone,
    isSuccess: isSubmitMilestoneSuccess,
  } = useWaitForTransactionReceipt({ hash: submitMilestoneHash });
  const {
    writeContract: writeResetMilestones,
    data: resetMilestonesHash,
    isPending: isResettingMilestones,
    error: resetMilestonesError,
  } = useWriteContract();
  const {
    isLoading: isConfirmingResetMilestones,
    isSuccess: isResetMilestonesSuccess,
  } = useWaitForTransactionReceipt({ hash: resetMilestonesHash });
  const {
    writeContract: writeDeleteMilestone,
    data: deleteMilestoneHash,
    isPending: isDeletingMilestone,
    error: deleteMilestoneError,
  } = useWriteContract();
  const {
    isLoading: isConfirmingDeleteMilestone,
    isSuccess: isDeleteMilestoneSuccess,
  } = useWaitForTransactionReceipt({ hash: deleteMilestoneHash });

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

  const deluluRemainingDaysTotal = useMemo(() => {
    // Use the sorted milestone view's last deadline (accounts for deletions in the middle)
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

  const handleAddMilestoneRow = () =>
    setNewMilestones((prev) => [...prev, { description: "", days: "" }]);
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

    if (validMilestones.length === 0) {
      setErrorTitle("Missing");
      setErrorMessage("Add at least one step with description and days.");
      setShowErrorModal(true);
      return;
    }

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
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "addMilestones",
      args: [BigInt(delulu.id), mURIs, mDurations],
    });
  };

  const handleSubmitMilestoneProof = (
    milestoneId: string,
    linkOverride?: string,
  ) => {
    const link = (
      linkOverride ??
      milestoneProofLinks[milestoneId] ??
      ""
    ).trim();
    writeSubmitMilestone({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "submitMilestone",
      args: [BigInt(delulu!.id), BigInt(milestoneId), link],
    });
  };

  const openProofModal = (
    milestoneId: string,
    existingProof?: string | null,
  ) => {
    proofSubmittedRef.current = null;
    setProofSubmitSuccess(false);
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


  useEffect(() => {
    if (isClaimSuccess) {
      setShowClaimSuccessModal(true);
      refetchAfterClaim(apolloClient, queryClient, deluluId);
    }
  }, [isClaimSuccess, deluluId, apolloClient, queryClient]);

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
      address: getDeluluContractAddress(chainId),
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
    return (
      <div className="h-screen overflow-hidden bg-background">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
          <div className="hidden lg:block">
            <LeftSidebar
              onProfileClick={handleProfileClick}
              onCreateClick={handleCreateClick}
            />
          </div>

          <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide pb-20">
            <div className="lg:hidden">
              <ChallengesHeader
                onProfileClick={() =>
                  !isConnected
                    ? setShowLoginSheet(true)
                    : router.push("/profile")
                }
                onCreateClick={() =>
                  !isConnected ? setShowLoginSheet(true) : router.push("/board")
                }
              />
            </div>

            <div className="px-4 lg:px-6 py-6 space-y-6">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="h-48 bg-muted animate-pulse" />
                <div className="p-6 space-y-3">
                  <div className="h-6 w-2/3 bg-muted rounded-md animate-pulse" />
                  <div className="h-4 w-1/3 bg-muted rounded-md animate-pulse" />
                  <div className="h-16 w-full bg-muted rounded-md animate-pulse" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="h-10 w-40 bg-muted rounded-full animate-pulse" />
                <div className="h-24 bg-muted rounded-2xl animate-pulse" />
                <div className="h-40 bg-muted rounded-2xl animate-pulse" />
              </div>
            </div>
          </main>

          <div className="hidden lg:block">
            <RightSidebar />
          </div>
        </div>

        <BottomNav
          onProfileClick={handleProfileClick}
          onCreateClick={handleCreateClick}
        />
      </div>
    );
  }

  if (!isLoadingDelulu && !delulu) {
    return (
      <div className="p-20 text-center text-foreground">Delulu not found</div>
    );
  }

  const safeDelulu = delulu!;

  const canStake =
    !safeDelulu.isResolved &&
    new Date() < safeDelulu.stakingDeadline &&
    !hasStaked;
  const bannerImage = safeDelulu.bgImageUrl || "/templates/t0.png";
  const canAddMilestones =
    safeDelulu.resolutionDeadline && new Date() < safeDelulu.resolutionDeadline;
  const isDeluluEnded =
    safeDelulu.resolutionDeadline && new Date() >= safeDelulu.resolutionDeadline;
  const canAttemptClaim =
    !!isCreator &&
    !!safeDelulu.isResolved &&
    !safeDelulu.isCancelled &&
    claimableAmount > 0;
  const shouldShowClaimSection =
    !!isCreator &&
    (
      isDeluluEnded ||
      safeDelulu.isResolved ||
      claimableAmount > 0 ||
      isClaiming ||
      isClaimConfirming ||
      isClaimSuccess ||
      !!claimError
    );

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={handleProfileClick}
            onCreateClick={handleCreateClick}
          />
        </div>

        <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide pb-20">
          <div className="lg:hidden">
            <header className="fixed top-0 left-0 right-0 z-50 w-full bg-secondary/95 backdrop-blur-sm border-b border-border">
              <nav className="max-w-lg md:max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-3 flex items-center justify-between">
                <button
                  onClick={() => router.back()}
                  className="flex items-center justify-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <a
                  href="https://staydelulu.xyz"
                  className="flex items-center justify-center shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  aria-label="Delulu home"
                >
                  <Image
                    src="/favicon_io/favicon-32x32.png"
                    alt="Delulu"
                    width={28}
                    height={28}
                    className="h-7 w-7"
                  />
                </a>

                <div className="flex items-center gap-1">
                  <ShareMenu shareUrl={shareUrl} shareTitle={shareTitle} creatorHandle={safeDelulu.username} variant="mobile" />
                  <button
                    onClick={() => {
                      if (!isConnected) setShowLoginSheet(true);
                      else router.push("/search");
                    }}
                    className="flex items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Search"
                    aria-label="Search"
                  >
                    <Search className="w-6 h-6" />
                  </button>
                </div>
              </nav>
            </header>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:flex items-center gap-4 px-6 py-4 border-b border-border sticky top-0 z-30 bg-secondary/95 backdrop-blur-sm">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <ShareMenu shareUrl={shareUrl} shareTitle={shareTitle} creatorHandle={safeDelulu.username} />
          </div>

          <div className="px-4 lg:px-6 py-6 space-y-6 pt-20 lg:pt-6">
            {/* Market banner / hero */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div
                className="relative h-48 bg-cover bg-center"
                style={{ backgroundImage: `url(${bannerImage})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              </div>
              <div className="p-6 space-y-3">
                <h1 className="text-2xl font-black mb-1 text-foreground">
                  {deluluTitle || safeDelulu.content}
                </h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    @{safeDelulu.username || formatAddress(safeDelulu.creator)}
                  </span>
                  {marketToken && (
                    <TokenBadge tokenAddress={marketToken} size="sm" />
                  )}
                </div>

                {/* Key stats row */}
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-muted-foreground" />
                    <span className="font-bold text-sm text-foreground">
                      {formatGAmount(supportAmount)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      staked
                      {totalSupportUsd && totalSupportUsd > 0 && (
                        <> · ${totalSupportUsd.toFixed(2)}</>
                      )}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-border/60" />
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-xs">
                      {holdersCount} {holdersCount === 1 ? "holder" : "holders"}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-border/60" />
                  <div className="text-muted-foreground text-xs">
                    Ends{" "}
                    <span className="font-semibold text-foreground">
                      {safeDelulu.resolutionDeadline.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {deluluDescription && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {deluluDescription}
                  </p>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border gap-4 text-sm">
              <button
                onClick={() => setActiveTab("details")}
                className={cn(
                  "pb-2 font-semibold border-b-2 transition-all",
                  activeTab === "details"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Details
              </button>

              <button
                onClick={() => setActiveTab("milestones")}
                className={cn(
                  "pb-2 font-semibold border-b-2 transition-all",
                  activeTab === "milestones"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Milestones
              </button>
            </div>

            {activeTab === "details" ? (
              <div className="space-y-6">
                <SharesMarketCard
                  shareTrades={shareTrades}
                  shareHoldings={shareHoldings}
                  myShareBalance={myShareBalance as bigint | undefined}
                  marketToken={marketToken}
                  onBuy={() => setBuySharesSheetOpen(true)}
                  onSell={() => setSellSharesSheetOpen(true)}
                  ownsAnyShares={ownsAnyShares}
                  canBuy={!!(
                    !safeDelulu.isResolved &&
                    showBuyButton &&
                    milestones &&
                    milestones.length > 0
                  )}
                />

                {/* Claim card */}
                {shouldShowClaimSection && (
                  <div className="rounded-2xl border-2 border-border bg-card overflow-hidden">
                    {/* Header strip */}
                    <div className="bg-delulu-yellow-reserved/10 dark:bg-delulu-yellow-reserved/5 px-5 py-3 flex items-center justify-between border-b border-border">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-delulu-charcoal dark:text-delulu-yellow-reserved" />
                        <span className="text-xs font-black uppercase tracking-widest text-delulu-charcoal dark:text-delulu-yellow-reserved">
                          {isCreator ? "Earnings" : "Claimable"}
                        </span>
                      </div>
                      {(isClaimed || isClaimSuccess) && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Claimed
                        </span>
                      )}
                    </div>

                    <div className="px-5 py-5 space-y-5">
                      {/* Amount display */}
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-[11px] text-muted-foreground font-medium mb-1">
                            {isCreator ? "Your reward" : "Your share"}
                          </p>
                          {isLoadingClaimableAmount ? (
                            <div className="h-9 w-28 bg-muted animate-pulse rounded-md" />
                          ) : (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-3xl font-black tabular-nums text-foreground leading-none">
                                {formatGAmount(claimableAmount)}
                              </span>
                              <span className="text-sm font-semibold text-muted-foreground">
                                {marketToken
                                  ? (KNOWN_TOKEN_SYMBOLS[marketToken.toLowerCase()] ?? "tokens")
                                  : "tokens"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Status pill */}
                        {!isClaimed && !isClaimSuccess && (
                          <div className={cn(
                            "shrink-0 px-3 py-1 rounded-full text-[11px] font-black border",
                            claimableAmount > 0
                              ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted border-border text-muted-foreground"
                          )}>
                            {claimableAmount > 0 ? "Available" : "Not available"}
                          </div>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-border" />

                      {/* Error */}
                      {claimError && (
                        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                          <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                          <p className="text-xs text-destructive font-medium leading-snug">
                            {(claimError as any)?.shortMessage ?? (claimError as any)?.message ?? "Claim failed"}
                          </p>
                        </div>
                      )}

                      {/* CTA */}
                      {isClaimed || isClaimSuccess ? (
                        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                              Tokens claimed
                            </p>
                            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                              Sent to your wallet
                            </p>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            claim(Number(safeDelulu.onChainId ?? safeDelulu.id))
                          }
                          disabled={isClaiming || isClaimConfirming || !canAttemptClaim}
                          className={cn(
                            "w-full py-3.5 rounded-2xl border-2 text-sm font-black",
                            "flex items-center justify-center gap-2",
                            "transition-all active:translate-y-px",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "border-delulu-charcoal bg-delulu-yellow-reserved text-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A] hover:opacity-90",
                          )}
                        >
                          {(isClaiming || isClaimConfirming) && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          {isClaiming
                            ? "Confirm in wallet..."
                            : isClaimConfirming
                              ? "Processing..."
                              : canAttemptClaim
                                ? "Claim tokens"
                                : !safeDelulu.isResolved
                                  ? "Pending resolution"
                                  : "No claimable amount"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {leaderboard.length > 0 && (
                  <div>
                    <h2 className="text-base font-black mb-4 text-foreground">
                      Top Supporters
                    </h2>
                    <div className="space-y-3">
                      {leaderboard.map((entry) => (
                        <div
                          key={entry.address}
                          className="p-4 bg-card border border-border rounded-xl flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-delulu-yellow-reserved rounded-full flex items-center justify-center font-black text-delulu-charcoal">
                              {entry.rank}
                            </div>
                            <div>
                              <p className="font-bold text-foreground">
                                @
                                {entry.username || formatAddress(entry.address)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {entry.totalStake.toFixed(2)} staked
                              </p>
                            </div>
                          </div>
                          <Trophy
                            className={cn(
                              "w-5 h-5",
                              entry.rank === 1
                                ? "text-yellow-400"
                                : "text-muted-foreground/40",
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Campaign section: only show when this delulu has joined a campaign */}
                {safeDelulu.challengeId && (
                  <div className="p-6 bg-card rounded-2xl border border-border space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 border border-purple-400/60">
                          <Trophy className="w-4 h-4 text-purple-300" />
                        </span>
                        <h3 className="text-sm md:text-base font-black text-foreground">
                          Campaign
                        </h3>
                      </div>
                      <span className="text-xs md:text-sm font-semibold text-purple-200 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-400/60">
                        {currentCampaign?.title ||
                          `Campaign #${Number(safeDelulu.challengeId)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>
                        This delulu is participating in{" "}
                        {currentCampaign?.title ||
                          `Campaign #${Number(safeDelulu.challengeId)}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-card p-5 md:p-6 lg:p-8">
                  <div className="flex flex-col gap-4 mb-5 md:mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base md:text-lg font-black text-foreground flex items-center gap-2">
                          <Target className="w-4 h-4 md:w-5 md:h-5" />
                          Milestones
                        </h2>
                        <span className="text-sm md:text-base font-bold tabular-nums text-foreground">
                          {milestoneView.sorted.length
                            ? `${milestoneView.passedCount}/${milestoneView.sorted.length}`
                            : "0/0"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCreator && canAddMilestones && deluluRemainingDaysTotal > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setShowMilestoneForm((open) => !open)
                            }
                            className="w-fit inline-flex items-center justify-center px-3 py-2 text-xs md:text-sm font-semibold rounded-sm border border-border text-foreground hover:bg-muted transition-colors"
                          >
                            {showMilestoneForm ? "Close" : "Add"}
                          </button>
                        )}
                      </div>
                    </div>

                    {milestoneView.sorted.length > 0 && (
                      <div
                        className="w-full h-2.5 rounded-full bg-muted overflow-hidden"
                        role="progressbar"
                        aria-valuenow={milestoneView.passedCount}
                        aria-valuemin={0}
                        aria-valuemax={milestoneView.sorted.length}
                      >
                        <div
                          className="h-full rounded-full bg-delulu-yellow-reserved transition-all duration-300 min-w-0"
                          style={{
                            width: `${(milestoneView.passedCount / milestoneView.sorted.length) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {isCreator && canAddMilestones && showMilestoneForm && (
                    <div className="mb-4 border border-dashed border-border rounded-2xl p-3 md:p-4 bg-muted/60">
                      {delulu?.resolutionDeadline && (
                        <p className="text-xs text-muted-foreground mb-3">
                          <strong className="text-foreground">
                            {deluluRemainingDaysTotal}
                          </strong>{" "}
                          days left · sequential
                        </p>
                      )}
                      <div className="space-y-3 md:space-y-4">
                        {newMilestones.map((m, index) => {
                          const { exceedsDeadline } = getNewMilestoneTiming({
                            existingMilestonesLastDeadline:
                              milestones && milestones.length > 0
                                ? milestones[milestones.length - 1]?.deadline
                                : null,
                            newMilestones,
                            index,
                            resolutionDeadline: delulu?.resolutionDeadline,
                            nowMs: now,
                          });

                          return (
                            <div
                              key={index}
                              className="rounded-xl border border-border bg-card p-3 md:p-4 space-y-2"
                            >
                              {newMilestones.length > 1 && (
                                <div className="flex items-center justify-end mb-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveMilestoneRow(index)
                                    }
                                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                                  >
                                    <XIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    placeholder="What to do"
                                    value={m.description}
                                    onChange={(e) =>
                                      handleNewMilestoneChange(
                                        index,
                                        "description",
                                        e.target.value,
                                      )
                                    }
                                    className="flex-1 min-w-0 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    max={maxDaysPerRow[index] || undefined}
                                    placeholder="1-2 days"
                                    value={m.days}
                                    onChange={(e) =>
                                      handleNewMilestoneChange(
                                        index,
                                        "days",
                                        e.target.value,
                                      )
                                    }
                                    className="w-24 shrink-0 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  />
                                </div>
                                {maxDaysPerRow[index] != null && maxDaysPerRow[index] > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    max {maxDaysPerRow[index]} days
                                  </span>
                                )}
                                {exceedsDeadline && (
                                  <div className="text-[10px] font-semibold text-destructive">
                                    Over deadline
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
                        <button
                          type="button"
                          onClick={handleAddMilestoneRow}
                          className="inline-flex items-center justify-center px-3 py-2 text-xs md:text-sm font-semibold rounded-md border border-border text-foreground hover:bg-muted transition-colors"
                        >
                          + Add
                        </button>
                        <button
                          type="button"
                          onClick={handleContinueMilestones}
                          disabled={
                            (milestones && milestones.length >= 10) ||
                            newMilestones.some((m) => !m.days || Number(m.days) <= 0)
                          }
                          className={cn(
                            "inline-flex items-center justify-center px-4 py-2 text-xs md:text-sm font-black rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A]",
                            "bg-delulu-yellow-reserved text-delulu-charcoal hover:scale-[0.98] transition-transform",
                            ((milestones && milestones.length >= 10) ||
                              newMilestones.some((m) => !m.days || Number(m.days) <= 0)) &&
                              "opacity-60 cursor-not-allowed",
                          )}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Milestones list */}
                  {milestones && milestones.length > 0 ? (
                    <>
                      <div className="space-y-3 md:space-y-4 pt-1">
                        {milestoneView.sorted.map((m, i) => {
                          const endTimeMs =
                            milestoneView.endTimesMs[i] ?? m.deadline.getTime();
                          const fullTitle = getMilestoneLabel(m, 999);
                          const shortTitle = getMilestoneLabel(m, 80);

                          const isPast =
                            milestoneView.currentIndex === -1 ||
                            i < milestoneView.currentIndex;
                          const isOngoing = i === milestoneView.currentIndex;
                          const isUpcoming = !isPast && !isOngoing;
                          let statusLabel = "Upcoming";
                          if (m.isVerified) {
                            statusLabel = "Completed";
                          } else if (isPast) {
                            statusLabel = m.isSubmitted
                              ? "In review"
                              : "Expired";
                          } else if (isOngoing) {
                            statusLabel = m.isSubmitted
                              ? "Under review"
                              : "Pending";
                          }

                          const isPastExpired =
                            isPast && !m.isVerified && !m.isSubmitted;
                          const isInReview =
                            isPast && m.isSubmitted && !m.isVerified;

                          const timeLeft = formatMilestoneCountdown(
                            now,
                            endTimeMs,
                          );
                          const showTimeOrReview =
                            (isPast || isOngoing) &&
                            (m.isSubmitted
                              ? !m.isVerified
                              : timeLeft !== "Ended");
                          // When submitted, show countdown so user knows when milestone ends; status badge shows "Under review"
                          const timeDisplay = timeLeft;

                          return (
                            <div
                              key={m.id}
                              className={cn(
                                "border-2 rounded-xl overflow-hidden transition-colors",
                                isOngoing
                                  ? "border-delulu-yellow-reserved bg-delulu-yellow-reserved/10"
                                  : isUpcoming
                                    ? "border-border/40 bg-muted/30"
                                    : "border-border/60 bg-card",
                              )}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMilestoneId((prev) =>
                                    prev === m.id ? null : m.id,
                                  )
                                }
                                className="w-full flex gap-4 p-4 md:p-5 items-start text-left"
                              >
                                <div className="pt-1">
                                  {openMilestoneId === m.id ? (
                                    <ChevronUp
                                      className={cn(
                                        "w-4 h-4",
                                        isUpcoming &&
                                          "text-muted-foreground/70",
                                      )}
                                    />
                                  ) : (
                                    <ChevronDown
                                      className={cn(
                                        "w-4 h-4",
                                        isUpcoming &&
                                          "text-muted-foreground/70",
                                      )}
                                    />
                                  )}
                                </div>
                                <div className="flex-1 space-y-1.5 min-w-0">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <p
                                      className={cn(
                                        "font-bold text-sm",
                                        isUpcoming
                                          ? "text-muted-foreground"
                                          : "text-foreground",
                                      )}
                                    >
                                      {shortTitle}
                                    </p>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {isOngoing ? (
                                        <div className="flex flex-col  items-center gap-x-2">
                                          {isCreator && (
                                            <div className="">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  openProofModal(
                                                    m.milestoneId,
                                                    m.proofLink,
                                                  );
                                                }}
                                                className="inline-flex items-center rounded-full px-2.5 py-1 border border-border text-[11px] font-semibold bg-secondary"
                                              >
                                                {m.proofLink
                                                  ? "Replace Evidence"
                                                  : "Submit Evidence"}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!m.isVerified && isCreator) {
                                              openProofModal(
                                                m.milestoneId,
                                                m.proofLink,
                                              );
                                            }
                                          }}
                                          className={cn(
                                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border cursor-default",
                                            m.isVerified
                                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                              : isInReview ||
                                                  (isOngoing && m.isSubmitted)
                                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                                : isPastExpired
                                                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                                                  : isUpcoming
                                                    ? "bg-muted/60 text-muted-foreground border-border/50"
                                                    : "bg-secondary text-secondary-foreground border-border",
                                          )}
                                        >
                                          {statusLabel}
                                        </button>
                                      )}

                                      {isCreator &&
                                        !m.isSubmitted &&
                                        !m.isVerified &&
                                        !m.isMissed &&
                                        endTimeMs >= now && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleDeleteMilestone(
                                                m.milestoneId,
                                              );
                                            }}
                                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                                            title="Delete step"
                                          >
                                            <XIcon className="w-4 h-4" />
                                          </button>
                                        )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    {showTimeOrReview && (
                                      <span
                                        className={cn(
                                          "text-[11px] tabular-nums font-medium",
                                          isPastExpired && "text-destructive",
                                          (isInReview ||
                                            (isOngoing && m.isSubmitted)) &&
                                            "text-amber-600 dark:text-amber-400",
                                        )}
                                      >
                                        {timeDisplay}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>

                              {openMilestoneId === m.id && (
                                <div className="px-4 md:px-8 pb-5 pt-0 text-xs md:text-sm text-muted-foreground">
                                  {m.proofLink ? (
                                    <div className="space-y-1.5">
                                      <img
                                        src={m.proofLink}
                                        alt="Evidence"
                                        className="max-h-40 rounded-md border border-border object-contain hidden [&:not([data-failed])]:block"
                                        onLoad={(e) => e.currentTarget.classList.remove("hidden")}
                                        onError={(e) => {
                                          e.currentTarget.dataset.failed = "true";
                                          e.currentTarget.classList.add("hidden");
                                        }}
                                      />
                                      <a
                                        href={m.proofLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 text-xs font-bold underline"
                                      >
                                        View Evidence
                                      </a>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">No evidence added yet</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : isWaitingForMilestones ? (
                    <div className="space-y-3 pt-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="border-2 border-border/40 rounded-xl overflow-hidden animate-pulse"
                        >
                          <div className="flex items-center justify-between px-4 md:px-8 py-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-muted-foreground/20 shrink-0" />
                              <div className="space-y-2">
                                <div className="h-3 w-40 rounded bg-muted-foreground/20" />
                                <div className="h-2.5 w-24 rounded bg-muted-foreground/15" />
                              </div>
                            </div>
                            <div className="h-5 w-16 rounded-full bg-muted-foreground/15 shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-muted p-8 text-center mt-2">
                      <Target className="w-10 h-10 text-muted-foreground/70 mx-auto mb-3" />
                      <p className="text-sm md:text-base font-black text-foreground">
                        {isCreator ? "No steps yet" : "None yet"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>

      {marketToken && safeDelulu.onChainId ? (
        <>
          <SharesSheet
            open={buySharesSheetOpen}
            onOpenChange={setBuySharesSheetOpen}
            deluluId={BigInt(safeDelulu.onChainId)}
            tokenAddress={marketToken as `0x${string}`}
            mode="buy"
            isCreator={!!isCreator}
            isEnded={!!safeDelulu.isResolved}
          />
          <SharesSheet
            open={sellSharesSheetOpen}
            onOpenChange={setSellSharesSheetOpen}
            deluluId={BigInt(safeDelulu.onChainId)}
            tokenAddress={marketToken as `0x${string}`}
            mode="sell"
            isCreator={!!isCreator}
            isEnded={!!safeDelulu.isResolved}
          />
        </>
      ) : null}

      <BottomNav
        onProfileClick={handleProfileClick}
        onCreateClick={handleCreateClick}
      />

      <ConnectorSelectionSheet
        open={showLoginSheet}
        onOpenChange={setShowLoginSheet}
      />

      {isCreator && (
        <ProofModal
          open={!!activeProofMilestoneId}
          onOpenChange={(open) => {
            if (!open) {
              setActiveProofMilestoneId(null);
              setProofSubmitSuccess(false);
            }
          }}
          value={
            activeProofMilestoneId
              ? (milestoneProofLinks[activeProofMilestoneId] ?? "")
              : ""
          }
          onChange={(value) =>
            activeProofMilestoneId &&
            setMilestoneProofLinks((prev) => ({
              ...prev,
              [activeProofMilestoneId]: value,
            }))
          }
          onSubmit={(urlOverride) => {
            if (activeProofMilestoneId) {
              proofSubmittedRef.current = activeProofMilestoneId;
              handleSubmitMilestoneProof(activeProofMilestoneId, urlOverride);
            }
          }}
          isSubmitting={isSubmittingMilestone || isConfirmingSubmitMilestone}
          submitSuccess={proofSubmitSuccess}
          submitError={submitMilestoneError}
          onDone={() => {
            setActiveProofMilestoneId(null);
            setProofSubmitSuccess(false);
          }}
        />
      )}

      <FeedbackModal
        isOpen={showSuccessModal}
        type="success"
        title="Stake Success!"
        message="Your conviction has been recorded."
        onClose={() => setShowSuccessModal(false)}
      />
      <FeedbackModal
        isOpen={showErrorModal}
        type="error"
        title={errorTitle}
        message={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />

      {isCreator && joinModalOpen && !safeDelulu.challengeId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl border border-border">
            <h3 className="text-base md:text-lg font-black text-foreground mb-2">
              Join a campaign
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground mb-4">
              Select an active campaign to join with this delulu. Once joined,
              it can earn points and appear on the campaign leaderboard.
            </p>

            <div className="mb-4">
              {challenges.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No active campaigns available to join right now.
                </p>
              ) : (
                <select
                  className="w-full px-3 py-2 h-[46px] text-sm rounded-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  value={selectedChallengeId ?? ""}
                  onChange={(e) =>
                    setSelectedChallengeId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                >
                  <option value="">Select a campaign</option>
                  {challenges.map((c: { id: number; title?: string }) => (
                    <option key={c.id} value={c.id}>
                      {c.title || `Campaign #${c.id}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {joinErrorMessage && (
              <p className="mb-2 text-xs text-red-500">{joinErrorMessage}</p>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                disabled={isJoining || isConfirmingJoin}
                onClick={() => {
                  if (!isJoining && !isConfirmingJoin) {
                    setJoinModalOpen(false);
                  }
                }}
                className="px-3 py-2 text-xs md:text-sm font-semibold rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !selectedChallengeId ||
                  isJoining ||
                  isConfirmingJoin ||
                  challenges.length === 0
                }
                onClick={handleJoinCampaign}
                className={cn(
                  "px-4 py-2 text-xs md:text-sm font-black rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A]",
                  "bg-delulu-yellow-reserved text-delulu-charcoal hover:scale-[0.98] transition-transform",
                  (!selectedChallengeId || isJoining || isConfirmingJoin) &&
                    "opacity-60 cursor-not-allowed",
                )}
              >
                {isJoining || isConfirmingJoin ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 inline-block animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join campaign"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal open={showDeleteModal} onOpenChange={handleDeleteModalClose}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="text-delulu-charcoal text-xl font-bold">
              Delete
            </ModalTitle>
            <ModalDescription className="mt-2">
              Can&apos;t be undone.
            </ModalDescription>
          </ModalHeader>
          <div className="mt-4 space-y-4">
            {milestoneToDelete && (
              <div className="p-3 bg-muted rounded-lg border border-border">
                <p className="text-sm font-semibold text-foreground">
                  {milestoneToDelete.label}
                </p>
              </div>
            )}

            {deleteMilestoneError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  {getContractErrorDisplay(deleteMilestoneError).message}
                </p>
              </div>
            )}

            {isDeleteMilestoneSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600 font-medium">
                  ✓ Milestone deleted successfully!
                </p>
              </div>
            )}

            <ModalFooter>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  disabled={isDeletingMilestone || isConfirmingDeleteMilestone}
                  onClick={handleDeleteModalClose}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingMilestone || isConfirmingDeleteMilestone}
                  onClick={confirmDeleteMilestone}
                  className={cn(
                    "flex-1 px-4 py-2 text-sm font-black rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A]",
                    "bg-red-500 text-white hover:bg-red-600 hover:scale-[0.98] transition-all",
                    "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100",
                  )}
                >
                  {isDeletingMilestone || isConfirmingDeleteMilestone ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 inline-block animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Milestone"
                  )}
                </button>
              </div>
            </ModalFooter>
          </div>
        </ModalContent>
      </Modal>

      {/* Milestone Preview Modal */}
      <Modal open={showMilestonePreview} onOpenChange={(open) => {
        if (!open && !isAddingMilestones && !isConfirmingAddMilestones) setShowMilestonePreview(false);
      }}>
        <ModalContent className="max-w-lg p-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl" showClose={false}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Preview</p>
              <h2 className="text-lg font-bold text-white leading-tight">Milestone plan</h2>
            </div>
            <button
              type="button"
              onClick={() => { if (!isAddingMilestones && !isConfirmingAddMilestones) setShowMilestonePreview(false); }}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <XIcon className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mx-5" />

          {/* Steps */}
          <div className="px-5 py-4 max-h-[42vh] overflow-y-auto space-y-0">
            {(() => {
              const valid = newMilestones.filter(
                (m) => m.description.trim().length > 0 && m.days.trim().length > 0
              );
              let cursor =
                milestones && milestones.length > 0
                  ? milestones[milestones.length - 1]!.deadline.getTime()
                  : Date.now();
              return valid.map((m, i) => {
                const daysNum = Number(m.days);
                cursor += daysNum * 24 * 60 * 60 * 1000;
                const deadline = new Date(cursor);
                const isLast = i === valid.length - 1;
                return (
                  <div key={i} className="flex gap-3.5">
                    {/* Spine */}
                    <div className="flex flex-col items-center pt-0.5">
                      <div className="w-5 h-5 rounded-full border border-white/20 bg-white/5 text-[10px] font-bold text-zinc-300 flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-white/[0.07] mt-1.5 mb-1.5 min-h-[28px]" />}
                    </div>
                    {/* Content */}
                    <div className={cn("flex-1 min-w-0", !isLast ? "pb-4" : "pb-1")}>
                      <p className="text-sm font-medium text-white leading-snug">{m.description.trim()}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-zinc-500">
                          {daysNum} {daysNum === 1 ? "day" : "days"}
                        </span>
                        <span className="text-zinc-700 text-[10px]">·</span>
                        <span className="text-[11px] text-zinc-600">
                          {deadline.toLocaleDateString("en", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mx-5" />

          {/* Footer */}
          <div className="px-5 pt-4 pb-5 space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-zinc-500">Total duration</span>
              <span className="font-semibold text-zinc-200">
                {newMilestones
                  .filter((m) => m.description.trim() && m.days.trim())
                  .reduce((s, m) => s + Number(m.days), 0)} days
              </span>
            </div>

            {/* One-time warning */}
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                <span className="text-zinc-200 font-semibold">Milestones are final once submitted.</span>{" "}
                Make sure you've added everything — you won't be able to add more after this.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowMilestonePreview(false)}
                disabled={isAddingMilestones || isConfirmingAddMilestones}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-sm font-medium text-zinc-300 transition-colors disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCreateMilestones}
                disabled={isAddingMilestones || isConfirmingAddMilestones || isAddMilestonesSuccess}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-semibold",
                  "bg-[#fcff52] text-[#111] hover:bg-[#f0f234] transition-colors",
                  "flex items-center justify-center gap-2",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                {isAddingMilestones || isConfirmingAddMilestones ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting…</>
                ) : isAddMilestonesSuccess ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Done</>
                ) : (
                  "Confirm & submit"
                )}
              </button>
            </div>
          </div>
        </ModalContent>
      </Modal>

    </div>
  );
}
