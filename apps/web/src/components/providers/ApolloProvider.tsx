"use client";

import { useEffect, useMemo, useState } from "react";
import { ApolloProvider as BaseApolloProvider } from "@apollo/client/react";
import { useAccount } from "wagmi";
import { createChainAwareApolloClient } from "@/lib/apollo-client";

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  const { chainId } = useAccount();
  const [isReady, setIsReady] = useState(false);

  const client = useMemo(() => {
    const apolloClient = createChainAwareApolloClient(chainId);
    return apolloClient;
  }, [chainId]);

  useEffect(() => {
    let cancelled = false;
    let writeTimer: ReturnType<typeof setTimeout> | null = null;

    const cacheKey = `delulu_apollo_cache_v1_${chainId ?? "mainnet"}`;

    const setupPersistence = async () => {
      // Restore persisted cache snapshot before queries fire.
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            client.cache.restore(parsed);
          }
        } catch {
          // Ignore invalid cache payloads and continue with fresh cache.
        }
      }

      if (cancelled) return;
      setIsReady(true);

      const persistSnapshot = () => {
        if (typeof window === "undefined") return;
        if (writeTimer) clearTimeout(writeTimer);
        writeTimer = setTimeout(() => {
          try {
            const snapshot = client.extract();
            window.localStorage.setItem(cacheKey, JSON.stringify(snapshot));
          } catch {
            // Ignore persistence errors (quota/private mode).
          }
        }, 200);
      };

      const intervalId = setInterval(persistSnapshot, 2000);
      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") persistSnapshot();
      };
      const onBeforeUnload = () => persistSnapshot();
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("beforeunload", onBeforeUnload);

      return () => {
        if (writeTimer) clearTimeout(writeTimer);
        clearInterval(intervalId);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("beforeunload", onBeforeUnload);
      };
    };

    let cleanup: (() => void) | undefined;
    setupPersistence().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cancelled = true;
      if (writeTimer) clearTimeout(writeTimer);
      cleanup?.();
    };
  }, [client, chainId]);

  if (!isReady) return null;

  return <BaseApolloProvider client={client}>{children}</BaseApolloProvider>;
}
