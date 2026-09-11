"use client";

import { useEffect, useState } from "react";

/** Fetches (and lazily self-heals) a profile's referral_code. */
export function useReferralCode(address?: string | null) {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(address));

  useEffect(() => {
    if (!address) {
      setReferralCode(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/profile/${address}`);
        const json = (await res.json()) as { profile?: { referral_code?: string | null } };
        if (!cancelled) setReferralCode(json.profile?.referral_code ?? null);
      } catch {
        if (!cancelled) setReferralCode(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return { referralCode, isLoading };
}
