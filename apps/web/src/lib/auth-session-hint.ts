/** localStorage keys written by useAuth when a session is active */
const AUTH_PROVIDER_KEY = "delulu:auth_provider";
const LAST_PROVIDER_KEY = "delulu:last_provider";

/**
 * True when the user likely has an active session (Privy or Web3Auth).
 * Used only to decide when to load wallet SDKs — not for security.
 */
export function hasStoredAuthSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const provider = localStorage.getItem(AUTH_PROVIDER_KEY);
    const last = localStorage.getItem(LAST_PROVIDER_KEY);
    return provider === "privy" || provider === "web3auth" || last === "privy" || last === "web3auth";
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
  void import("@/components/providers/app-with-privy");
}
