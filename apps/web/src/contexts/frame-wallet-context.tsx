"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { http, fallback } from "wagmi";
import { celo, fuse } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const chains = [celo, fuse] as const;

const queryClient = new QueryClient();

export default function FrameWalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const privyWagmiConfig = useMemo(() => {
    const baseConnectors = [
      farcasterMiniApp(),
      injected(),
    ];

    const configOptions = {
      chains,
      connectors: baseConnectors,
      transports: {
        [celo.id]: fallback([
          http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL),
          http("https://forno.celo.org"),
        ]),
        [fuse.id]: http(process.env.NEXT_PUBLIC_FUSE_RPC_URL),
      },
    };

    return createConfig(configOptions);
  }, []);

  if (!mounted) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={privyWagmiConfig}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}
