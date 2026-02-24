"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { celo } from "wagmi/chains";


const ENABLE_LOCAL_WALLETS = false; 
const connectors = ENABLE_LOCAL_WALLETS
  ? [farcasterMiniApp()]
  : [farcasterMiniApp()];

const config = createConfig({
  // Only support Celo mainnet in the app
  chains: [celo],
  connectors,
  transports: {
    [celo.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
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
