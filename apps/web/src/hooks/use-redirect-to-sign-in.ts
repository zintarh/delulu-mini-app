"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  authButtonLabel,
  buildSignInUrl,
  persistSignInRedirect,
  SIGN_IN_BUTTON_LABEL,
} from "@/lib/auth-redirect";
import { useAuth } from "@/hooks/use-auth";
import { preloadAuthProviders } from "@/lib/auth-session-hint";

/**
 * Redirect unauthenticated users to /sign-in (never opens Web3Auth/Privy modal inline).
 */
export function useRedirectToSignIn() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { authenticated, isReady } = useAuth();

  const getCurrentPath = useCallback(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  const redirectToSignIn = useCallback(
    (redirectPath?: string) => {
      const target = redirectPath ?? getCurrentPath();
      persistSignInRedirect(target);
      preloadAuthProviders();
      router.push(buildSignInUrl(target));
    },
    [router, getCurrentPath],
  );

  /** Returns true if the user is authenticated and the action may proceed. */
  const requireAuth = useCallback(
    (onAuthed?: () => void, redirectPath?: string): boolean => {
      if (!authenticated) {
        redirectToSignIn(redirectPath);
        return false;
      }
      onAuthed?.();
      return true;
    },
    [authenticated, redirectToSignIn],
  );

  const labelFor = useCallback(
    (actionLabel: string) => authButtonLabel(authenticated, actionLabel),
    [authenticated],
  );

  return {
    redirectToSignIn,
    requireAuth,
    labelFor,
    authenticated,
    isReady,
    SIGN_IN_BUTTON_LABEL,
  };
}

export { SIGN_IN_BUTTON_LABEL, authButtonLabel };
