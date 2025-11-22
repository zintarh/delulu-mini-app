"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, walletConnect } from "wagmi/connectors";

const config = createConfig({
  chains: [sepolia, mainnet],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "198c09df983943bca25a23aaa539fbd4",
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
    [mainnet.id]: http(),
    [sepolia.id]: http(),
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
