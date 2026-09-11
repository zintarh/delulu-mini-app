"use client";

import { useEffect, useState } from "react";

/** Fetches (and lazily self-heals) a profile's referral_code, plus how many referrals they've counted so far. */
export function useReferralCode(address?: string | null) {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [isLoading, setIsLoading] = useState(Boolean(address));

  useEffect(() => {
    if (!address) {
      setReferralCode(null);
      setReferralCount(0);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/profile/${address}`);
        const json = (await res.json()) as {
          profile?: { referral_code?: string | null };
          referralCount?: number;
        };
        if (!cancelled) {
          setReferralCode(json.profile?.referral_code ?? null);
          setReferralCount(json.referralCount ?? 0);
        }
      } catch {
        if (!cancelled) {
          setReferralCode(null);
          setReferralCount(0);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return { referralCode, referralCount, isLoading };
}
