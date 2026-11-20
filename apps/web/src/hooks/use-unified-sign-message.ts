"use client";

import { useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { createWalletClient, custom, type EIP1193Provider } from "viem";
import { celo } from "wagmi/chains";
import { useWallets } from "@privy-io/react-auth";
import { getWeb3AuthProvider } from "@/lib/web3auth-bridge";

/** Signs a plain message with whichever wallet the user has — same routing as useUnifiedWriteContract. */
export function useUnifiedSignMessage() {
  const { signMessageAsync: wagmiSign } = useSignMessage();
  const { isConnected } = useAccount();
  const { wallets: privyWallets } = useWallets();

  return useCallback(
    async (message: string): Promise<`0x${string}`> => {
      const direct = async (provider: EIP1193Provider) => {
        const client = createWalletClient({ chain: celo, transport: custom(provider) });
        const [account] = await client.getAddresses();
        return client.signMessage({ account, message });
      };
      const w3a = getWeb3AuthProvider();
      if (w3a) return direct(w3a);
      if (isConnected) return wagmiSign({ message });
      const privy = (await privyWallets[0]?.getEthereumProvider().catch(() => null)) as EIP1193Provider | null;
      if (!privy) throw new Error("No wallet connected. Please reconnect your wallet and try again.");
      return direct(privy);
    },
    [wagmiSign, isConnected, privyWallets],
  );
}
