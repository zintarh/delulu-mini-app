"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DELULU_SOCIAL_UPDATED_EVENT } from "@/lib/delulu-social-storage";

export function useDeluluSocialStats(
  deluluId: number,
  userKey?: string | null,
) {
  const [stats, setStats] = useState({ likes: 0, comments: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const params = userKey
        ? `?userAddress=${encodeURIComponent(userKey)}`
        : "";
      const res = await fetch(`/api/social/${deluluId}/stats${params}`);
      if (res.ok) {
        const data = await res.json();
        setStats({ likes: data.likes ?? 0, comments: data.comments ?? 0 });
      }
    } catch {
      // keep previous values on error
    }
  }, [deluluId, userKey]);

  // Stagger initial fetches with a small random jitter so feed cards
  // don't all fire simultaneously on page load.
  useEffect(() => {
    const jitter = Math.random() * 800;
    timerRef.current = setTimeout(() => void fetchStats(), jitter);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchStats]);

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ deluluId?: number }>).detail;
      if (detail?.deluluId != null && detail.deluluId !== deluluId) return;
      void fetchStats();
    };
    window.addEventListener(DELULU_SOCIAL_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(DELULU_SOCIAL_UPDATED_EVENT, onUpdate);
  }, [deluluId, fetchStats]);

  return stats;
}
