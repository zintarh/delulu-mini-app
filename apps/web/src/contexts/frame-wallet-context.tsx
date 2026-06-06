"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { http, fallback, custom } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { web3AuthConnector } from "@/lib/web3auth-bridge";
import { isMiniPayEnv } from "@/hooks/use-is-minipay";

// MiniPay requires Celo only — no Fuse.
const chains = [celo] as const;

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

    // Per MiniPay docs: use custom(window.ethereum) transport inside MiniPay
    // so wallet operations go through the injected provider, not an HTTP RPC.
    const celoTransport = isMiniPayEnv()
      ? custom((window as any).ethereum)
      : fallback([
          http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL),
          http("https://forno.celo.org"),
        ]);

    return createConfig({
      chains,
      connectors: baseConnectors,
      transports: {
        [celo.id]: celoTransport,
      },
    });
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
