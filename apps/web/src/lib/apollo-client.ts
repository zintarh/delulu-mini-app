import { ApolloClient, InMemoryCache, HttpLink, from } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { getSubgraphUrlForChain } from "./constant";

function createApolloClient(subgraphUrl: string) {
  // Error link to handle and suppress expected errors
  const errorLink = onError((error) => {
    const { graphQLErrors, networkError } = error as any;
    // Suppress AbortError - these are expected when components unmount or requests are cancelled
    if (networkError && networkError.name === 'AbortError') {
      // Silently ignore - this is expected behavior
      return;
    }

    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path }: any) => {
        console.error(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
        );
      });
    }

    if (networkError) {
      console.error(`[Network error]: ${networkError}`);
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
              keyArgs: false, // Don't cache by args - always fetch fresh
              merge(existing: any[] = [], incoming: any[]) {
                // Always return incoming data, ignore cache
                return incoming;
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
        nextFetchPolicy: "cache-first",
      },
      query: {
        fetchPolicy: "cache-first",
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
