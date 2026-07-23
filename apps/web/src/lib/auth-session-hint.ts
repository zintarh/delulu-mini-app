/** localStorage key written by useAuth while a wallet session is active */
const AUTH_PROVIDER_KEY = "delulu:auth_provider";

/** Active wallet session only — not last-used provider after logout. */
export function hasStoredAuthSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const provider = localStorage.getItem(AUTH_PROVIDER_KEY);
    return provider === "web3auth" || provider === "privy";
  } catch {
    return false;
  }
}

/** Preload the heavy auth provider chunk (e.g. before navigation to sign-in). */
export function preloadAuthProviders(): void {
  if (typeof window === "undefined") return;
  void import("@/components/providers/app-providers");
}
