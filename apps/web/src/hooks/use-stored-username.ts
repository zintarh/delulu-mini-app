"use client";

import { useEffect, useState } from "react";

/** The username stored in the database, or null when the row has none. Undefined while loading. */
export function useStoredUsername(address: string | undefined): string | null | undefined {
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!address) {
      setUsername(undefined);
      return;
    }
    let cancelled = false;
    setUsername(undefined);
    fetch(`/api/onboarding?address=${address.toLowerCase()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { username?: unknown } | null) => {
        if (cancelled) return;
        setUsername(typeof json?.username === "string" ? json.username : null);
      })
      .catch(() => {
        if (!cancelled) setUsername(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return username;
}
