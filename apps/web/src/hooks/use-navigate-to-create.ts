"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useRequireGoodDollarWhitelist } from "@/hooks/use-require-gooddollar-whitelist";
import { preloadAuthProviders } from "@/lib/auth-session-hint";
import {
  prefetchCreateDelusionContent,
  prefetchCreateManifestStep,
} from "@/lib/prefetch-create-manifest";

/** Shared create entry: sign-in → whitelist → prefetch → /board */
export function useNavigateToCreate() {
  const router = useRouter();
  const { authenticated } = useAuth();
  const { ensureWhitelisted, isChecking } = useRequireGoodDollarWhitelist();

  const navigateToCreate = useCallback(async () => {
    if (!authenticated) {
      preloadAuthProviders();
      router.push("/sign-in?redirect=%2Fboard");
      return;
    }
    const allowed = await ensureWhitelisted("create");
    if (!allowed) return;
    prefetchCreateDelusionContent();
    prefetchCreateManifestStep();
    router.push("/board");
  }, [authenticated, ensureWhitelisted, router]);

  return { navigateToCreate, isChecking };
}
