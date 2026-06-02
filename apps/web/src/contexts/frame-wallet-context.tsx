"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { http, fallback } from "wagmi";
import { celo, fuse } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { web3AuthConnector } from "@/lib/web3auth-bridge";

const chains = [celo, fuse] as const;

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
      web3AuthConnector,
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

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground"
          aria-label="Loading wallet"
        />
      </div>
    );
  }

  return <WagmiProvider config={privyWagmiConfig}>{children}</WagmiProvider>;
}
