const POST_SIGN_IN_REDIRECT_KEY = "delulu:post_sign_in_redirect";
const COMMUNITY_REFERRAL_KEY = "delulu:community_referral";
const REFERRAL_CODE_KEY = "delulu:referral_code";

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

/** User-level referral (?ref=CODE) — distinct from the community invite code above. */
export function normalizeReferralCode(code: string | null | undefined): string | null {
  const normalized = code?.trim().toUpperCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

/**
 * The ?ref= code has to survive the whole sign-up, which usually leaves the
 * tab: face verification opens GoodDollar in a NEW tab (noopener) and the
 * invitee finishes /welcome there. sessionStorage is per-tab, so keeping the
 * code only there silently dropped those referrals. It now lives in
 * localStorage (shared across tabs) with an expiry, plus a first-party cookie
 * that /api/profile reads as a server-side fallback.
 */
export const REFERRAL_COOKIE = "delulu_ref";
const REFERRAL_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function persistReferralCode(code: string | null | undefined): void {
  const normalized = normalizeReferralCode(code);
  if (!normalized || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(REFERRAL_CODE_KEY, normalized);
  } catch {
    // private mode / quota
  }
  try {
    localStorage.setItem(REFERRAL_CODE_KEY, JSON.stringify({ code: normalized, at: Date.now() }));
  } catch {
    // private mode / quota
  }
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(normalized)}; Max-Age=${REFERRAL_TTL_MS / 1000}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // cookies blocked
  }
}

function readStoredReferralCode(): string | null {
  try {
    const fromSession = normalizeReferralCode(sessionStorage.getItem(REFERRAL_CODE_KEY));
    if (fromSession) return fromSession;
  } catch {
    // fall through
  }
  try {
    const raw = localStorage.getItem(REFERRAL_CODE_KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number };
    if (typeof at !== "number" || Date.now() - at > REFERRAL_TTL_MS) {
      localStorage.removeItem(REFERRAL_CODE_KEY);
      return null;
    }
    return normalizeReferralCode(code);
  } catch {
    return null;
  }
}

export function peekReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return readStoredReferralCode();
}

export function consumeReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const value = readStoredReferralCode();
  try {
    sessionStorage.removeItem(REFERRAL_CODE_KEY);
  } catch {}
  try {
    localStorage.removeItem(REFERRAL_CODE_KEY);
  } catch {}
  try {
    document.cookie = `${REFERRAL_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {}
  return value;
}

export function buildSignInWithCommunityUrl(communityCode: string, redirectPath?: string): string {
  const code = normalizeCommunityCode(communityCode);
  if (!code) return buildSignInUrl(redirectPath);
  const params = new URLSearchParams({ community: code });
  const safe = safeRedirectPath(redirectPath) ?? `/join/${code}`;
  params.set("redirect", safe);
  return `/sign-in?${params.toString()}`;
}
