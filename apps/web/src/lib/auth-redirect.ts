const POST_SIGN_IN_REDIRECT_KEY = "delulu:post_sign_in_redirect";
const COMMUNITY_REFERRAL_KEY = "delulu:community_referral";

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

export function normalizeCommunityCode(code: string | null | undefined): string | null {
  const normalized = code?.trim().toUpperCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function persistCommunityReferral(code: string | null | undefined): void {
  const normalized = normalizeCommunityCode(code);
  if (!normalized || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(COMMUNITY_REFERRAL_KEY, normalized);
  } catch {
    // private mode / quota
  }
}

export function peekCommunityReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeCommunityCode(sessionStorage.getItem(COMMUNITY_REFERRAL_KEY));
  } catch {
    return null;
  }
}

export function consumeCommunityReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(COMMUNITY_REFERRAL_KEY);
    sessionStorage.removeItem(COMMUNITY_REFERRAL_KEY);
    return normalizeCommunityCode(value);
  } catch {
    return null;
  }
}

export function buildSignInWithCommunityUrl(communityCode: string, redirectPath?: string): string {
  const code = normalizeCommunityCode(communityCode);
  if (!code) return buildSignInUrl(redirectPath);
  const params = new URLSearchParams({ community: code });
  const safe = safeRedirectPath(redirectPath) ?? `/join/${code}`;
  params.set("redirect", safe);
  return `/sign-in?${params.toString()}`;
}
