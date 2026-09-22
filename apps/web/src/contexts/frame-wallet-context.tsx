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
      // Reads that fire several readContract calls together (e.g. the
      // GoodDollar identity-ladder check in lib/identity/status.ts, which
      // does 4+ reads per check) otherwise go out as that many separate
      // RPC round-trips — more surface for any one of them to blip and
      // fail the whole check. Batching collapses concurrent reads within
      // the wait window into a single eth_call via Multicall3.
      batch: { multicall: { wait: 16 } },
    });
  }, []);

  if (!mounted) return null;

  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
