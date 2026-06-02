"use client";

import dynamic from "next/dynamic";
import { AuthLoadOrchestrator } from "@/components/providers/auth-load-orchestrator";

const ErudaProvider = dynamic(
  () => import("../components/Eruda").then((c) => c.ErudaProvider),
  { ssr: false },
);

export default function Providers({
  children,
  privyAppId,
  signerKeyQuorumId,
}: {
  children: React.ReactNode;
  privyAppId?: string;
  signerKeyQuorumId?: string;
}) {
  return (
    <ErudaProvider>
      <AuthLoadOrchestrator
        privyAppId={privyAppId}
        signerKeyQuorumId={signerKeyQuorumId}
      >
        {children}
      </AuthLoadOrchestrator>
    </ErudaProvider>
  );
}
