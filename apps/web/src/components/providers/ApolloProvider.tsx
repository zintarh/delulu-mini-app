"use client";

import { useMemo } from "react";
import { ApolloProvider as BaseApolloProvider } from "@apollo/client/react";
import { useAccount } from "wagmi";
import { createChainAwareApolloClient } from "@/lib/apollo-client";

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  const {chainId} = useAccount();
  const client = useMemo(() => {
    const apolloClient = createChainAwareApolloClient(chainId);
    // Debug: Log subgraph URL being used
    if (process.env.NODE_ENV === 'development') {
      console.log('[ApolloProvider] Using chainId:', chainId);
    }
    return apolloClient;
  }, [chainId]);

  return <BaseApolloProvider client={client}>{children}</BaseApolloProvider>;
}
