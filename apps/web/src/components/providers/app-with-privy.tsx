"use client";

import dynamic from "next/dynamic";
import { MiniAppProvider } from "@/contexts/miniapp-context";
import FrameWalletProvider from "@/contexts/frame-wallet-context";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ApolloProvider } from "@/components/providers/ApolloProvider";
import { NotificationCountProvider } from "@/contexts/notification-count-context";

const ServiceWorkerRegister = dynamic(
  () =>
    import("@/components/pwa/ServiceWorkerRegister").then(
      (m) => m.ServiceWorkerRegister,
    ),
  { ssr: false },
);
const PullToRefresh = dynamic(
  () => import("@/components/pwa/PullToRefresh").then((m) => m.PullToRefresh),
  { ssr: false },
);
const EmailCaptureGate = dynamic(
  () =>
    import("@/components/email-capture-gate").then((m) => m.EmailCaptureGate),
  { ssr: false },
);

export function AppWithPrivy({
  children,
}: {
  children: React.ReactNode;
  privyAppId?: string;
  signerKeyQuorumId?: string;
}) {
  return (
    <QueryProvider>
      <FrameWalletProvider>
        <ApolloProvider>
          <NotificationCountProvider>
            <MiniAppProvider addMiniAppOnLoad={true}>
              <ServiceWorkerRegister />
              <PullToRefresh />
              <EmailCaptureGate />
              {children}
            </MiniAppProvider>
          </NotificationCountProvider>
        </ApolloProvider>
      </FrameWalletProvider>
    </QueryProvider>
  );
}
