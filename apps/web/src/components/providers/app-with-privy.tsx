"use client";

import dynamic from "next/dynamic";
import { MiniAppProvider } from "@/contexts/miniapp-context";
import FrameWalletProvider from "@/contexts/frame-wallet-context";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ApolloProvider } from "@/components/providers/ApolloProvider";
import { PrivyProvider } from "@privy-io/react-auth";
import { Web3AuthProvider } from "@web3auth/modal/react";
import { celo } from "wagmi/chains";
import { useSessionSigner } from "@/hooks/use-session-signer";
import { env } from "@/lib/env";
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

function SessionSignerSetup({ signerKeyQuorumId }: { signerKeyQuorumId?: string }) {
  useSessionSigner(signerKeyQuorumId);
  return null;
}

export function AppWithPrivy({
  children,
  privyAppId: privyAppIdProp,
  signerKeyQuorumId: signerKeyQuorumIdProp,
}: {
  children: React.ReactNode;
  privyAppId?: string;
  signerKeyQuorumId?: string;
}) {
  const privyAppId =
    (privyAppIdProp && privyAppIdProp.trim()) || env.NEXT_PUBLIC_PRIVY_APP_ID || undefined;
  const signerKeyQuorumId =
    (signerKeyQuorumIdProp && signerKeyQuorumIdProp.trim()) || undefined;

  const appTree = (
    <QueryProvider>
      <FrameWalletProvider>
        <Web3AuthWagmiSync />
        <ApolloProvider>
          <NoGasProvider>
            <NotificationCountProvider>
              <MiniAppProvider addMiniAppOnLoad={true}>
                <ServiceWorkerRegister />
                <PullToRefresh />
                <EmailCaptureGate />
                {children}
              </MiniAppProvider>
            </NotificationCountProvider>
          </NoGasProvider>
        </ApolloProvider>
      </FrameWalletProvider>
    </QueryProvider>
  );

  return (
    <Web3AuthProvider config={web3AuthContextConfig}>
      <PrivyProvider
        appId={privyAppId as string}
        config={{
          appearance: {
            theme: "light",
            logo: "/favicon_io/favicon-32x32.png",
            walletChainType: "ethereum-only",
            loginMessage: "Welcome back",
          },
          loginMethods: ["email", "wallet"],
          defaultChain: celo,
          supportedChains: [celo],
          embeddedWallets: {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
        }}
      >
        <SessionSignerSetup signerKeyQuorumId={signerKeyQuorumId} />
        {appTree}
      </PrivyProvider>
    </Web3AuthProvider>
  );
}
