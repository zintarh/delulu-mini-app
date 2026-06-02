"use client";

import { useEffect, useMemo } from "react";
import { ApolloProvider as BaseApolloProvider } from "@apollo/client/react";
import { useAccount } from "wagmi";
import { createChainAwareApolloClient } from "@/lib/apollo-client";
import { CELO_MAINNET_ID } from "@/lib/constant";

const CACHE_MAX_AGE_MS = 3 * 60 * 1000;

function restoreApolloCacheFromStorage(
  client: ReturnType<typeof createChainAwareApolloClient>,
  chainId: number,
): void {
  if (typeof window === "undefined") return;
  const cacheKey = `delulu_apollo_cache_v1_${chainId}`;
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown> & {
      __savedAt?: number;
    };
    const age = Date.now() - (parsed.__savedAt ?? 0);
    if (age >= CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(cacheKey);
      return;
    }
    const { __savedAt: _, ...cacheData } = parsed;
    client.cache.restore(cacheData);
  } catch {
    // Ignore invalid cache payloads.
  }
}

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  const { chainId } = useAccount();
  const effectiveChainId = chainId ?? CELO_MAINNET_ID;

  const client = useMemo(() => {
    const apolloClient = createChainAwareApolloClient(effectiveChainId);
    restoreApolloCacheFromStorage(apolloClient, effectiveChainId);
    return apolloClient;
  }, [effectiveChainId]);

  useEffect(() => {
    let writeTimer: ReturnType<typeof setTimeout> | null = null;
    const cacheKey = `delulu_apollo_cache_v1_${effectiveChainId}`;

    const persistSnapshot = () => {
      if (typeof window === "undefined") return;
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        try {
          const snapshot = client.extract() as Record<string, unknown>;
          window.localStorage.setItem(
            cacheKey,
            JSON.stringify({ ...snapshot, __savedAt: Date.now() }),
          );
        } catch {
          // quota / private mode
        }
      }, 200);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistSnapshot();
      } else {
        client.refetchQueries({ include: "active" });
      }
    };
    const onOnline = () => {
      client.refetchQueries({ include: "active" });
    };
    const onBeforeUnload = () => persistSnapshot();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      if (writeTimer) clearTimeout(writeTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [client, effectiveChainId]);

  return <BaseApolloProvider client={client}>{children}</BaseApolloProvider>;
}
