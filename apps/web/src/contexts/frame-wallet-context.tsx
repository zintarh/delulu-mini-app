"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { celo, fuse } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";


const ENABLE_LOCAL_WALLETS = false; 

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
              // TODO: replace with a dedicated Delulu/GoodDollar app icon URL
              "https://gooddollar.org/favicon.ico",
            ],
          },
        }),
      ]
    : baseConnectors;

const config = createConfig({
  // Only support EVM chains used by GoodDollar (Celo & Fuse)
  chains: [celo, fuse],
  connectors,
  transports: {
    [celo.id]: http(
      process.env.NEXT_PUBLIC_CELO_RPC_URL ??
        process.env.NEXT_PUBLIC_RPC_URL
    ),
    [fuse.id]: http(process.env.NEXT_PUBLIC_FUSE_RPC_URL),
  },
});

const queryClient = new QueryClient();

export default function FrameWalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}
