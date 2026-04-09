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
    // Cache snapshots older than 3 minutes are discarded on restore.
    const CACHE_MAX_AGE_MS = 3 * 60 * 1000;

    const setupPersistence = async () => {
      // Restore persisted cache snapshot before queries fire,
      // but only if it's recent enough (within CACHE_MAX_AGE_MS).
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            const age = Date.now() - (parsed.__savedAt ?? 0);
            if (age < CACHE_MAX_AGE_MS) {
              const { __savedAt: _, ...cacheData } = parsed;
              client.cache.restore(cacheData);
            } else {
              // Snapshot is stale — drop it so we start fresh.
              window.localStorage.removeItem(cacheKey);
            }
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
            const snapshot = client.extract() as Record<string, unknown>;
            window.localStorage.setItem(
              cacheKey,
              JSON.stringify({ ...snapshot, __savedAt: Date.now() })
            );
          } catch {
            // Ignore persistence errors (quota/private mode).
          }
        }, 200);
      };

      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          persistSnapshot();
        } else {
          // App came back to foreground — refetch all active queries so
          // PWA users see fresh data instead of a stale in-memory cache.
          client.refetchQueries({ include: "active" });
        }
      };
      // Network came back (airplane mode off, flaky signal recovered).
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
