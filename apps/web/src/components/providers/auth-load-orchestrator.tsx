"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  shouldLoadAuthEagerly,
  isAuthEagerRoute,
} from "@/lib/auth-session-hint";
import { ProvidersSkeleton } from "@/components/providers/providers-skeleton";

function AuthChunkLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground"
        aria-label="Loading"
      />
    </div>
  );
}

const AppWithPrivy = dynamic(
  () =>
    import("@/components/providers/app-with-privy").then((m) => m.AppWithPrivy),
  {
    ssr: false,
    loading: () => <AuthChunkLoading />,
  },
);

const DEFER_IDLE_MS = 2000;

type AuthLoadPhase = "pending" | "loading" | "ready";

export function AuthLoadOrchestrator({
  children,
  privyAppId,
  signerKeyQuorumId,
}: {
  children: React.ReactNode;
  privyAppId?: string;
  signerKeyQuorumId?: string;
}) {
  const pathname = usePathname() ?? "/";
  const eager = shouldLoadAuthEagerly(pathname);

  const [phase, setPhase] = useState<AuthLoadPhase>(() =>
    eager ? "loading" : "pending",
  );

  // Eager routes & returning sessions: load wallet SDKs immediately.
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

  // If user navigates to sign-in / board / etc. while still pending, load immediately.
  useEffect(() => {
    if (phase === "pending" && isAuthEagerRoute(pathname)) {
      setPhase("loading");
    }
  }, [pathname, phase]);

  if (phase === "pending") {
    return <ProvidersSkeleton />;
  }

  return (
    <AppWithPrivy privyAppId={privyAppId} signerKeyQuorumId={signerKeyQuorumId}>
      {children}
    </AppWithPrivy>
  );
}
