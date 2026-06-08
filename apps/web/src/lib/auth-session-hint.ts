/**
 * Routes that benefit from loading wallet providers before first paint.
 */
export function isAuthEagerRoute(pathname: string): boolean {
  if (pathname.startsWith("/sign-in")) return true;
  if (pathname.startsWith("/welcome")) return true;
  if (pathname === "/board" || pathname.startsWith("/board/")) return true;
  if (pathname.startsWith("/daily-claim")) return true;
  if (pathname.startsWith("/wrap")) return true;
  return false;
}

export function shouldLoadAuthEagerly(_pathname: string): boolean {
  return true;
}

/** No-op on MiniPay build — no heavy auth SDK to preload. */
export function preloadAuthProviders(): void {}
