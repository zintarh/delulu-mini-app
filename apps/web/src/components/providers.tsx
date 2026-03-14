"use client";
import { MiniAppProvider } from "@/contexts/miniapp-context";
import FrameWalletProvider from "@/contexts/frame-wallet-context";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ApolloProvider } from "@/components/providers/ApolloProvider";
import dynamic from "next/dynamic";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { PrivyProvider } from "@privy-io/react-auth";
import { celo } from "wagmi/chains";
import { useSessionSigner } from "@/hooks/use-session-signer";

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
  privyAppId,
  signerKeyQuorumId,
}: {
  children: React.ReactNode;
  privyAppId?: string;
  signerKeyQuorumId?: string;
}) {
  const { theme } = useTheme();
  const usePrivyWagmi = Boolean(privyAppId);

  const appTree = (
    <FrameWalletProvider usePrivyWagmi={usePrivyWagmi}>
      <ApolloProvider>
        <QueryProvider>
          <MiniAppProvider addMiniAppOnLoad={true}>
            {children}
          </MiniAppProvider>
        </QueryProvider>
      </ApolloProvider>
    </FrameWalletProvider>
  );

  if (!privyAppId) {
    return appTree;
  }

  const isDark = theme === "dark";

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: isDark ? "#151515" : "#ffffff",
          accentColor: isDark ? "#151515" : "#151515",
          logo: "/favicon_io/favicon-32x32.png",
          walletChainType: "ethereum-only",
        },
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
