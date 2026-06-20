"use client";

import dynamic from "next/dynamic";

const AppProviders = dynamic(
  () =>
    import("@/components/providers/app-providers").then((m) => m.AppProviders),
  {
    ssr: false,
    // Loading fallback while chunk downloads - minimal DOM to avoid jank
    loading: () => <div />,
  },
);

export function AuthLoadOrchestrator({
  children,
}: {
  children: React.ReactNode;
}) {
  // Always load AppProviders eagerly to eliminate 800-2000ms navigation delay
  // Removed requestIdleCallback deferral that caused perceived unresponsiveness
  return <AppProviders>{children}</AppProviders>;
}
