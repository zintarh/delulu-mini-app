"use client";

import dynamic from "next/dynamic";
import WalletProvider from "@/contexts/frame-wallet-context";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ApolloProvider } from "@/components/providers/ApolloProvider";
import { Web3AuthProvider } from "@web3auth/modal/react";
import { PrivyProvider } from "@privy-io/react-auth";
import { celo } from "viem/chains";
import { web3AuthContextConfig } from "@/lib/web3auth-config";
import { Web3AuthWagmiSync } from "@/components/web3auth-wagmi-sync";
import { WalletSessionBootstrap } from "@/components/wallet-session-bootstrap";
import { PrivyWalletSessionBootstrap } from "@/components/privy-wallet-session-bootstrap";
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

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <Web3AuthProvider config={web3AuthContextConfig}>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ["email", "wallet"],
          defaultChain: celo,
          supportedChains: [celo],
          embeddedWallets: {
            ethereum: { createOnLogin: "users-without-wallets" },
          },
        }}
      >
        <QueryProvider>
          <WalletProvider>
            <Web3AuthWagmiSync />
            <WalletSessionBootstrap />
            <PrivyWalletSessionBootstrap />
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
      </PrivyProvider>
    </Web3AuthProvider>
  );
}
