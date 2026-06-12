"use client";

import dynamic from "next/dynamic";
import WalletProvider from "@/contexts/frame-wallet-context";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ApolloProvider } from "@/components/providers/ApolloProvider";
import { Web3AuthProvider } from "@web3auth/modal/react";
import { web3AuthContextConfig } from "@/lib/web3auth-config";
import { Web3AuthWagmiSync } from "@/components/web3auth-wagmi-sync";
import { NoGasProvider } from "@/contexts/no-gas-context";
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

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <Web3AuthProvider config={web3AuthContextConfig}>
      <QueryProvider>
        <WalletProvider>
          <Web3AuthWagmiSync />
          <ApolloProvider>
            <NoGasProvider>
              <NotificationCountProvider>
                <ServiceWorkerRegister />
                <PullToRefresh />
                <EmailCaptureGate />
                {children}
              </NotificationCountProvider>
            </NoGasProvider>
          </ApolloProvider>
        </WalletProvider>
      </QueryProvider>
    </Web3AuthProvider>
  );
}
