"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { WagmiProvider, createConfig } from "wagmi";
import { http, fallback, custom } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { isMiniPayEnv } from "@/hooks/use-is-minipay";

const chains = [celo] as const;

export default function FrameWalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const wagmiConfig = useMemo(() => {
    const celoTransport = isMiniPayEnv()
      ? custom((window as any).ethereum)
      : fallback([
          http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL),
          http("https://forno.celo.org"),
        ]);

    return createConfig({
      chains,
      connectors: [injected()],
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

  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
