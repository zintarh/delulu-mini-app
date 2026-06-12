"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  shouldLoadAuthEagerly,
  isAuthEagerRoute,
  hasStoredAuthSession,
} from "@/lib/auth-session-hint";
import {
  ProvidersSkeleton,
  type ProvidersSkeletonVariant,
} from "@/components/providers/providers-skeleton";

function skeletonVariantForPath(pathname: string): ProvidersSkeletonVariant {
  return pathname === "/" && !hasStoredAuthSession() ? "home-guest" : "default";
}

function AuthChunkLoading() {
  const pathname = usePathname() ?? "/";
  return <ProvidersSkeleton variant={skeletonVariantForPath(pathname)} />;
}

const AppProviders = dynamic(
  () =>
    import("@/components/providers/app-providers").then((m) => m.AppProviders),
  {
    ssr: false,
    loading: () => <AuthChunkLoading />,
  },
);

const DEFER_IDLE_MS = 2000;

type AuthLoadPhase = "pending" | "loading" | "ready";

export function AuthLoadOrchestrator({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const eager = shouldLoadAuthEagerly(pathname);

  const [phase, setPhase] = useState<AuthLoadPhase>(() =>
    eager ? "loading" : "pending",
  );

  useEffect(() => {
    if (phase !== "pending") return;

    if (shouldLoadAuthEagerly(pathname)) {
      setPhase("loading");
      return;
    }

    let cancelled = false;

    const startLoad = () => {
      if (!cancelled) setPhase("loading");
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(startLoad, { timeout: DEFER_IDLE_MS });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const timer = window.setTimeout(startLoad, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pathname, phase]);

  useEffect(() => {
    if (phase === "pending" && isAuthEagerRoute(pathname)) {
      setPhase("loading");
    }
  }, [pathname, phase]);

  if (phase === "pending") {
    return <ProvidersSkeleton variant={skeletonVariantForPath(pathname)} />;
  }

  return <AppProviders>{children}</AppProviders>;
}
