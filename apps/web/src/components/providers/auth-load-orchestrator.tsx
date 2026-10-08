"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { preloadAuthProviders } from "@/lib/auth-session-hint";

const AppProviders = dynamic(
  () =>
    import("@/components/providers/app-providers").then((m) => m.AppProviders),
  {
    ssr: false,
    // Loading fallback while chunk downloads - minimal DOM to avoid jank
    loading: () => <div />,
  },
);

const ServiceWorkerRegister = dynamic(
  () => import("@/components/pwa/ServiceWorkerRegister").then((m) => m.ServiceWorkerRegister),
  { ssr: false },
);

/**
 * Marketing pages that need no wallet, login or data providers. They render
 * straight from the server instead of waiting on the ~1.5 MB wallet bundle;
 * that bundle is preloaded once the page is idle so "Start free" stays quick.
 */
const PUBLIC_PATHS = new Set(["/", "/terms", "/flyer"]);

function PublicShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(preloadAuthProviders);
    else window.setTimeout(preloadAuthProviders, 2_000);
  }, []);
  return (
    <>
      {/* Keeps the site installable (Install button) without the app providers.
          Own Suspense boundary: an ssr:false component bails rendering out to
          the nearest one, which would otherwise be the whole page. */}
      <Suspense fallback={null}>
        <ServiceWorkerRegister />
      </Suspense>
      {children}
    </>
  );
}

export function AuthLoadOrchestrator({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  if (PUBLIC_PATHS.has(pathname)) return <PublicShell>{children}</PublicShell>;
  // App routes: load AppProviders eagerly (deferring it caused 800-2000ms
  // navigation delays).
  return <AppProviders>{children}</AppProviders>;
}
