"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import {
  useWeb3Auth,
  useWeb3AuthConnect,
  useWeb3AuthDisconnect,
  useWeb3AuthUser,
} from "@web3auth/modal/react";
import { usePrivy, useWallets, useLogout as usePrivyLogout } from "@privy-io/react-auth";
import {
  clearWalletSessionClientState,
} from "@/lib/auth/establish-wallet-session-client";
import { consumeCommunityReferral, consumeSignInRedirect } from "@/lib/auth-redirect";

export type AuthProvider = "web3auth" | "privy" | null;

const PROVIDER_KEY = "delulu:auth_provider";

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

  // Web3Auth
  const {
    isConnected: web3authConnected,
    isInitialized,
    web3Auth,
    initError,
  } = useWeb3Auth();
  const { connect: web3authConnect } = useWeb3AuthConnect();
  const { disconnect: web3authDisconnect } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();

  // Privy
  const { authenticated: privyAuthenticated, ready: privyReady } = usePrivy();
  const { wallets } = useWallets();
  const { logout: privyLogout } = usePrivyLogout({ onSuccess: () => {} });

  useEffect(() => {
    if (initError) console.error("[auth] web3auth init error:", initError);
  }, [initError]);

  const [web3authAddress, setWeb3authAddress] = useState<`0x${string}` | undefined>();
  const pendingLogin = useRef(false);

  useEffect(() => {
    if (!web3authConnected || !web3Auth?.provider) {
      setWeb3authAddress(undefined);
      return;
    }
    (web3Auth.provider as any)
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts?.[0]) setWeb3authAddress(accounts[0] as `0x${string}`);
        else setWeb3authAddress(undefined);
      })
      .catch(() => setWeb3authAddress(undefined));
  }, [web3authConnected, web3Auth]);

  // Privy wallet address — embedded ("privy"/"privy-v2") or an externally
  // connected wallet linked via Privy's "wallet" login method. Wagmi never
  // registers a connector for either, so we read the address straight from
  // Privy's own wallet list.
  const privyAddress = wallets[0]?.address as `0x${string}` | undefined;

  // Persist provider hint in localStorage for eager auth loading on return visits
  useEffect(() => {
    if (web3authConnected) {
      try { localStorage.setItem(PROVIDER_KEY, "web3auth"); } catch {}
    } else if (privyAuthenticated) {
      try { localStorage.setItem(PROVIDER_KEY, "privy"); } catch {}
    }
  }, [web3authConnected, privyAuthenticated]);

  // Clear stale hint when both SDKs are initialized with no active session
  useEffect(() => {
    if (!isInitialized || !privyReady) return;
    if (!web3authConnected && !privyAuthenticated) {
      try { localStorage.removeItem(PROVIDER_KEY); } catch {}
    }
  }, [isInitialized, privyReady, web3authConnected, privyAuthenticated]);

  const authenticated = web3authConnected || privyAuthenticated;
  const provider: AuthProvider = web3authConnected ? "web3auth" : privyAuthenticated ? "privy" : null;
  const address: `0x${string}` | undefined = web3authAddress ?? privyAddress ?? account.address;
  // Ready when either SDK has finished initialising — OR so Privy users aren't
  // blocked if Web3Auth fails, and vice versa.
  const isReady = isInitialized || privyReady;
  const email: string | undefined = userInfo?.email ?? undefined;

  useEffect(() => {
    if (isInitialized && pendingLogin.current) {
      pendingLogin.current = false;
      web3authConnect().catch((err) => {
        console.error("[auth] web3auth connect error:", err);
      });
    }
  }, [isInitialized, web3authConnect]);

  const login = () => {
    if (!isInitialized) {
      pendingLogin.current = true;
      return;
    }
    web3authConnect().catch((err) => {
      console.error("[auth] web3auth connect error:", err);
    });
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/wallet-session", { method: "DELETE", credentials: "include" });
    } catch {}

    try {
      if (web3authConnected) await web3authDisconnect();
    } catch (err) {
      console.error("[auth] web3auth logout error:", err);
    }

    try {
      if (privyAuthenticated) await privyLogout();
    } catch (err) {
      console.error("[auth] privy logout error:", err);
    }

    try {
      localStorage.removeItem(PROVIDER_KEY);
      consumeCommunityReferral();
      consumeSignInRedirect();
    } catch {}
    clearWalletSessionClientState();
    setWeb3authAddress(undefined);
    disconnect();
  };

  return {
    address,
    account,
    isConnected: account.isConnected || authenticated,
    isReady,
    authenticated,
    provider,
    email,
    login,
    logout,
  };
}
