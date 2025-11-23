"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, walletConnect } from "wagmi/connectors";

// Define Celo Sepolia (the current Celo testnet)
const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia Testnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
  },
  blockExplorers: {
    default: { name: "Celo Explorer", url: "https://celo-sepolia.blockscout.com" },
  },
  testnet: true,
});

const config = createConfig({
  chains: [celoSepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId:
        process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
        "198c09df983943bca25a23aaa539fbd4",
      metadata: {
        name: "Delulu",
        description: "Stake on your delusions",
        url: process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
        icons: ["https://avatars.githubusercontent.com/u/37784886"],
      },
    }),
    // Farcaster MiniApp connector - for when running inside Farcaster
    farcasterMiniApp(),
  ],
  transports: {
    [celoSepolia.id]: http("https://forno.celo-sepolia.celo-testnet.org", {
      retryCount: 5,
      retryDelay: 1000,
      timeout: 30000, // 30 seconds
    }),
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
