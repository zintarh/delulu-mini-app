"use client";

import dynamic from "next/dynamic";
import { AuthLoadOrchestrator } from "@/components/providers/auth-load-orchestrator";

const ErudaProvider = dynamic(
  () => import("../components/Eruda").then((c) => c.ErudaProvider),
  { ssr: false },
);

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErudaProvider>
      <AuthLoadOrchestrator>{children}</AuthLoadOrchestrator>
    </ErudaProvider>
  );
}
