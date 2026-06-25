"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import {
  useWeb3Auth,
  useWeb3AuthConnect,
  useWeb3AuthDisconnect,
  useWeb3AuthUser,
} from "@web3auth/modal/react";
import {
  clearSessionRequestGuard,
  clearWalletSessionClientState,
  establishWalletSession,
  resetWalletSessionRequestGuard,
  shouldStartWalletSessionEstablishment,
} from "@/lib/auth/establish-wallet-session-client";
import { consumeCommunityReferral, consumeSignInRedirect } from "@/lib/auth-redirect";

export type AuthProvider = "web3auth" | null;

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

  const {
    isConnected: web3authConnected,
    isInitialized,
    web3Auth,
    initError,
  } = useWeb3Auth();
  const { connect: web3authConnect } = useWeb3AuthConnect();
  const { disconnect: web3authDisconnect } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();

  useEffect(() => {
    if (initError) console.error("[auth] web3auth init error:", initError);
  }, [initError]);

  const [web3authAddress, setWeb3authAddress] = useState<
    `0x${string}` | undefined
  >();
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
      .catch(() => {
        setWeb3authAddress(undefined);
      });
  }, [web3authConnected, web3Auth]);

  useEffect(() => {
    if (web3authConnected) {
      try {
        localStorage.setItem(PROVIDER_KEY, "web3auth");
      } catch {}
    } else {
      resetWalletSessionRequestGuard();
    }
  }, [web3authConnected]);

  const authenticated = web3authConnected;
  const provider: AuthProvider = web3authConnected ? "web3auth" : null;
  const address: `0x${string}` | undefined =
    web3authAddress ?? account.address;
  const isReady = isInitialized;
  const email: string | undefined = userInfo?.email ?? undefined;

  useEffect(() => {
    if (!web3authConnected || !web3Auth?.provider || !web3authAddress) return;
    // Module-level guard: many components call useAuth(); only one should trigger personal_sign.
    if (!shouldStartWalletSessionEstablishment(web3authAddress)) return;

    void establishWalletSession(web3authAddress, web3Auth.provider as {
      request: (args: { method: string; params: unknown[] }) => Promise<string>;
    })
      .then((ok) => {
        if (!ok) clearSessionRequestGuard(web3authAddress);
      })
      .catch((err) => {
        clearSessionRequestGuard(web3authAddress);
        console.warn("[auth] wallet session establishment failed:", err);
      });
  }, [web3authConnected, web3Auth, web3authAddress]);

  // Clear stale localStorage hint when SDK initialises with no active session.
  // This prevents hasStoredAuthSession() from returning true on next visit when
  // the Web3Auth session has already expired.
  useEffect(() => {
    if (!isInitialized || web3authConnected) return;
    try { localStorage.removeItem(PROVIDER_KEY); } catch {}
  }, [isInitialized, web3authConnected]);

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
      if (web3authConnected) {
        await web3authDisconnect();
      }
    } catch (err) {
      console.error("[auth] logout error:", err);
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
