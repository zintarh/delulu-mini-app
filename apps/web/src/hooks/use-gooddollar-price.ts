"use client";

import { useEffect, useState } from "react";

interface PriceState {
  usd: number | null;
  isLoading: boolean;
  error: string | null;
}

export function useGoodDollarPrice(): PriceState {
  const [usd, setUsd] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchPrice() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/prices/gooddollar", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as { usd?: number };
        if (isMounted) {
          setUsd(
            typeof json.usd === "number" && Number.isFinite(json.usd)
              ? json.usd
              : null
          );
        }
      } catch (e) {
        if (isMounted) {
          setError(
            e instanceof Error ? e.message : "Failed to load G$ price"
          );
        }
      } finally {
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

