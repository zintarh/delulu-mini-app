"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAllDelulus } from "@/hooks/graph/useAllDelulus";
import { useApolloClient } from "@apollo/client/react";
import { refetchDeluluData } from "@/lib/graph/refetch-utils";
import { Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
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
          <main className="h-screen lg:border-x border-gray-200 overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-delulu-charcoal" />
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
          <main className="h-screen lg:border-x border-gray-200 overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-delulu-charcoal" />
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

        <main className="h-screen lg:border-x border-gray-200 overflow-y-auto scrollbar-hide">
          <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-delulu-charcoal tracking-tight">
                  Markets
                </h1>
                <p className="text-sm text-delulu-charcoal/70 font-medium mt-1">
                  Manage and resolve all delulus
                </p>
              </div>
              <button
                onClick={() => setShowCreateChallengeSheet(true)}
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-md border-2 border-delulu-charcoal bg-delulu-yellow-reserved text-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_0px_#1A1A1A] active:scale-[0.98] transition-all text-sm font-bold"
                )}
              >
                <Trophy className="w-4 h-4" />
                Create Challenge
              </button>
            </div>

            {isLoadingDelulus ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-delulu-charcoal" />
              </div>
            ) : endedMarkets.length === 0 ? (
              <div className="bg-white rounded-xl border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A] p-12 text-center">
                <p className="text-delulu-charcoal/60 font-medium">No ended markets found</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b-2 border-delulu-charcoal">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-black text-delulu-charcoal uppercase tracking-wider">
                          ID
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-black text-delulu-charcoal uppercase tracking-wider">
                          Creator
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-black text-delulu-charcoal uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-black text-delulu-charcoal uppercase tracking-wider">
                          TVL
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-black text-delulu-charcoal uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y-2 divide-gray-200">
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
    // Show error state if there's an error
    if (stateError) {
      console.error("[MarketRow] Error fetching state:", stateError, { deluluId: deluluIdForContract, delulu });
      // Fallback to local state if contract query fails
      if (delulu.isResolved) {
        return { label: "Resolved", className: "bg-green-100 text-green-800 border-green-800" };
      }
      if (delulu.isCancelled) {
        return { label: "Cancelled", className: "bg-red-100 text-red-800 border-red-800" };
      }
      return { label: "Active", className: "bg-blue-100 text-blue-800 border-blue-800" };
    }
    
    if (isLoadingState) {
      return { label: "Loading...", className: "bg-gray-100 text-gray-800 border-gray-800" };
    }
    
    // State can be 0 (Open), so we need to check for null/undefined specifically
    if (state === null || state === undefined) {
      // Fallback to local state if contract returns null
      if (delulu.isResolved) {
        return { label: "Resolved", className: "bg-green-100 text-green-800 border-green-800" };
      }
      if (delulu.isCancelled) {
        return { label: "Cancelled", className: "bg-red-100 text-red-800 border-red-800" };
      }
      return { label: "Active", className: "bg-blue-100 text-blue-800 border-blue-800" };
    }
    
    switch (state) {
      case DeluluState.Open:
        return { label: "Open", className: "bg-blue-100 text-blue-800 border-blue-800" };
      case DeluluState.Locked:
        return { label: "Locked", className: "bg-yellow-100 text-yellow-800 border-yellow-800" };
      case DeluluState.Review:
        return { label: "Review", className: "bg-purple-100 text-purple-800 border-purple-800" };
      case DeluluState.Resolved:
        return { label: "Resolved", className: "bg-green-100 text-green-800 border-green-800" };
      case DeluluState.Cancelled:
        return { label: "Cancelled", className: "bg-red-100 text-red-800 border-red-800" };
      default:
        return { label: "Unknown", className: "bg-gray-100 text-gray-800 border-gray-800" };
    }
  };

  const stateDisplay = getStateDisplay(contractState);

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm font-black text-delulu-charcoal">
          {index + 1}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm font-bold text-delulu-charcoal">
          {displayCreator}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={cn(
            "inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold border-2 shadow-[2px_2px_0px_0px_#1A1A1A]",
            stateDisplay.className
          )}
        >
          {stateDisplay.label}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-delulu-charcoal">
            {delulu.totalStake ? `${delulu.totalStake.toFixed(2)}` : "0.00"}
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border-2 border-delulu-charcoal bg-white shadow-[2px_2px_0px_0px_#1A1A1A] hover:shadow-[3px_3px_0px_0px_#1A1A1A] active:scale-[0.98] transition-all text-xs font-bold text-delulu-charcoal"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View
          </Link>
          {canResolve ? (
            <button
              onClick={onResolve}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border-2 border-delulu-charcoal bg-delulu-yellow-reserved text-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A] hover:shadow-[3px_3px_0px_0px_#1A1A1A] active:scale-[0.98] transition-all text-xs font-bold"
              )}
            >
              Resolve
            </button>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
      </td>
    </tr>
  );
}
