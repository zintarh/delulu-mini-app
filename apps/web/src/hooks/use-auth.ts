"use client";

import { useAccount, useDisconnect } from "wagmi";

export type AuthProvider = null;

export interface UseAuthReturn {
  address: `0x${string}` | undefined;
  account: ReturnType<typeof useAccount>;
  isConnected: boolean;
  isReady: boolean;
  authenticated: boolean;
  provider: AuthProvider;
  email: string | undefined;
  login: () => void;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const account = useAccount();
  const { disconnect } = useDisconnect();

  const login = () => {
    // MiniPay auto-connects via the injected wallet — no manual login needed
  };

  const logout = async () => {
    disconnect();
  };

  return {
    address: account.address,
    account,
    isConnected: account.isConnected,
    isReady: true,
    authenticated: account.isConnected,
    provider: null,
    email: undefined,
    login,
    logout,
  };
}
