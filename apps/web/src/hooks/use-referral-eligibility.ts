"use client";

import { useEffect, useState } from "react";
import type { ReferralEligibilitySteps } from "@/lib/referral/eligibility";
import type { ReferrerStanding } from "@/lib/referral/standing";

type State = {
  isLoading: boolean;
  eligible: boolean;
  steps: ReferralEligibilitySteps | null;
  /** Link locked until today's proof is in — see lib/referral/standing.ts. */
  standing: ReferrerStanding | null;
};

/**
 * Whether this wallet has finished onboarding enough to see/share its
 * referral link, and whether that link is currently locked.
 */
export function useReferralEligibility(address?: string | null) {
  const [state, setState] = useState<State>({
    isLoading: Boolean(address),
    eligible: false,
    steps: null,
    standing: null,
  });

  useEffect(() => {
    if (!address) {
      setState({ isLoading: false, eligible: false, steps: null, standing: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true }));
    void (async () => {
      try {
        const res = await fetch(`/api/referral/eligibility?address=${address}`);
        const json = (await res.json()) as {
          eligible?: boolean;
          steps?: ReferralEligibilitySteps;
          standing?: ReferrerStanding;
        };
        if (cancelled) return;
        setState({
          isLoading: false,
          eligible: Boolean(json.eligible),
          steps: json.steps ?? null,
          standing: json.standing ?? null,
        });
      } catch {
        if (!cancelled) setState({ isLoading: false, eligible: false, steps: null, standing: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return state;
}
