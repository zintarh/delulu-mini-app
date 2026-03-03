


"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useApolloClient } from "@apollo/client/react";
import { refetchDeluluData, refetchAfterClaim } from "@/lib/graph/refetch-utils";
import { useStake } from "@/hooks/use-stake";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { TokenBadge } from "@/components/token-badge";
import { useUserPosition } from "@/hooks/use-user-position";
import { useClaimWinnings } from "@/hooks/use-claim-winnings";
import { useUserClaimableAmount } from "@/hooks/use-user-claimable-amount";
import { usePotentialPayoutForExistingStake } from "@/hooks/use-potential-payout-existing";
import { useGraphDelulu, useGraphDeluluStakes } from "@/hooks/graph";
import { useChallenges } from "@/hooks/use-challenges";
import { useJoinChallenge } from "@/hooks/use-join-challenge";
import { FeedbackModal } from "@/components/feedback-modal";
import { StakeFlowSheet } from "@/components/stake-flow-sheet";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { ChallengesHeader } from "@/components/challenges-header";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
  Menu,
  Search,
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";
import { getDeluluContractAddress, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { keccak256, stringToBytes } from "viem";



export default function DeluluPage() {
  const router = useRouter();
  const params = useParams();
  const deluluId = params.id as string;

  const { isConnected, address } = useAccount();
  const apolloClient = useApolloClient();
  const queryClient = useQueryClient();

  const { delulu, milestones, isLoading: isLoadingDelulu } = useGraphDelulu(deluluId);



  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !delulu?.contentHash) return;

    (async () => {
      try {
        const { resolveIPFSContent } = await import("@/lib/graph/ipfs-cache");
        const metadata = await resolveIPFSContent(delulu.contentHash);
        // eslint-disable-next-line no-console
        console.log("[DeluluPage] decoded IPFS content", {
          contentHash: delulu.contentHash,
          metadata,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[DeluluPage] failed to decode IPFS content", e);
      }
    })();
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Default to details tab for single delulu page
  const [activeTab, setActiveTab] = useState<"details" | "milestones">("details");

  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [newMilestones, setNewMilestones] = useState<{ description: string; days: string }[]>([{ description: "", days: "" }]);
  const [milestoneProofLinks, setMilestoneProofLinks] = useState<Record<string, string>>({});
  const [activeProofMilestoneId, setActiveProofMilestoneId] = useState<string | null>(null);

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
    delulu?.totalSupportCollected || 0

  const rawContent = delulu?.content ?? "";
  const [deluluTitle, ...deluluDescriptionParts] = rawContent.split("\n\n");
  const deluluDescription = deluluDescriptionParts.join("\n\n").trim();

  const supportersCount =
    delulu?.totalSupporters ?? (stakes ? stakes.length : 0);

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

  const handleAddMilestoneRow = () => setNewMilestones((prev) => [...prev, { description: "", days: "" }]);
  const handleRemoveMilestoneRow = (index: number) => setNewMilestones((prev) => prev.filter((_, i) => i !== index));
  const handleNewMilestoneChange = (index: number, field: "description" | "days", value: string) => {
    setNewMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleCreateMilestones = () => {
    if (!isCreator || !delulu) return;
    // Contract only allows initializing milestones once
    if (milestones && milestones.length > 0) return;

    const cleaned = newMilestones.filter(
      (m) => m.description.trim().length > 0 && m.days.trim().length > 0
    );

    if (cleaned.length === 0) return;

    // Validate that the total sequential duration does not exceed the resolution deadline.
    // The contract uses `block.timestamp` as a starting point and reverts with InvalidDeadlines()
    // if the final milestone deadline is after `resolutionDeadline`.
    const totalDurationSeconds = cleaned.reduce((sum, m) => {
      const days = Number(m.days);
      if (Number.isNaN(days) || days <= 0) return sum;
      return sum + days * 24 * 60 * 60;
    }, 0);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const resolutionSeconds = Math.floor(delulu.resolutionDeadline.getTime() / 1000);

    if (nowSeconds + totalDurationSeconds > resolutionSeconds) {
      setErrorTitle("Milestones exceed resolution deadline");
      setErrorMessage(
        "The total duration of your milestones goes past this delulu's resolution deadline. Reduce the number of days or update the resolution deadline."
      );
        setShowErrorModal(true);
        return;
      }

    const mHashes = cleaned.map((m) => keccak256(stringToBytes(m.description)));
    const mDurations = cleaned.map((m) =>
      BigInt(Math.floor(Number(m.days) * 24 * 60 * 60))
    );

    writeAddMilestones({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "addMilestones",
      args: [BigInt(delulu.id), mHashes, mDurations],
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

  // Sync Logic
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
          // Confetti is optional and purely visual
        }
      })();
    }
  }, [isJoinSuccess, apolloClient, deluluId]);

  useEffect(() => {
    if (isAddMilestonesSuccess) {
      setShowMilestoneForm(false);
      refetchDeluluData(apolloClient, deluluId);
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

  // Initial load: show skeleton layout instead of spinner
  if (isLoadingDelulu && !delulu) {
    return (
      <div className="h-screen overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
          <div className="hidden lg:block">
            <LeftSidebar
              onProfileClick={() =>
                !isConnected ? setShowLoginSheet(true) : router.push("/profile")
              }
              onCreateClick={() =>
                !isConnected ? setShowLoginSheet(true) : router.push("/board")
              }
            />
        </div>

          <main className="h-screen lg:border-x border-gray-200 overflow-y-auto scrollbar-hide pb-20">
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
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="h-48 bg-gray-200 animate-pulse" />
                <div className="p-6 space-y-3">
                  <div className="h-6 w-2/3 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-4 w-1/3 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-16 w-full bg-gray-100 rounded-md animate-pulse" />
              </div>
            </div>

              {/* Details skeleton */}
              <div className="space-y-4">
                <div className="h-10 w-40 bg-gray-100 rounded-full animate-pulse" />
                <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
                <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
              </div>
              </div>
          </main>

          <div className="hidden lg:block">
            <RightSidebar />
            </div>
        </div>
      </div>
    );
  }

  if (!delulu) return <div className="p-20 text-center">Delulu not found</div>;

  const canStake = !delulu.isResolved && new Date() < delulu.stakingDeadline && !hasStaked;
  const bannerImage = delulu.bgImageUrl || "/templates/t0.png";

    return (
    <div className="h-screen overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={() => !isConnected ? setShowLoginSheet(true) : router.push("/profile")}
            onCreateClick={() => !isConnected ? setShowLoginSheet(true) : router.push("/board")}
          />
        </div>

        <main className="h-screen lg:border-x border-gray-200 overflow-y-auto scrollbar-hide pb-20">
          {/* Mobile header without tabs (tabs are shown below like desktop) */}
          <div className="lg:hidden">
            <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white border-b border-gray-200">
              <nav className="max-w-lg md:max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-3 flex items-center justify-between">
                {/* Mobile hamburger menu */}
          <button
                  onClick={() => setIsMenuOpen(true)}
                  className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                  aria-label="Open navigation menu"
          >
                  <Menu className="w-6 h-6 text-gray-700" />
          </button>

                {/* Spacer in the middle (no tabs here on mobile) */}
                <div className="flex-1" />

        <button
                  onClick={() => router.push("/search")}
                  className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
                  title="Search"
                  aria-label="Search"
                >
                  <Search className="w-6 h-6" />
        </button>
              </nav>
            </header>

            {/* Mobile drawer with left sidebar content */}
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetContent side="left" className="p-0">
                <div className="h-full">
                  <LeftSidebar
                    onProfileClick={() => {
                      if (!isConnected) {
                        setShowLoginSheet(true);
                      } else {
                        router.push("/profile");
                      }
                      setIsMenuOpen(false);
                    }}
                    onCreateClick={() => {
                      if (!isConnected) {
                        setShowLoginSheet(true);
                      } else {
                        router.push("/board");
                      }
                      setIsMenuOpen(false);
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:flex items-center gap-4 px-6 py-4 border-b border-gray-200 sticky top-0 z-30 bg-white/95 backdrop-blur-sm">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

          <div className="px-4 lg:px-6 py-6 space-y-6 pt-20 lg:pt-6">
            {/* Banner */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="relative h-48 bg-cover bg-center" style={{ backgroundImage: `url(${bannerImage})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                {canStake && (
                  <button
                    onClick={() =>
                      !isConnected ? setShowLoginSheet(true) : setStakingSheetOpen(true)
                    }
                    className="w-fit right-0 bottom-0 absolute px-4 py-3 bg-delulu-yellow-reserved border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black rounded-lg"
                  >
                    Support
                  </button>
                )}
              </div>
              <div className="p-6">
                <h1 className="text-2xl font-black mb-2">
                  {deluluTitle || delulu?.content}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                  <span className="font-bold text-delulu-charcoal">@{delulu.username || formatAddress(delulu.creator)}</span>
                  {marketToken && <TokenBadge tokenAddress={marketToken} size="sm" />}
        </div>

                <div className="flex items-center gap-6 mb-2">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4" />
                    <span className="font-bold text-sm">
                      {supportAmount > 0
                        ? supportAmount < 0.01
                          ? supportAmount.toFixed(4)
                          : supportAmount.toFixed(2)
                        : "0.00"}
                    </span>
                    <span className="text-gray-500 text-sm">
                      Total support
                      {totalSupportUsd && totalSupportUsd > 0 && (
                        <> · ${totalSupportUsd.toFixed(2)}</>
                      )}
                </span>
            </div>
                </div>

                {deluluDescription && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {deluluDescription}
                  </p>
                )}
              </div>
            </div>

            {/* Tabs (same position on desktop and mobile) */}
            <div className="flex border-b border-gray-200 gap-4">
              <button onClick={() => setActiveTab("details")} className={cn("pb-2 font-bold border-b-2 transition-all", activeTab === "details" ? "border-black" : "border-transparent text-gray-400")}>Details</button>

              <button onClick={() => setActiveTab("milestones")} className={cn("pb-2 font-bold border-b-2 transition-all", activeTab === "milestones" ? "border-black" : "border-transparent text-gray-400")}>Milestones</button>
            </div>

            {activeTab === "details" ? (
              <div className="space-y-6">
                {/* Token support section */}
                <div className="p-6 bg-white rounded-2xl border border-gray-200 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-delulu-yellow-reserved/20 border border-delulu-yellow-reserved/60">
                        <Users className="w-4 h-4 text-delulu-charcoal" />
                </span>
                      <h3 className="text-sm md:text-base font-black text-delulu-charcoal">
                        Token support
                      </h3>
                    </div>
                    {marketToken && (
                      <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-gray-500 uppercase">
                        <span>Token</span>
                        <TokenBadge tokenAddress={marketToken} size="sm" />
            </div>
          )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-sm">
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 uppercase">
                        Total support
                      </p>
                      <p className="text-2xl md:text-3xl font-black text-delulu-charcoal flex flex-col gap-1">
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
                          <span className="text-sm font-semibold text-gray-500">
                            ≈ ${totalSupportUsd.toFixed(2)}
                          </span>
                        )}
                      </p>
                  </div>

                    <div className="md:border-l md:border-gray-100 md:pl-6">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase">
                        Supporters
                      </p>
                      <p className="text-lg md:text-2xl font-black text-delulu-charcoal">
                        {supportersCount}
                    </p>
                  </div>

                    <div className="md:border-l md:border-gray-100 md:pl-6">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase">
                        Avg. per supporter
                      </p>
                      <p className="text-lg font-semibold text-delulu-charcoal flex flex-col gap-1">
                        <span>
                          {supportersCount > 0
                            ? supportAmount / supportersCount < 0.01
                              ? (supportAmount / supportersCount).toFixed(4)
                              : (supportAmount / supportersCount).toFixed(2)
                        : "0.00"}
                        </span>
                        {avgSupportUsd && avgSupportUsd > 0 && (
                          <span className="text-xs font-medium text-gray-500">
                            ≈ ${avgSupportUsd.toFixed(2)}
                          </span>
                        )}
                    </p>
                  </div>
              </div>
            </div>

                {leaderboard.length > 0 && (
                  <div className="">
                    <h2 className="text-base font-black mb-4">Top Supporters</h2>
                    <div className="space-y-3">
                      {leaderboard.map((entry) => (
                        <div
                          key={entry.address}
                          className="p-4 bg-white border border-gray-200 rounded-xl flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-delulu-yellow-reserved rounded-full flex items-center justify-center font-black">
                              {entry.rank}
                </div>
                            <div>
                              <p className="font-bold">
                                @{entry.username || formatAddress(entry.address)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {entry.totalStake.toFixed(2)} staked
                </p>
              </div>
            </div>
                          <Trophy
                            className={cn(
                              "w-5 h-5",
                              entry.rank === 1 ? "text-yellow-500" : "text-gray-300"
                            )}
                  />
                </div>
                      ))}
                </div>
              </div>
            )}

                {/* Campaign section */}
                <div className="p-6 bg-white rounded-2xl border border-gray-200 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 border border-purple-300">
                        <Trophy className="w-4 h-4 text-purple-700" />
                      </span>
                      <h3 className="text-sm md:text-base font-black text-delulu-charcoal">
                        Campaign
                      </h3>
                    </div>
                    {delulu.challengeId && (
                      <span className="text-xs md:text-sm font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                        {currentCampaign?.title || `Campaign #${Number(delulu.challengeId)}`}
                      </span>
                  )}
                </div>
                  {!delulu.challengeId ? (
                    <>
                      {isCreator && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <p className="text-sm text-gray-600 flex-1">
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
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>
                        This delulu is participating in{" "}
                        {currentCampaign?.title || `Campaign #${Number(delulu.challengeId)}`}
                      </span>
              </div>
            )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Milestones Card */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base md:text-lg font-black text-delulu-charcoal flex items-center gap-2">
                        <Target className="w-4 h-4 md:w-5 md:h-5" />
                        Milestones
                      </h2>
                      {milestones && milestones.length > 0 && (
                        <span className="text-xs md:text-sm text-gray-500 font-medium">
                          {milestones.filter((m) => m.isVerified).length} of {milestones.length}{" "}
                          completed
                        </span>
                      )}
            </div>

                    {isCreator && (!milestones || milestones.length === 0) && (
                      <button
                        type="button"
                        onClick={() => setShowMilestoneForm((open) => !open)}
                        className=" w-fit  inline-flex items-center justify-center px-3 py-2 text-xs md:text-sm font-semibold rounded-sm border border-gray-300 text-delulu-charcoal hover:bg-gray-100 transition-colors"
                      >
                        {showMilestoneForm ? "Close" : "Create milestones"}
                      </button>
                    )}
          </div>

                  {isCreator && showMilestoneForm && (
                    <div className="mb-4 border border-dashed border-gray-300 rounded-2xl p-3 md:p-4 bg-gray-50/60">
                      <p className="text-xs md:text-sm text-gray-500 mb-3">
                        Add all of your milestones for this delulu now. You can&apos;t edit or add more milestones later, but you can always submit or update proof links for each one.
                      </p>
                      <div className="space-y-3 md:space-y-4">
                        {newMilestones.map((m, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-gray-200 bg-white p-3 md:p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-black text-gray-500 uppercase">
                                Milestone {index + 1}
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

                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Describe this milestone..."
                                  value={m.description}
                                  onChange={(e) =>
                                    handleNewMilestoneChange(
                                      index,
                                      "description",
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-delulu-charcoal focus:border-delulu-charcoal"
                                />
                                <input
                                  type="number"
                                  min={1}
                                  placeholder="1"
                                  value={m.days}
                                  onChange={(e) =>
                                    handleNewMilestoneChange(index, "days", e.target.value)
                                  }
                                  className="w-20 px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-delulu-charcoal focus:border-delulu-charcoal"
                                />
                  </div>
                              <div className="flex items-center gap-2">

                                <span className="text-xs text-gray-600">
                                  days to complete (from now, sequentially after previous
                                  milestones)
                                </span>
                </div>
              </div>
                  </div>
                ))}
              </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
                        <button
                          type="button"
                          onClick={handleAddMilestoneRow}
                          className="inline-flex items-center justify-center px-3 py-2 text-xs md:text-sm font-semibold rounded-md border border-gray-300 text-delulu-charcoal hover:bg-gray-100 transition-colors"
                        >
                          + Add another milestone
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
                              Saving...
                            </>
                          ) : (
                            "Save milestones"
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Milestones list */}
                  {milestones && milestones.length > 0 ? (
                    <>
                      <div className="space-y-3 md:space-y-4">
                        {milestones.map((m, i) => (
                          <div
                            key={m.id}
                            className="p-4 border-2 border-gray-100 rounded-xl flex gap-4"
                          >
                            <div className="pt-1">
                              {m.isVerified ? (
                                <CheckCircle2 className="text-green-500" />
                              ) : (
                                <Circle className="text-gray-300" />
                              )}
                          </div>
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-delulu-charcoal">
                                  Milestone {i + 1}
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    !m.isVerified && isCreator && openProofModal(m.milestoneId, m.proofLink)
                                  }
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                                    m.isVerified
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default"
                                      : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:shadow-sm cursor-pointer"
                                  )}
                                >
                                  {m.isVerified ? "Completed" : "Pending"}
                                </button>
                              </div>
                              <p className="text-xs md:text-sm text-gray-500">
                                {m.deadline.toLocaleDateString()}
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
                                <button
                                  type="button"
                                  onClick={() => openProofModal(m.milestoneId, m.proofLink)}
                                  className="mt-2 inline-flex items-center text-xs md:text-sm font-semibold text-delulu-charcoal hover:underline"
                                >
                                  {m.proofLink ? "Update proof & change status" : "Submit proof to change status"}
                                </button>
                            )}
                          </div>
                        </div>
                        ))}
                      </div>

                      {/* Optional: progress summary could go here */}
                    </>
                  ) : (
                    <div className="rounded-2xl bg-gray-50 p-8 text-center mt-2">
                      <Target className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm md:text-base font-black text-gray-600 mb-1">
                        No milestones yet
                      </p>
                      <p className="text-xs md:text-sm text-gray-400">
                        {isCreator
                          ? "Use the button above to create milestones for this delulu."
                          : "Milestones will appear here once the creator adds them."}
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
      
      <ConnectorSelectionSheet open={showLoginSheet} onOpenChange={setShowLoginSheet} />
      {isCreator && activeProofMilestoneId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base md:text-lg font-black text-delulu-charcoal mb-2">
              Submit proof
            </h3>
            <p className="text-xs md:text-sm text-gray-500 mb-4">
              Add a link that proves this milestone has been completed. Once submitted, the status can be updated by the protocol/admins.
            </p>
            <input
              type="url"
              placeholder="https://example.com/proof"
              value={milestoneProofLinks[activeProofMilestoneId] ?? ""}
              onChange={(e) =>
                setMilestoneProofLinks((prev) => ({
                  ...prev,
                  [activeProofMilestoneId]: e.target.value,
                }))
              }
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-delulu-charcoal focus:border-delulu-charcoal"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveProofMilestoneId(null)}
                className="px-3 py-2 text-xs md:text-sm font-semibold rounded-md border border-gray-300 text-delulu-charcoal hover:bg-gray-100 transition-colors"
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
                {isSubmittingMilestone || isConfirmingSubmitMilestone ? "Submitting..." : "Submit proof"}
              </button>
            </div>
          </div>
        </div>
      )}
      <FeedbackModal isOpen={showSuccessModal} type="success" title="Stake Success!" message="Your conviction has been recorded." onClose={() => setShowSuccessModal(false)} />
      <FeedbackModal isOpen={showErrorModal} type="error" title={errorTitle} message={errorMessage} onClose={() => setShowErrorModal(false)} />

      {/* Join campaign modal */}
      {isCreator && joinModalOpen && !delulu.challengeId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-gray-200">
            <h3 className="text-base md:text-lg font-black text-delulu-charcoal mb-2">
              Join a campaign
            </h3>
            <p className="text-xs md:text-sm text-gray-500 mb-4">
              Select an active campaign to join with this delulu. Once joined, it can earn
              points and appear on the campaign leaderboard.
            </p>

            <div className="mb-4">
              {challenges.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No active campaigns available to join right now.
                </p>
              ) : (
                <select
                  className="w-full px-3 py-2 h-[46px] text-sm rounded-sm border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-delulu-charcoal focus:border-delulu-charcoal"
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
                className="px-3 py-2 text-xs md:text-sm font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
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
    </div>
  );
}