"use client";

import { AppWithPrivy } from "@/components/providers/app-with-privy";

export function AuthLoadOrchestrator({
  children,
}: {
  children: React.ReactNode;
  privyAppId?: string;
  signerKeyQuorumId?: string;
}) {
  return <AppWithPrivy>{children}</AppWithPrivy>;
}
