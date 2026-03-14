


"use client";
import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useApolloClient } from "@apollo/client/react";
import { refetchDeluluData, refetchAfterClaim, refetchAllActiveQueries } from "@/lib/graph/refetch-utils";
import { useStake } from "@/hooks/use-stake";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { TokenBadge } from "@/components/token-badge";
import { useUserPosition } from "@/hooks/use-user-position";
import { useClaimWinnings } from "@/hooks/use-claim-winnings";
import { useUserClaimableAmount } from "@/hooks/use-user-claimable-amount";
import { useGraphDelulu, useGraphDeluluStakes } from "@/hooks/graph";
import { useChallenges } from "@/hooks/use-challenges";
import { useJoinChallenge } from "@/hooks/use-join-challenge";
import { FeedbackModal } from "@/components/feedback-modal";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from "@/components/ui/modal";
import { StakeFlowSheet } from "@/components/stake-flow-sheet";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
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
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";
import { getDeluluContractAddress, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { resolveIPFSContent, type DeluluIPFSMetadata } from "@/lib/graph/ipfs-cache";



export default function DeluluPage() {
  const router = useRouter();
  const params = useParams();
  const deluluId = params.id as string;

  const { isConnected, address } = useAccount();
  const apolloClient = useApolloClient();
  const queryClient = useQueryClient();

  const { delulu, milestones, isLoading: isLoadingDelulu } = useGraphDelulu(deluluId);

  const [ipfsMetadata, setIpfsMetadata] = useState<DeluluIPFSMetadata | null>(null);

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
      : delulu?.id ?? null;

  const { stake, isSuccess: isStakeSuccess, error: stakeError } = useStake();
  const marketToken = delulu?.tokenAddress;
  const deluluIdForHooks = delulu?.id && isConnected ? delulu.id : null;

  const { balance: tokenBalance, isLoading: isLoadingBalance } = useTokenBalance(marketToken);
  const { hasStaked, isClaimed } = useUserPosition(deluluIdForHooks);

  const { claimableAmount, isLoading: isLoadingClaimableAmount } = useUserClaimableAmount(deluluIdForHooks);

  const { claim, isPending: isClaiming, isConfirming: isClaimConfirming, isSuccess: isClaimSuccess, error: claimError } = useClaimWinnings();

  const { data: stakes, isLoading: isLoadingStakes, refetch: refetchStakes } = useGraphDeluluStakes(deluluId || null);

  const leaderboard = useMemo(() => {
    if (!stakes || stakes.length === 0) return [];
    const grouped = stakes.reduce((acc, stake) => {
      const key = stake.user?.address || stake.userId;
      if (!acc[key]) {
        acc[key] = {
          address: stake.user?.address || "",
          username: stake.user?.username,
          pfpUrl: (stake.user as { pfpUrl?: string })?.pfpUrl,
          believerStake: 0,
          totalStake: 0,
        };
      }
      acc[key].believerStake += stake.amount;
      acc[key].totalStake += stake.amount;
      return acc;
    }, {} as Record<string, { address: string; username?: string; pfpUrl?: string; believerStake: number; totalStake: number }>);

    return Object.values(grouped)
      .sort((a, b) => b.totalStake - a.totalStake)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [stakes]);

  const [stakeAmount, setStakeAmount] = useState("1");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorTitle, setErrorTitle] = useState("Staking Failed");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showClaimSuccessModal, setShowClaimSuccessModal] = useState(false);

  const [stakingSheetOpen, setStakingSheetOpen] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "milestones">("details");

  const handleProfileClick = () => {
    if (!isConnected) setShowLoginSheet(true);
    else router.push("/profile");
  };
  const handleCreateClick = () => {
    if (!isConnected) setShowLoginSheet(true);
    else router.push("/board");
  };

  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [newMilestones, setNewMilestones] = useState<{ description: string; days: string }[]>([{ description: "", days: "" }]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState<{ id: string; label?: string } | null>(null);
  const [milestoneProofLinks, setMilestoneProofLinks] = useState<Record<string, string>>({});
  const [activeProofMilestoneId, setActiveProofMilestoneId] = useState<string | null>(null);
  const [openMilestoneId, setOpenMilestoneId] = useState<string | null>(null);

  const { challenges } = useChallenges();


  const {
    joinChallenge,
    isJoining,
    isConfirming: isConfirmingJoin,
    isSuccess: isJoinSuccess,
    errorMessage: joinErrorMessage,
  } = useJoinChallenge();


  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(null);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const currentCampaign = useMemo(() => {
    if (!delulu?.challengeId || !challenges?.length) return null;
    return challenges.find((c: { id: number }) => c.id === delulu.challengeId) ?? null;
  }, [delulu?.challengeId, challenges]);




  const supportAmount =
    delulu?.totalSupportCollected || 0;

  const deluluTitle =
    ipfsMetadata?.text ||
    ipfsMetadata?.content ||
    delulu?.content ||
    "";

  const deluluDescription =
    (ipfsMetadata as any)?.description ?? "";

  const supportersCount =
    delulu?.totalSupporters ?? (stakes ? stakes.length : 0);


  const formatMilestoneTimeLeft = (deadline: Date) => {
    const diffMs = deadline.getTime() - Date.now();
    if (diffMs <= 0) return "Ended";

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const days = Math.floor(hours / 24);
    
    // Show days if 24 hours or more
    if (days > 0) {
      const remainingHours = hours % 24;
      if (remainingHours > 0) {
        return `${days}d ${remainingHours}h left`;
      }
      return `${days}d left`;
    }
    
    // Show hours and minutes if less than 24 hours
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, "0")}m left`;
    }
    return `${minutes}m left`;
  };

  // Calculate milestone duration in days from startTime and deadline
  const getMilestoneDurationDays = (milestone: { startTime: Date | null; deadline: Date }): number | null => {
    if (!milestone.startTime) return null;
    const diffMs = milestone.deadline.getTime() - milestone.startTime.getTime();
    if (diffMs <= 0) return null;
    const days = diffMs / (24 * 60 * 60 * 1000);
    return Math.round(days * 100) / 100; // Round to 2 decimal places
  };



  const { usd: gDollarUsdPrice } = useGoodDollarPrice();
  const isGoodDollarMarket =
    delulu?.tokenAddress &&
    delulu.tokenAddress.toLowerCase() === GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();
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

  const chainId = useChainId();
  const isCreator = isConnected && address && delulu?.creator && address.toLowerCase() === delulu.creator.toLowerCase();

  const { writeContract: writeAddMilestones, data: addMilestonesHash, isPending: isAddingMilestones, error: addMilestonesError } = useWriteContract();
  const { isLoading: isConfirmingAddMilestones, isSuccess: isAddMilestonesSuccess } = useWaitForTransactionReceipt({ hash: addMilestonesHash });
  const { writeContract: writeSubmitMilestone, data: submitMilestoneHash, isPending: isSubmittingMilestone, error: submitMilestoneError } = useWriteContract();
  const { isLoading: isConfirmingSubmitMilestone, isSuccess: isSubmitMilestoneSuccess } = useWaitForTransactionReceipt({ hash: submitMilestoneHash });
  const { writeContract: writeResetMilestones, data: resetMilestonesHash, isPending: isResettingMilestones, error: resetMilestonesError } = useWriteContract();
  const { isLoading: isConfirmingResetMilestones, isSuccess: isResetMilestonesSuccess } = useWaitForTransactionReceipt({ hash: resetMilestonesHash });
  const { writeContract: writeDeleteMilestone, data: deleteMilestoneHash, isPending: isDeletingMilestone, error: deleteMilestoneError } = useWriteContract();
  const { isLoading: isConfirmingDeleteMilestone, isSuccess: isDeleteMilestoneSuccess } = useWaitForTransactionReceipt({ hash: deleteMilestoneHash });

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  /** Delulu remaining time in days (from start of new milestones to resolution deadline). */
  const deluluRemainingDaysTotal = useMemo(() => {
    if (!delulu?.resolutionDeadline) return 0;
    let startMs = Date.now();
    if (milestones && milestones.length > 0) {
      const last = milestones[milestones.length - 1];
      if (last?.deadline) startMs = last.deadline.getTime();
    }
    const endMs = delulu.resolutionDeadline.getTime();
    const days = (endMs - startMs) / MS_PER_DAY;
    return Math.max(0, Math.floor(days * 100) / 100);
  }, [delulu?.resolutionDeadline, milestones]);

  /** For each new milestone row: max days allowed so total never exceeds delulu duration. */
  const maxDaysPerRow = useMemo(() => {
    return newMilestones.map((_, index) => {
      const daysUsedByPrevious = newMilestones
        .slice(0, index)
        .reduce((sum, m) => sum + (Number(m.days) || 0), 0);
      return Math.max(0, Math.floor(deluluRemainingDaysTotal - daysUsedByPrevious));
    });
  }, [newMilestones, deluluRemainingDaysTotal]);

  const handleAddMilestoneRow = () => setNewMilestones((prev) => [...prev, { description: "", days: "" }]);
  const handleRemoveMilestoneRow = (index: number) => setNewMilestones((prev) => prev.filter((_, i) => i !== index));
  const handleNewMilestoneChange = (index: number, field: "description" | "days", value: string) => {
    if (field === "days") {
      setNewMilestones((prev) => {
        const daysUsedByPrevious = prev
          .slice(0, index)
          .reduce((sum, m) => sum + (Number(m.days) || 0), 0);
        const maxDays = Math.max(0, Math.floor(deluluRemainingDaysTotal - daysUsedByPrevious));
        if (value === "" || value === null || value === undefined) {
          return prev.map((m, i) => (i === index ? { ...m, days: "" } : m));
        }
        const parsed = Number(value);
        if (Number.isNaN(parsed) || parsed < 0) return prev;
        const clamped = Math.min(maxDays, Math.max(0, Math.floor(parsed)));
        return prev.map((m, i) => (i === index ? { ...m, days: clamped === 0 ? "" : String(clamped) } : m));
      });
      return;
    }
    setNewMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleCreateMilestones = () => {
    if (!isCreator || !delulu) return;

    // Validate that at least one milestone has both description and days
    const validMilestones = newMilestones.filter(
      (m) => m.description.trim().length > 0 && m.days.trim().length > 0
    );

    if (validMilestones.length === 0) {
      setErrorTitle("Missing");
      setErrorMessage("Add at least one step with description and days.");
      setShowErrorModal(true);
      return;
    }

    // Check for incomplete milestones (one field filled but not the other)
    const incompleteMilestones = newMilestones.filter(
      (m) =>
        (m.description.trim().length > 0 && m.days.trim().length === 0) ||
        (m.description.trim().length === 0 && m.days.trim().length > 0)
    );

    if (incompleteMilestones.length > 0) {
      setErrorTitle("Incomplete");
      setErrorMessage("Fill description and days for each step.");
      setShowErrorModal(true);
      return;
    }

    // Validate that all days are valid numbers > 0
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

    // Validate that the total sequential duration does not exceed the resolution deadline.
    // When adding more milestones, calculate from the last existing milestone deadline.
    const totalDurationSeconds = validMilestones.reduce((sum, m) => {
      const days = Number(m.days);
      return sum + days * 24 * 60 * 60;
    }, 0);

    // Find the last milestone deadline if milestones exist, otherwise use current time
    let startTimeSeconds = Math.floor(Date.now() / 1000);
    if (milestones && milestones.length > 0) {
      const lastMilestone = milestones[milestones.length - 1];
      if (lastMilestone && lastMilestone.deadline) {
        startTimeSeconds = Math.floor(lastMilestone.deadline.getTime() / 1000);
      }
    }

    const resolutionSeconds = Math.floor(delulu.resolutionDeadline.getTime() / 1000);

    if (startTimeSeconds + totalDurationSeconds > resolutionSeconds) {
      setErrorTitle("Too long");
      setErrorMessage("Total days exceed deadline.");
      setShowErrorModal(true);
      return;
    }

    const mURIs = validMilestones.map((m) => m.description.trim());
    // Convert days to seconds: 1 day = 86400 seconds, 3 days = 259200 seconds, etc.
    // The contract expects durations in seconds
    const mDurations = validMilestones.map((m) =>
      BigInt(Math.floor(Number(m.days) * 24 * 60 * 60))
    );

    writeAddMilestones({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "addMilestones",
      args: [BigInt(delulu.id), mURIs, mDurations],
    });
  };

  const handleSubmitMilestoneProof = (milestoneId: string, linkOverride?: string) => {
    const link = (linkOverride ?? milestoneProofLinks[milestoneId] ?? "").trim();
    writeSubmitMilestone({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "submitMilestone",
      args: [BigInt(delulu!.id), BigInt(milestoneId), link],
    });
  };



  const openProofModal = (milestoneId: string, existingProof?: string | null) => {
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
      // errors handled via hook state
    }
  };

  useEffect(() => {
    if (isStakeSuccess) {
      setShowSuccessModal(true);
      setStakeAmount("1");
      refetchStakes();
      refetchDeluluData(apolloClient, deluluId);
    }
  }, [isStakeSuccess, deluluId, apolloClient]);

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
      refetchDeluluData(apolloClient, deluluId);
      setShowDeleteModal(false);
      setMilestoneToDelete(null);
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
    const milestoneLabel = milestone.milestoneURI && milestone.milestoneURI.length > 0
      ? milestone.milestoneURI
      : `Step ${milestoneId}`;
    setMilestoneToDelete({ 
      id: milestoneId, 
      label: milestoneLabel
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
          c.active && c.startTime <= now && c.endTime > now
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

      // Fire confetti on successful campaign join
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
        }
      })();
    }
  }, [isJoinSuccess, apolloClient, deluluId]);

  useEffect(() => {
    if (isAddMilestonesSuccess) {
      setShowMilestoneForm(false);
      // Refetch this delulu's data
      refetchDeluluData(apolloClient, deluluId);
      // Refetch all active queries to update lists on home page, profile page, etc.
      refetchAllActiveQueries(apolloClient, 5000); // 5 second delay for subgraph indexing
      // Visual feedback: confetti when milestones are created successfully
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
      // Refetch this delulu's data
      refetchDeluluData(apolloClient, deluluId);
      // Refetch all active queries to update lists on home page, profile page, etc.
      refetchAllActiveQueries(apolloClient, 5000); // 5 second delay for subgraph indexing
    }
  }, [isSubmitMilestoneSuccess, apolloClient, deluluId]);

  // Initial load: show skeleton layout instead of spinner
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
              {/* Banner skeleton */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="h-48 bg-muted animate-pulse" />
                <div className="p-6 space-y-3">
                  <div className="h-6 w-2/3 bg-muted rounded-md animate-pulse" />
                  <div className="h-4 w-1/3 bg-muted rounded-md animate-pulse" />
                  <div className="h-16 w-full bg-muted rounded-md animate-pulse" />
                </div>
              </div>

              {/* Details skeleton */}
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

  // Only show "not found" once loading has completed and no delulu was returned.
  if (!isLoadingDelulu && !delulu) {
    return (
      <div className="p-20 text-center text-foreground">
        Delulu not found
      </div>
    );
  }

  // At this point, delulu is guaranteed to be non-null
  const safeDelulu = delulu!;

  const canStake = !safeDelulu.isResolved && new Date() < safeDelulu.stakingDeadline && !hasStaked;
  const bannerImage = safeDelulu.bgImageUrl || "/templates/t0.png";
  const canAddMilestones = safeDelulu.resolutionDeadline && new Date() < safeDelulu.resolutionDeadline;

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

                <span className="flex items-center justify-center shrink-0">
                  <Image
                    src="/favicon_io/favicon-32x32.png"
                    alt="Delulu"
                    width={28}
                    height={28}
                    className="h-7 w-7"
                  />
                </span>

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
          </div>

          <div className="px-4 lg:px-6 py-6 space-y-6 pt-20 lg:pt-6">
            {/* Market banner / hero */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="relative h-48 bg-cover bg-center" style={{ backgroundImage: `url(${bannerImage})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

                {canStake && (
                  <button
                    onClick={() =>
                      !isConnected ? setShowLoginSheet(true) : setStakingSheetOpen(true)
                    }
                    className="w-fit right-4 bottom-4 absolute px-4 py-2 bg-delulu-yellow-reserved text-delulu-charcoal border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black rounded-lg text-sm hover:brightness-105 transition"
                  >
                    Support
                  </button>
                )}
              </div>
              <div className="p-6 space-y-3">
                <h1 className="text-2xl font-black mb-1 text-foreground">
                  {deluluTitle || safeDelulu.content}
                </h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    @{safeDelulu.username || formatAddress(safeDelulu.creator)}
                  </span>
                  {marketToken && <TokenBadge tokenAddress={marketToken} size="sm" />}
                </div>

                {/* Key stats row */}
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-muted-foreground" />
                    <span className="font-bold text-sm text-foreground">
                      {supportAmount > 0
                        ? supportAmount < 0.01
                          ? supportAmount.toFixed(4)
                          : supportAmount.toFixed(2)
                        : "0.00"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      total support
                      {totalSupportUsd && totalSupportUsd > 0 && (
                        <> · ${totalSupportUsd.toFixed(2)}</>
                      )}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-border/60" />
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-xs">
                      {supportersCount} supporters
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
                    : "border-transparent text-muted-foreground hover:text-foreground"
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
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Milestones
              </button>
            </div>

            {activeTab === "details" ? (
              <div className="space-y-6">
                <div className="p-6 bg-card rounded-2xl border border-border space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-delulu-yellow-reserved/20 border border-delulu-yellow-reserved/60">
                        <Users className="w-4 h-4 text-delulu-charcoal" />
                      </span>
                      <h3 className="text-sm md:text-base font-black text-foreground">
                        Token support
                      </h3>
                    </div>
                    {marketToken && (
                      <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase">
                        <span>Token</span>
                        <TokenBadge tokenAddress={marketToken} size="sm" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-sm">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                        Total support
                      </p>
                      <p className="text-2xl md:text-3xl font-black text-foreground flex flex-col gap-1">
                        <span className="flex items-center gap-2">
                          {supportAmount > 0
                            ? supportAmount < 0.01
                              ? supportAmount.toFixed(4)
                              : supportAmount.toFixed(2)
                            : "0.00"}
                          {marketToken && (
                            <span className="inline-flex sm:hidden">
                              <TokenBadge tokenAddress={marketToken} size="sm" />
                            </span>
                          )}
                        </span>
                        {totalSupportUsd && totalSupportUsd > 0 && (
                          <span className="text-sm font-semibold text-muted-foreground">
                            ≈ ${totalSupportUsd.toFixed(2)}
                          </span>
                        )}
                        {safeDelulu.creatorStake && safeDelulu.creatorStake > 0 && (
                          <span className="text-xs font-medium text-muted-foreground">
                            Creator stake:{" "}
                            {safeDelulu.creatorStake < 0.01
                              ? safeDelulu.creatorStake.toFixed(4)
                              : safeDelulu.creatorStake.toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="md:border-l md:border-border/60 md:pl-6">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                        Supporters
                      </p>
                      <p className="text-lg md:text-2xl font-black text-foreground">
                        {supportersCount}
                      </p>
                    </div>

                    <div className="md:border-l md:border-border/60 md:pl-6">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                        Avg. per supporter
                      </p>
                      <p className="text-lg font-semibold text-foreground flex flex-col gap-1">
                        <span>
                          {supportersCount > 0
                            ? supportAmount / supportersCount < 0.01
                              ? (supportAmount / supportersCount).toFixed(4)
                              : (supportAmount / supportersCount).toFixed(2)
                            : "0.00"}
                        </span>
                        {avgSupportUsd && avgSupportUsd > 0 && (
                          <span className="text-xs font-medium text-muted-foreground">
                            ≈ ${avgSupportUsd.toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {leaderboard.length > 0 && (
                  <div>
                    <h2 className="text-base font-black mb-4 text-foreground">Top Supporters</h2>
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
                                @{entry.username || formatAddress(entry.address)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {entry.totalStake.toFixed(2)} staked
                              </p>
                            </div>
                          </div>
                          <Trophy
                            className={cn(
                              "w-5 h-5",
                              entry.rank === 1 ? "text-yellow-400" : "text-muted-foreground/40"
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Campaign section */}
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
                    {safeDelulu.challengeId && (
                      <span className="text-xs md:text-sm font-semibold text-purple-200 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-400/60">
                        {currentCampaign?.title || `Campaign #${Number(safeDelulu.challengeId)}`}
                      </span>
                    )}
                  </div>
                  {!safeDelulu.challengeId ? (
                    <>
                      {isCreator && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <p className="text-sm text-muted-foreground flex-1">
                            Join a campaign to compete on leaderboards and earn rewards.
                          </p>
                          <button
                            type="button"
                            onClick={() => setJoinModalOpen(true)}
                            className="inline-flex items-center justify-center px-4 py-2 text-xs md:text-sm font-black rounded-md border-2 border-delulu-charcoal bg-delulu-yellow-reserved text-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A] hover:scale-[0.98] transition-transform"
                          >
                            Join campaign
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>
                        This delulu is participating in{" "}
                        {currentCampaign?.title || `Campaign #${Number(safeDelulu.challengeId)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Milestones Card */}
                <div className="rounded-2xl border border-border bg-card p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base md:text-lg font-black text-foreground flex items-center gap-2">
                        <Target className="w-4 h-4 md:w-5 md:h-5" />
                        Milestones
                      </h2>
                      {milestones && milestones.length > 0 && (
                        <span className="text-xs md:text-sm text-muted-foreground font-medium">
                          {milestones.filter((m) => m.isVerified).length}/{milestones.length}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                    {isCreator && canAddMilestones && (
                      <button
                        type="button"
                        onClick={() => setShowMilestoneForm((open) => !open)}
                        className=" w-fit  inline-flex items-center justify-center px-3 py-2 text-xs md:text-sm font-semibold rounded-sm border border-border text-foreground hover:bg-muted transition-colors"
                      >
                        {showMilestoneForm ? "Close" : "Add"}
                      </button>
                    )}
                     
                    </div>
                  </div>

                  {isCreator && canAddMilestones && showMilestoneForm && (
                    <div className="mb-4 border border-dashed border-border rounded-2xl p-3 md:p-4 bg-muted/60">
                      {delulu?.resolutionDeadline && (
                        <p className="text-xs text-muted-foreground mb-3">
                          <strong className="text-foreground">{deluluRemainingDaysTotal}</strong> days left · sequential
                        </p>
                      )}
                      <div className="space-y-3 md:space-y-4">
                        {newMilestones.map((m, index) => {
                          // Calculate milestone timing
                          // NOTE: Duration input is in DAYS (1 = 1 day, 3 = 3 days)
                          // Contract receives: days * 24 * 60 * 60 (converted to seconds)
                          // Display calculation: days * 24 * 60 * 60 * 1000 (converted to milliseconds for JS Date)
                          const calculateMilestoneTiming = () => {
                            // Start from current time, or last milestone's deadline if milestones exist
                            let startTime = Date.now();
                            
                            // If there are existing milestones, find the last one's deadline
                            if (milestones && milestones.length > 0) {
                              const lastMilestone = milestones[milestones.length - 1];
                              if (lastMilestone && lastMilestone.deadline) {
                                startTime = lastMilestone.deadline.getTime();
                              }
                            }
                            
                            // Calculate cumulative start times for previous new milestones in this batch
                            // Each milestone starts when the previous one ends
                            for (let i = 0; i < index; i++) {
                              const prevDays = Number(newMilestones[i].days) || 0;
                              if (prevDays > 0) {
                                // Convert days to milliseconds: 1 day = 24 * 60 * 60 * 1000 ms
                                startTime += prevDays * 24 * 60 * 60 * 1000;
                              }
                            }
                            
                            // Calculate end time: startTime + duration in days
                            const days = Number(m.days) || 0;
                            // 1 day = 24 hours = 86400000 milliseconds
                            const endTime = days > 0 ? startTime + (days * 24 * 60 * 60 * 1000) : startTime;
                            
                            // Check if this exceeds resolution deadline
                            const resolutionTime = delulu?.resolutionDeadline?.getTime() || 0;
                            const exceedsDeadline = resolutionTime > 0 && endTime > resolutionTime;
                            
                            return { startTime, endTime, exceedsDeadline };
                          };
                          
                          const { exceedsDeadline } = calculateMilestoneTiming();
                          
                          return (
                            <div
                              key={index}
                              className="rounded-xl border border-border bg-card p-3 md:p-4 space-y-2"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-black text-muted-foreground uppercase">
                                  Step {index + 1}
                                </span>
                                {newMilestones.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMilestoneRow(index)}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                                  >
                                    <XIcon className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-end gap-2">
                                  <div className="flex-1 min-w-0">
                                    <input
                                      type="text"
                                      placeholder="What to do"
                                      value={m.description}
                                      onChange={(e) =>
                                        handleNewMilestoneChange(
                                          index,
                                          "description",
                                          e.target.value
                                        )
                                      }
                                      className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <label className="text-[11px] font-medium text-muted-foreground">
                                      Days
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={maxDaysPerRow[index] || undefined}
                                      placeholder={maxDaysPerRow[index] != null && maxDaysPerRow[index] > 0 ? `1–${maxDaysPerRow[index]}` : "—"}
                                      value={m.days}
                                      onChange={(e) =>
                                        handleNewMilestoneChange(index, "days", e.target.value)
                                      }
                                      className="w-20 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                    />
                                    {maxDaysPerRow[index] != null && maxDaysPerRow[index] > 0 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        max {maxDaysPerRow[index]}
                                      </span>
                                    )}
                                  </div>
                                </div>
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
                          onClick={handleCreateMilestones}
                          disabled={isAddingMilestones || isConfirmingAddMilestones}
                          className={cn(
                            "inline-flex items-center justify-center px-4 py-2 text-xs md:text-sm font-black rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A]",
                            "bg-delulu-yellow-reserved text-delulu-charcoal hover:scale-[0.98] transition-transform",
                            (isAddingMilestones || isConfirmingAddMilestones) &&
                            "opacity-60 cursor-not-allowed"
                          )}
                        >
                          {isAddingMilestones || isConfirmingAddMilestones ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Save
                            </>
                          ) : (
                            "Save"
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Milestones list */}
                  {milestones && milestones.length > 0 ? (
                    <>
                      <div className="space-y-3 md:space-y-4">
                        {milestones.map((m, i) => {
                          const fullTitle =
                            (m.milestoneURI && m.milestoneURI.length > 0
                              ? m.milestoneURI
                              : `Step ${i + 1}`) || "";
                          const shortTitle =
                            fullTitle.length > 80
                              ? `${fullTitle.slice(0, 77)}…`
                              : fullTitle;

                          let statusLabel = "Pending";
                          if (m.isVerified) {
                            statusLabel = "Completed";
                          } else if (m.deadline.getTime() < Date.now()) {
                            statusLabel = "Expired";
                          }

                          const timeLabel = m.isVerified
                            ? m.deadline.toLocaleDateString()
                            : formatMilestoneTimeLeft(m.deadline);
                          
                          // Calculate duration in days
                          const durationDays = getMilestoneDurationDays(m);

                          return (
                            <div
                              key={m.id}
                              className="border-2 border-border/60 rounded-xl overflow-hidden bg-card"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMilestoneId((prev) =>
                                    prev === m.id ? null : m.id
                                  )
                                }
                                className="w-full flex gap-4 p-4 items-start text-left"
                              >
                                <div className="pt-1">
                                  {openMilestoneId === m.id ? (
                                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-bold text-foreground">
                                      {shortTitle}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (
                                            !m.isVerified &&
                                            isCreator
                                          ) {
                                            openProofModal(
                                              m.milestoneId,
                                              m.proofLink
                                            );
                                          }
                                        }}
                                        className={cn(
                                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                                          m.isVerified
                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 cursor-default"
                                            : "bg-secondary text-secondary-foreground border-border hover:bg-muted cursor-pointer transition-colors"
                                        )}
                                      >
                                        {statusLabel}
                                      </button>
                                      {isCreator && !m.isSubmitted && !m.isVerified && !m.isMissed && m.deadline.getTime() >= Date.now() && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDeleteMilestone(m.milestoneId);
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
                                    {durationDays !== null && (
                                      <span className="text-xs md:text-sm font-semibold text-foreground">
                                        {durationDays === Math.floor(durationDays) 
                                          ? `${Math.floor(durationDays)}d`
                                          : `${durationDays.toFixed(1)}d`}
                                      </span>
                                    )}
                                    <span className="text-xs md:text-sm text-muted-foreground">
                                      {timeLabel}
                                    </span>
                                  </div>
                                </div>
                              </button>

                              {openMilestoneId === m.id && (
                                <div className="px-4 pb-4 pt-0 text-xs md:text-sm text-muted-foreground space-y-2">
                                  <p className="whitespace-pre-wrap">
                                    {fullTitle}
                                  </p>
                                  {m.proofLink && (
                                    <a
                                      href={m.proofLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 text-xs font-bold underline"
                                    >
                                      View Evidence
                                    </a>
                                  )}

                                  {isCreator && !m.isVerified && (
                                    <div className="flex items-center gap-3 mt-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openProofModal(m.milestoneId, m.proofLink)
                                        }
                                        className="inline-flex items-center text-xs md:text-sm font-semibold text-delulu-charcoal hover:underline"
                                      >
                                        {m.proofLink ? "Proof" : "Add proof"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Optional: progress summary could go here */}
                    </>
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

      <StakeFlowSheet open={stakingSheetOpen} onOpenChange={setStakingSheetOpen} delulu={delulu} />

      <BottomNav
        onProfileClick={handleProfileClick}
        onCreateClick={handleCreateClick}
      />

      <ConnectorSelectionSheet open={showLoginSheet} onOpenChange={setShowLoginSheet} />
      {isCreator && activeProofMilestoneId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border">
            <h3 className="text-base md:text-lg font-black text-foreground mb-2">
              Proof
            </h3>
            <input
              type="url"
              placeholder="Proof link"
              value={milestoneProofLinks[activeProofMilestoneId] ?? ""}
              onChange={(e) =>
                setMilestoneProofLinks((prev) => ({
                  ...prev,
                  [activeProofMilestoneId]: e.target.value,
                }))
              }
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary mt-2"
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              Tip: Upload files to{" "}
              <a
                href="https://drive.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Google Drive
              </a>
              , set sharing to &quot;Anyone with the link,&quot; then paste the link here.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveProofMilestoneId(null)}
                className="px-3 py-2 text-xs md:text-sm font-semibold rounded-md border border-border text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSubmitMilestoneProof(activeProofMilestoneId);
                  setActiveProofMilestoneId(null);
                }}
                disabled={isSubmittingMilestone || isConfirmingSubmitMilestone}
                className={cn(
                  "px-4 py-2 text-xs md:text-sm font-black rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A]",
                  "bg-delulu-yellow-reserved text-delulu-charcoal hover:scale-[0.98] transition-transform",
                  (isSubmittingMilestone || isConfirmingSubmitMilestone) &&
                  "opacity-60 cursor-not-allowed"
                )}
              >
                {isSubmittingMilestone || isConfirmingSubmitMilestone ? "Submit" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
      <FeedbackModal isOpen={showSuccessModal} type="success" title="Stake Success!" message="Your conviction has been recorded." onClose={() => setShowSuccessModal(false)} />
      <FeedbackModal isOpen={showErrorModal} type="error" title={errorTitle} message={errorMessage} onClose={() => setShowErrorModal(false)} />

      {/* Join campaign modal */}
      {isCreator && joinModalOpen && !safeDelulu.challengeId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl border border-border">
            <h3 className="text-base md:text-lg font-black text-foreground mb-2">
              Join a campaign
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground mb-4">
              Select an active campaign to join with this delulu. Once joined, it can earn
              points and appear on the campaign leaderboard.
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
                    setSelectedChallengeId(e.target.value ? Number(e.target.value) : null)
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
                  "opacity-60 cursor-not-allowed"
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

      {/* Delete Milestone Confirmation Modal */}
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
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">
                  {deleteMilestoneError instanceof Error
                    ? deleteMilestoneError.message
                    : "Delete failed."}
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
                    "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
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
    </div>
  );
}