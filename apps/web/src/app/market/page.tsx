"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAllDelulus } from "@/hooks/graph/useAllDelulus";
import { useApolloClient } from "@apollo/client/react";
import { refetchDeluluData } from "@/lib/graph/refetch-utils";
import { Loader2, ExternalLink } from "lucide-react";
import { cn, formatGAmount } from "@/lib/utils";
import { TokenBadge } from "@/components/token-badge";
import { ResolveDeluluModal } from "@/components/resolve-delulu-modal";
import { CreateChallengeSheet } from "@/components/create-challenge-sheet";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { useDeluluState, DeluluState } from "@/hooks/use-delulu-state";
import type { FormattedDelulu } from "@/lib/types";
import { Trophy } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin();
  const { delulus, isLoading: isLoadingDelulus, refetch } = useAllDelulus();
  const apolloClient = useApolloClient();
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [selectedDelulu, setSelectedDelulu] = useState<FormattedDelulu | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showCreateChallengeSheet, setShowCreateChallengeSheet] = useState(false);

  const handleProfileClick = () => {
    if (!isConnected) setShowLoginSheet(true);
    else router.push("/profile");
  };
  const handleCreateClick = () => {
    if (!isConnected) setShowLoginSheet(true);
    else router.push("/board");
  };

  useEffect(() => {
    if (!isLoadingAdmin && (!isConnected || !isAdmin)) {
      router.push("/");
    }
  }, [isLoadingAdmin, isConnected, isAdmin, router]);

  const handleOpenResolveModal = (delulu: FormattedDelulu) => {
    setSelectedDelulu(delulu);
    setShowResolveModal(true);
  };

  const handleResolveSuccess = async () => {
    if (selectedDelulu) {
      await refetch();
      await refetchDeluluData(apolloClient, selectedDelulu.id);
    }
  };

  // Memoize the filter to prevent recalculation on every render
  const endedMarkets = useMemo(() => {
    return delulus.filter((delulu) => {
      if (!delulu.stakingDeadline) return false;
      const now = new Date();
      return delulu.stakingDeadline <= now;
    });
  }, [delulus]);

  if (isLoadingAdmin) {
    return (
      <div className="h-screen overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
          <div className="hidden lg:block">
            <LeftSidebar
              onProfileClick={() => {
                if (!isConnected) {
                  setShowLoginSheet(true);
                } else {
                  router.push("/profile");
                }
              }}
              onCreateClick={() => {
                if (!isConnected) {
                  setShowLoginSheet(true);
                } else {
                  router.push("/board");
                }
              }}
            />
          </div>
          <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background">
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-foreground" />
            </div>
          </main>
          <div className="hidden lg:block">
            <RightSidebar />
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected || !isAdmin) {
    return (
      <div className="h-screen overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
          <div className="hidden lg:block">
            <LeftSidebar
              onProfileClick={() => {
                if (!isConnected) {
                  setShowLoginSheet(true);
                } else {
                  router.push("/profile");
                }
              }}
              onCreateClick={() => {
                if (!isConnected) {
                  setShowLoginSheet(true);
                } else {
                  router.push("/board");
                }
              }}
            />
          </div>
          <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background">
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-foreground" />
            </div>
          </main>
          <div className="hidden lg:block">
            <RightSidebar />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={handleProfileClick}
            onCreateClick={handleCreateClick}
          />
        </div>

        <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background">
          <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10 pb-24 lg:pb-10">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                  Markets
                </h1>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  Manage and resolve all delulus
                </p>
              </div>
              <button
                onClick={() => setShowCreateChallengeSheet(true)}
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-md border-2 border-border bg-delulu-yellow-reserved text-foreground shadow-neo hover:shadow-neo active:scale-[0.98] transition-all text-sm font-bold"
                )}
              >
                <Trophy className="w-4 h-4" />
                Create Challenge
              </button>
            </div>

            {isLoadingDelulus ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-foreground" />
              </div>
            ) : endedMarkets.length === 0 ? (
              <div className="bg-card rounded-xl border-2 border-border shadow-neo p-12 text-center">
                <p className="text-muted-foreground font-medium">No ended markets found</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border-2 border-border shadow-neo overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted border-b-2 border-border">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-black text-foreground uppercase tracking-wider">
                          ID
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-black text-foreground uppercase tracking-wider">
                          Creator
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-black text-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-black text-foreground uppercase tracking-wider">
                          TVL
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-black text-foreground uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y-2 divide-border">
                      {endedMarkets.map((delulu, index) => {
                        const canResolve = !delulu.isResolved && !delulu.isCancelled;
                        
                        return (
                          <MarketRow
                            key={delulu.id}
                            delulu={delulu}
                            index={index}
                            canResolve={canResolve}
                            onResolve={() => handleOpenResolveModal(delulu)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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

      <ConnectorSelectionSheet
        open={showLoginSheet}
        onOpenChange={setShowLoginSheet}
      />

      <ResolveDeluluModal
        open={showResolveModal}
        onOpenChange={(open) => {
          setShowResolveModal(open);
          if (!open) {
            setSelectedDelulu(null);
          }
        }}
        delulu={selectedDelulu}
        onSuccess={handleResolveSuccess}
      />

      <CreateChallengeSheet
        open={showCreateChallengeSheet}
        onOpenChange={setShowCreateChallengeSheet}
      />
    </div>
  );
}

// Market Row Component
interface MarketRowProps {
  delulu: FormattedDelulu;
  index: number;
  canResolve: boolean;
  onResolve: () => void;
}

function MarketRow({ delulu, index, canResolve, onResolve }: MarketRowProps) {
  const { username: creatorUsername } = useUsernameByAddress(
    delulu.creator as `0x${string}` | undefined
  );
  
  // Get state from contract - use onChainId if available, otherwise use id
  // The contract expects the onChainId (the actual delulu ID on-chain)
  const deluluIdForContract = (() => {
    if (delulu.onChainId) {
      const parsed = parseInt(delulu.onChainId, 10);
      return !isNaN(parsed) && parsed > 0 ? parsed : null;
    }
    // id should be the parsed onChainId from the transformer
    return delulu.id > 0 ? delulu.id : null;
  })();
  
  const { state: contractState, isLoading: isLoadingState, error: stateError } = useDeluluState(
    deluluIdForContract
  );

  const displayCreator = creatorUsername 
    ? `@${creatorUsername}` 
    : delulu.creator 
    ? `${delulu.creator.slice(0, 6)}...${delulu.creator.slice(-4)}`
    : "—";

  // Map contract state to display
  const getStateDisplay = (state: number | null): { label: string; className: string } => {
    const resolved =
      "bg-green-100 text-green-800 border-green-600 dark:bg-green-900/50 dark:text-green-200 dark:border-green-500";
    const cancelled =
      "bg-red-100 text-red-800 border-red-600 dark:bg-red-900/50 dark:text-red-200 dark:border-red-500";
    const active =
      "bg-blue-100 text-blue-800 border-blue-600 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-500";
    const loading =
      "bg-muted text-muted-foreground border-border";
    const open =
      "bg-blue-100 text-blue-800 border-blue-600 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-500";
    const locked =
      "bg-yellow-100 text-yellow-800 border-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-500";
    const review =
      "bg-purple-100 text-purple-800 border-purple-600 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-500";
    const unknown =
      "bg-muted text-muted-foreground border-border";

    if (stateError) {
      console.error("[MarketRow] Error fetching state:", stateError, { deluluId: deluluIdForContract, delulu });
      if (delulu.isResolved) return { label: "Resolved", className: resolved };
      if (delulu.isCancelled) return { label: "Cancelled", className: cancelled };
      return { label: "Active", className: active };
    }
    if (isLoadingState) return { label: "Loading...", className: loading };
    if (state === null || state === undefined) {
      if (delulu.isResolved) return { label: "Resolved", className: resolved };
      if (delulu.isCancelled) return { label: "Cancelled", className: cancelled };
      return { label: "Active", className: active };
    }
    switch (state) {
      case DeluluState.Open:
        return { label: "Open", className: open };
      case DeluluState.Locked:
        return { label: "Locked", className: locked };
      case DeluluState.Review:
        return { label: "Review", className: review };
      case DeluluState.Resolved:
        return { label: "Resolved", className: resolved };
      case DeluluState.Cancelled:
        return { label: "Cancelled", className: cancelled };
      default:
        return { label: "Unknown", className: unknown };
    }
  };

  const stateDisplay = getStateDisplay(contractState);

  return (
    <tr className="hover:bg-muted/50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm font-black text-foreground">
          {index + 1}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm font-bold text-foreground">
          {displayCreator}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={cn(
            "inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold border-2 shadow-neo-sm",
            stateDisplay.className
          )}
        >
          {stateDisplay.label}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-foreground">
            {formatGAmount(delulu.totalStake ?? 0)}
          </span>
          {delulu.tokenAddress && (
            <TokenBadge tokenAddress={delulu.tokenAddress} size="sm" showText={false} />
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Link
            href={`/delulu/${delulu.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border-2 border-border bg-card text-foreground shadow-neo-sm hover:shadow-neo-sm active:scale-[0.98] transition-all text-xs font-bold"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View
          </Link>
          {canResolve ? (
            <button
              onClick={onResolve}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border-2 border-border bg-delulu-yellow-reserved text-foreground shadow-neo-sm hover:shadow-neo-sm active:scale-[0.98] transition-all text-xs font-bold"
              )}
            >
              Resolve
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </td>
    </tr>
  );
}
