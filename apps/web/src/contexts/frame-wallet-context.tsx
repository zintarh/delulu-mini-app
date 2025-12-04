"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { celo, celoAlfajores } from "wagmi/chains";

// ============================================
// LOCAL TESTING MODE - WALLET CONNECTORS
// ============================================
// Uncomment the lines below to enable standard wallet connectors (MetaMask, etc.) for local testing
// Comment out when deploying to Farcaster
const ENABLE_LOCAL_WALLETS = false; // Set to true to enable MetaMask and other wallets

// Import standard connectors for local testing
// Uncomment these imports when ENABLE_LOCAL_WALLETS is true
// import { injected, metaMask } from "wagmi/connectors";

const connectors = ENABLE_LOCAL_WALLETS
  ? [
      // Standard wallets for local testing (uncomment when needed)
      // injected(),
      // metaMask(),
      // Keep Farcaster connector as fallback
      farcasterMiniApp(),
    ]
  : [
      // Farcaster connector only (production mode)
      farcasterMiniApp(),
    ];

const config = createConfig({
  chains: [celo, celoAlfajores],
  connectors,
  transports: {
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
});

const queryClient = new QueryClient();

export default function FrameWalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
