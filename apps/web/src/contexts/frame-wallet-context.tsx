"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { createConfig as createWagmiConfig, WagmiProvider as WagmiProviderStandalone } from "wagmi";
import { http } from "wagmi";
import { celo, fuse } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const baseConnectors = [
  // Farcaster mini-app connector (frames)
  farcasterMiniApp(),
  // EIP-6963 injected wallets (MetaMask, Coinbase, Rabby, etc.)
  injected(),
];

// Optionally add WalletConnect for mobile / GoodWallet support
const connectors =
  walletConnectProjectId && walletConnectProjectId.length > 0
    ? [
        ...baseConnectors,
        walletConnect({
          projectId: walletConnectProjectId,
          metadata: {
            name: "Delulu",
            description:
              "Connect with GoodDollar Wallet or any WalletConnect-compatible EVM wallet.",
            url:
              process.env.NEXT_PUBLIC_APP_URL ??
              "https://gooddollar.org",
            icons: [
              "https://gooddollar.org/favicon.ico",
            ],
          },
        }),
      ]
    : baseConnectors;

const chains = [celo, fuse] as const;
const configOptions = {
  chains,
  connectors,
  transports: {
    [celo.id]: http(
      process.env.NEXT_PUBLIC_CELO_RPC_URL ??
        process.env.NEXT_PUBLIC_RPC_URL
    ),
    [fuse.id]: http(process.env.NEXT_PUBLIC_FUSE_RPC_URL),
  },
};

// Privy-aware config: syncs with Privy wallets (must be used inside PrivyProvider)
const privyWagmiConfig = createConfig(configOptions);

// Standalone config: used when Privy is not configured (no PrivyProvider)
const standaloneWagmiConfig = createWagmiConfig(configOptions);

const queryClient = new QueryClient();

export default function FrameWalletProvider({
  children,
  usePrivyWagmi = false,
}: {
  children: ReactNode;
  /** When true, use @privy-io/wagmi (must be inside PrivyProvider). When false, use standard wagmi. */
  usePrivyWagmi?: boolean;
}) {
  if (usePrivyWagmi) {
    return (
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={privyWagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProviderStandalone config={standaloneWagmiConfig}>
        {children}
      </WagmiProviderStandalone>
    </QueryClientProvider>
  );
}
