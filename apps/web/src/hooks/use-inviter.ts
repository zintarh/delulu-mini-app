"use client";

import { useEffect, useState } from "react";

type Inviter = { username: string | null; pfpUrl: string | null };

const NONE: Inviter = { username: null, pfpUrl: null };

/**
 * Who sent this invite (/sign-in?ref=CODE), for the "invited by" line.
 * Never blocks sign-up: until it loads, or if it fails, there's just no name.
 */
export function useInviter(code: string | null): Inviter {
  const [inviter, setInviter] = useState<Inviter>(NONE);

  useEffect(() => {
    if (!code) {
      setInviter(NONE);
      return;
    }
    let cancelled = false;
    fetch(`/api/referral/referrer?code=${encodeURIComponent(code)}`)
      .then((res) => res.json() as Promise<{ found?: boolean; username?: string | null; pfpUrl?: string | null }>)
      .then((json) => {
        if (cancelled) return;
        setInviter(json.found ? { username: json.username ?? null, pfpUrl: json.pfpUrl ?? null } : NONE);
      })
      .catch(() => {
        if (!cancelled) setInviter(NONE);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return inviter;
}
