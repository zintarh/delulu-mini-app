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

/**
 * Routes that must have wallet/auth SDKs before first paint.
 */
export function isAuthEagerRoute(pathname: string): boolean {
  if (pathname.startsWith("/sign-in")) return true;
  if (pathname.startsWith("/welcome")) return true;
  if (pathname === "/board" || pathname.startsWith("/board/")) return true;
  if (pathname.startsWith("/daily-claim")) return true;
  if (pathname.startsWith("/wrap")) return true;
  return false;
}

export function shouldLoadAuthEagerly(pathname: string): boolean {
  return isAuthEagerRoute(pathname) || hasStoredAuthSession();
}

/** Preload the heavy auth provider chunk (e.g. before navigation to sign-in). */
export function preloadAuthProviders(): void {
  if (typeof window === "undefined") return;
  void import("@/components/providers/app-providers");
}
