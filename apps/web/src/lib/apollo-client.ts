import { ApolloClient, InMemoryCache, HttpLink, from } from "@apollo/client";
import { ErrorLink } from "@apollo/client/link/error";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { getSubgraphUrlForChain } from "./constant";

function createApolloClient(subgraphUrl: string) {
  const errorLink = new ErrorLink(({ error }) => {
    if (error.name === "AbortError") return;

    if (CombinedGraphQLErrors.is(error)) {
      error.errors.forEach(({ message, locations, path }) => {
        console.error(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
        );
      });
    } else {
      console.error(`[Network error]: ${error}`);
    }
  });

  const httpLink = new HttpLink({
    uri: subgraphUrl,
  });

  // Debug: Log all GraphQL requests in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Apollo Client] Initialized with subgraph URL:', subgraphUrl);
  }

  const link = from([errorLink, httpLink]);

  return new ApolloClient({
    link: link,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            delulus: {
              // Important: differentiate by arguments so filtered queries
              // (e.g. campaign leaderboards) don't get overwritten by
              // unfiltered queries elsewhere in the app.
              keyArgs: ["where", "orderBy", "orderDirection"],
              merge(existing: any[] = [], incoming: any[], { args }) {
                // For non-paginated queries (no skip or skip === 0),
                // always replace with the latest incoming data.
                if (!args?.skip || args.skip === 0) {
                  return incoming;
                }

                // For paginated lists that use skip, append new items
                // while avoiding duplicates.
                const existingRefs = new Set(
                  existing.map((ref: any) => ref.__ref || JSON.stringify(ref))
                );
                const newItems = incoming.filter(
                  (ref: any) =>
                    !existingRefs.has(ref.__ref || JSON.stringify(ref))
                );
                return [...existing, ...newItems];
              },
            },
            stakes: {
              keyArgs: ["where", "orderBy", "orderDirection"],
              merge(existing: any[] = [], incoming: any[], { args }) {
                if (!args?.skip || args.skip === 0) {
                  return incoming;
                }
                const existingRefs = new Set(
                  existing.map((ref: any) => ref.__ref || JSON.stringify(ref))
                );
                const newItems = incoming.filter(
                  (ref: any) =>
                    !existingRefs.has(ref.__ref || JSON.stringify(ref))
                );
                return [...existing, ...newItems];
              },
            },
            claims: {
              keyArgs: ["where", "orderBy", "orderDirection"],
              merge(existing: any[] = [], incoming: any[], { args }) {
                if (!args?.skip || args.skip === 0) {
                  return incoming;
                }
                const existingRefs = new Set(
                  existing.map((ref: any) => ref.__ref || JSON.stringify(ref))
                );
                const newItems = incoming.filter(
                  (ref: any) =>
                    !existingRefs.has(ref.__ref || JSON.stringify(ref))
                );
                return [...existing, ...newItems];
              },
            },
            creatorStats: {
              keyArgs: ["orderBy", "orderDirection"],
              merge(existing: any[] = [], incoming: any[], { args }) {
                if (!args?.skip || args.skip === 0) {
                  return incoming;
                }
                const existingRefs = new Set(
                  existing.map((ref: any) => ref.__ref || JSON.stringify(ref))
                );
                const newItems = incoming.filter(
                  (ref: any) =>
                    !existingRefs.has(ref.__ref || JSON.stringify(ref))
                );
                return [...existing, ...newItems];
              },
            },
          },
        },
        Delulu: { keyFields: ["id"] },
        User: { keyFields: ["id"] },
        Stake: { keyFields: ["id"] },
        Claim: { keyFields: ["id"] },
      },
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-and-network",
        nextFetchPolicy: "cache-and-network",
      },
      query: {
        fetchPolicy: "network-only",
      },
    },
  });
}

/** Create Apollo client for the given chain ID (used by chain-aware provider) */
export function createChainAwareApolloClient(chainId?: number) {
  const url = getSubgraphUrlForChain(chainId);


  if (!url) {
    throw new Error(
      `Subgraph URL not configured for chainId ${chainId}. Add NEXT_PUBLIC_SUBGRAPH_URL_MAINNET (for mainnet) or NEXT_PUBLIC_SUBGRAPH_URL_SEPOLIA (for sepolia) to .env.local`
    );
  }
  return createApolloClient(url);
}

/** Legacy: single-URL client (for backwards compatibility, uses default) */
export const apolloClient = createApolloClient(
  getSubgraphUrlForChain() || process.env.NEXT_PUBLIC_SUBGRAPH_URL || ""
);
