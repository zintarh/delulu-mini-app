"use client";

import { useCallback, useEffect, useState } from "react";
import { DELULU_SOCIAL_UPDATED_EVENT } from "@/lib/delulu-social-storage";

export type DeluluStatEntry = {
  likes: number;
  comments: number;
  userReacted: boolean;
};

export function useDeluluBatchStats(
  ids: number[],
  userAddress?: string | null,
): Record<number, DeluluStatEntry> {
  const [stats, setStats] = useState<Record<number, DeluluStatEntry>>({});

  const fetchAll = useCallback(async () => {
    if (ids.length === 0) return;
    try {
      const params = new URLSearchParams({ ids: ids.join(",") });
      if (userAddress) params.set("userAddress", userAddress.toLowerCase());
      const res = await fetch(`/api/social/batch-stats?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats ?? {});
      }
    } catch {
      // keep previous values
    }
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  // Stringify ids so the dep only changes when the actual set of IDs changes,
  // not on every render when the caller passes a new array literal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [ids.join(","), userAddress]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const onUpdate = () => void fetchAll();
    window.addEventListener(DELULU_SOCIAL_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(DELULU_SOCIAL_UPDATED_EVENT, onUpdate);
  }, [fetchAll]);

  return stats;
}
