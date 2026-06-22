"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { WagmiProvider, createConfig, http, fallback } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { web3AuthConnector } from "@/lib/web3auth-bridge";

const chains = [celo] as const;

export default function WalletProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const wagmiConfig = useMemo(() => {
    const celoTransport = fallback([
      http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL),
      http("https://forno.celo.org"),
    ]);

    return createConfig({
      chains,
      connectors: [injected(), web3AuthConnector],
      transports: {
        [celo.id]: celoTransport,
      },
    });
  }, []);

  if (!mounted) return null;

  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
