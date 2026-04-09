"use client";

import { useEffect, useState } from "react";

const pfpCache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

async function fetchProfilePfp(address: string): Promise<string | null> {
  const normalized = address.toLowerCase();
  const cached = pfpCache.get(normalized);
  if (cached !== undefined) return cached;

  const pending = inFlight.get(normalized);
  if (pending) return pending;

  const request = (async () => {
    try {
      const res = await fetch(`/api/profile/${normalized}`);
      if (!res.ok) return null;
      const payload = await res.json();
      const pfpUrl =
        typeof payload?.profile?.pfp_url === "string"
          ? payload.profile.pfp_url
          : null;
      pfpCache.set(normalized, pfpUrl);
      return pfpUrl;
    } catch {
      pfpCache.set(normalized, null);
      return null;
    } finally {
      inFlight.delete(normalized);
    }
  })();

  inFlight.set(normalized, request);
  return request;
}

export function useProfilePfp(address?: string | null) {
  const [pfpUrl, setPfpUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setPfpUrl(null);
      return;
    }

    let cancelled = false;
    fetchProfilePfp(address).then((url) => {
      if (!cancelled) setPfpUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return pfpUrl;
}

