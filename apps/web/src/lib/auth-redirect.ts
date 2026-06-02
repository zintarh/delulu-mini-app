const POST_SIGN_IN_REDIRECT_KEY = "delulu:post_sign_in_redirect";

/** Standard label for action buttons when the user is not signed in. */
export const SIGN_IN_BUTTON_LABEL = "Sign in";

export function authButtonLabel(
  authenticated: boolean,
  actionLabel: string,
): string {
  return authenticated ? actionLabel : SIGN_IN_BUTTON_LABEL;
}

/** Only allow same-origin relative paths (prevents open redirects). */
export function safeRedirectPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export function buildSignInUrl(redirectPath?: string): string {
  const safe = safeRedirectPath(redirectPath);
  if (!safe) return "/sign-in";
  return `/sign-in?redirect=${encodeURIComponent(safe)}`;
}

export function persistSignInRedirect(path: string | null | undefined): void {
  const safe = safeRedirectPath(path);
  if (!safe || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(POST_SIGN_IN_REDIRECT_KEY, safe);
  } catch {
    // private mode / quota
  }
}

export function peekSignInRedirect(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return safeRedirectPath(sessionStorage.getItem(POST_SIGN_IN_REDIRECT_KEY));
  } catch {
    return null;
  }
}

export function consumeSignInRedirect(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(POST_SIGN_IN_REDIRECT_KEY);
    sessionStorage.removeItem(POST_SIGN_IN_REDIRECT_KEY);
    return safeRedirectPath(value);
  } catch {
    return null;
  }
}
