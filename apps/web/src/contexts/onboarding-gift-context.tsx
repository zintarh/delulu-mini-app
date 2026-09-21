"use client";

import { createContext, useCallback, useContext, useState } from "react";

type OnboardingGiftContextValue = {
  /** Bumped by requestRecheck() — include in a dependency array to re-run on demand. */
  recheckToken: number;
  /**
   * Call right after an event that could newly grant the onboarding gift
   * (e.g. identity verification completing) so OnboardingGiftModal re-checks
   * immediately instead of only on its next fresh mount.
   */
  requestRecheck: () => void;
};

const OnboardingGiftContext = createContext<OnboardingGiftContextValue>({
  recheckToken: 0,
  requestRecheck: () => {},
});

export function useOnboardingGiftRecheck() {
  return useContext(OnboardingGiftContext);
}

export function OnboardingGiftProvider({ children }: { children: React.ReactNode }) {
  const [recheckToken, setRecheckToken] = useState(0);
  const requestRecheck = useCallback(() => setRecheckToken((t) => t + 1), []);

  return (
    <OnboardingGiftContext.Provider value={{ recheckToken, requestRecheck }}>
      {children}
    </OnboardingGiftContext.Provider>
  );
}
