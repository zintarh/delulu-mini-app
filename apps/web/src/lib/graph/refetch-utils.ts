

import { 
  GetDeluluByIdDocument, 
  GetDelulusDocument,
  GetUserClaimForDeluluDocument,
  GetClaimsByUserDocument,
} from "@/generated/graphql";
import type { apolloClient } from "@/lib/apollo-client";
import type { QueryClient } from "@tanstack/react-query";

type ApolloClientType = typeof apolloClient;


export function refetchDeluluData(
  apolloClient: ApolloClientType,
  deluluId?: string | number | null,
  delay: number = 3000
) {
  setTimeout(() => {
    if (deluluId !== null && deluluId !== undefined) {
      const subgraphId = String(deluluId);
      apolloClient.cache.evict({ id: `Delulu:${subgraphId}` });
      apolloClient.cache.gc();
    }

    apolloClient.refetchQueries({
      include: [GetDeluluByIdDocument],
    });

    apolloClient.refetchQueries({
      include: [GetDelulusDocument],
    });
  }, delay);
}

/**
 * Refetch all Graph queries and contract reads related to claims after claiming winnings.
 * 
 * This should be called after:
 * - Claiming winnings
 * 
 * @param apolloClient - The Apollo Client instance
 * @param queryClient - The TanStack Query client (for invalidating contract reads)
 * @param deluluId - The delulu's onChainId or subgraph ID
 * @param delay - Delay in milliseconds before refetching (default: 3000ms for indexing)
 */
export function refetchAfterClaim(
  apolloClient: ApolloClientType,
  queryClient: QueryClient,
  deluluId: string | number | null,
  delay: number = 3000
) {
  setTimeout(() => {
    if (deluluId !== null && deluluId !== undefined) {
      const subgraphId = String(deluluId);
      apolloClient.cache.evict({ id: `Delulu:${subgraphId}` });
      apolloClient.cache.gc();
    }

    apolloClient.refetchQueries({
      include: [
        GetDeluluByIdDocument,
        GetDelulusDocument,
        GetUserClaimForDeluluDocument,
        GetClaimsByUserDocument,
      ],
    });

    // Invalidate wagmi contract reads (getUserPosition, getClaimableAmount)
    // These will auto-refetch when components re-render
    queryClient.invalidateQueries();
  }, delay);
}

/**
 * Refetch all active Graph queries (simpler version for actions that affect multiple delulus).
 * 
 * Use this for actions that might affect multiple delulus or user stats:
 * - Creating a new delulu (affects home feed, profile page)
 * - Any action that updates user stats
 * 
 * @param apolloClient - The Apollo Client instance
 * @param delay - Delay in milliseconds before refetching (default: 3000ms for indexing)
 */
export function refetchAllActiveQueries(
  apolloClient: ApolloClientType,
  delay: number = 3000
) {
  setTimeout(() => {
    apolloClient.refetchQueries({ include: "active" });
  }, delay);
}
