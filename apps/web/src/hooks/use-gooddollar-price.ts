"use client";

import { useEffect, useState } from "react";

interface PriceState {
  usd: number | null;
  isLoading: boolean;
  error: string | null;
}

const PRICE_TTL_MS = 60 * 1000;
let cachedUsd: number | null = null;
let cachedAt = 0;
let inFlight:
  | Promise<{ usd: number | null; error: string | null }>
  | null = null;

async function fetchGoodDollarPriceShared(): Promise<{
  usd: number | null;
  error: string | null;
}> {
  const now = Date.now();
  if (cachedAt > 0 && now - cachedAt < PRICE_TTL_MS) {
    return { usd: cachedUsd, error: null };
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/prices/gooddollar", {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as { usd?: number };
      const usd =
        typeof json.usd === "number" && Number.isFinite(json.usd)
          ? json.usd
          : null;
      cachedUsd = usd;
      cachedAt = Date.now();
      return { usd, error: null };
    } catch (e) {
      return {
        usd: cachedUsd,
        error: e instanceof Error ? e.message : "Failed to load G$ price",
      };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function useGoodDollarPrice(): PriceState {
  const [usd, setUsd] = useState<number | null>(cachedUsd);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchPrice() {
      setIsLoading(true);
      setError(null);
      const result = await fetchGoodDollarPriceShared();
      if (isMounted) {
        setUsd(result.usd);
        setError(result.error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchPrice();

    return () => {
      isMounted = false;
    };
  }, []);

  return { usd, isLoading, error };
}

