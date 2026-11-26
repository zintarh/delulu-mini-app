"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { setFlowStateLive } from "@/lib/flow-state";

/**
 * The admin's voting switch (Admin → Home). undefined until known, so
 * nothing vote-related flashes up before we know voting is on. Re-checked
 * when the app comes back to the foreground and every minute.
 */
export function useFlowVoteLive(): boolean | undefined {
  const { data } = useQuery({
    queryKey: ["app-flags"],
    queryFn: async () => {
      const res = await fetch("/api/flags");
      if (!res.ok) throw new Error("flags unavailable");
      return (await res.json()) as { flowVote: boolean };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
  const on = data?.flowVote;
  useEffect(() => {
    if (typeof on === "boolean") setFlowStateLive(on);
  }, [on]);
  return on;
}
