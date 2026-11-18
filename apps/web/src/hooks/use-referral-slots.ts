"use client";

import { useQuery } from "@tanstack/react-query";
import type { SlotsView } from "@/lib/referral/slots";

/** This round's referral spots (left / total, and when fresh ones open). */
export function useReferralSlots(enabled = true) {
  return useQuery({
    queryKey: ["referral-slots"],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<SlotsView> => {
      const res = await fetch("/api/referral/slots");
      if (!res.ok) throw new Error("slots unavailable");
      return res.json();
    },
  }).data;
}
