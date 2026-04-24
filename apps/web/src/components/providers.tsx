"use client";
import { MiniAppProvider } from "@/contexts/miniapp-context";
import FrameWalletProvider from "@/contexts/frame-wallet-context";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ApolloProvider } from "@/components/providers/ApolloProvider";
import dynamic from "next/dynamic";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { PrivyProvider } from "@privy-io/react-auth";
import { Web3AuthProvider } from "@web3auth/modal/react";
import { celo } from "wagmi/chains";
import { useSessionSigner } from "@/hooks/use-session-signer";
import { env } from "@/lib/env";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { PullToRefresh } from "@/components/pwa/PullToRefresh";
import { web3AuthContextConfig } from "@/lib/web3auth-config";
import { Web3AuthWagmiSync } from "@/components/web3auth-wagmi-sync";

const ErudaProvider = dynamic(
  () => import("../components/Eruda").then((c) => c.ErudaProvider),
  { ssr: false }
);

function SessionSignerSetup({ signerKeyQuorumId }: { signerKeyQuorumId?: string }) {
  useSessionSigner(signerKeyQuorumId);
  return null;
}

function AppWithPrivy({
  children,
  privyAppId: privyAppIdProp,
  signerKeyQuorumId: signerKeyQuorumIdProp,
}: {
  children: React.ReactNode;
  privyAppId?: string;
  signerKeyQuorumId?: string;
}) {
  const { theme } = useTheme();
  // Use server-passed id first; fallback to client env so Privy works with either PRIVY_APP_ID or NEXT_PUBLIC_PRIVY_APP_ID
  const privyAppId =
    (privyAppIdProp && privyAppIdProp.trim()) || env.NEXT_PUBLIC_PRIVY_APP_ID || undefined;
  const signerKeyQuorumId =
    (signerKeyQuorumIdProp && signerKeyQuorumIdProp.trim()) || undefined;

  const appTree = (
    <FrameWalletProvider>
      <Web3AuthWagmiSync />
      <ApolloProvider>
        <QueryProvider>
          <MiniAppProvider addMiniAppOnLoad={true}>
            <ServiceWorkerRegister />
            <PullToRefresh />
            {children}
          </MiniAppProvider>
        </QueryProvider>
      </ApolloProvider>
    </FrameWalletProvider>
  );

  const isDark = theme === "dark";

  return (
    <Web3AuthProvider config={web3AuthContextConfig}>
      <PrivyProvider
        appId={privyAppId as string}
        
        config={{
          appearance: {
            theme: "light",
          // accentColor: "#35d07f",
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
      <ThemeProvider>
        <AppWithPrivy privyAppId={privyAppId} signerKeyQuorumId={signerKeyQuorumId}>
          {children}
        </AppWithPrivy>
      </ThemeProvider>
    </ErudaProvider>
  );
}
