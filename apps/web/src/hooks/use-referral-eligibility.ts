"use client";

import { useEffect, useState } from "react";
import type { ReferralEligibilitySteps } from "@/lib/referral/eligibility";

type State = {
  isLoading: boolean;
  eligible: boolean;
  steps: ReferralEligibilitySteps | null;
};

/** Whether this wallet has finished onboarding enough to see/share its referral link. */
export function useReferralEligibility(address?: string | null) {
  const [state, setState] = useState<State>({ isLoading: Boolean(address), eligible: false, steps: null });

  useEffect(() => {
    if (!address) {
      setState({ isLoading: false, eligible: false, steps: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true }));
    void (async () => {
      try {
        const res = await fetch(`/api/referral/eligibility?address=${address}`);
        const json = (await res.json()) as { eligible?: boolean; steps?: ReferralEligibilitySteps };
        if (cancelled) return;
        setState({ isLoading: false, eligible: Boolean(json.eligible), steps: json.steps ?? null });
      } catch {
        if (!cancelled) setState({ isLoading: false, eligible: false, steps: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return state;
}
