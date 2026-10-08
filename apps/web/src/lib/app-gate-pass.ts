/**
 * Remembers which wallet last passed the onboarding checks on this device.
 * Sign-in runs those checks before sending the user into the app; with this,
 * the main layout's OnboardingGate doesn't block on re-running them — a
 * returning user sees the app straight away while the checks re-run in the
 * background. The gate still redirects out if a check confirms the account
 * is incomplete. Cleared on logout.
 */
const KEY = "delulu:gate-passed";

export function markGatePassed(address: string) {
  try {
    localStorage.setItem(KEY, address.toLowerCase());
  } catch {
    // Storage blocked (private mode etc.) — the gate just checks again.
  }
}

/** Address of the wallet that last passed, if any. */
export function gatePassedAddress(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function hasGatePassed(address: string | null | undefined): boolean {
  return !!address && gatePassedAddress() === address.toLowerCase();
}

export function clearGatePassed() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
