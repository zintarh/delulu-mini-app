"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  useWeb3Auth,
  useWeb3AuthDisconnect,
  useWeb3AuthUser,
} from "@web3auth/modal/react";

export type AuthProvider = "privy" | "web3auth" | null;

const PROVIDER_KEY = "delulu:auth_provider";
// Never cleared on logout — used by sign-in page to open the right modal for returning users.
const LAST_PROVIDER_KEY = "delulu:last_provider";

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

  // ── Privy ─────────────────────────────────────────────────────────────────
  const {
    ready,
    authenticated: privyAuthenticated,
    logout: privyLogout,
    user: privyUser,
  } = usePrivy();
  const { wallets } = useWallets();

  // ── Web3Auth ──────────────────────────────────────────────────────────────
  const { isConnected: web3authConnected, isInitialized, web3Auth, initError } = useWeb3Auth();
  const { disconnect: web3authDisconnect } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();

  if (initError) console.error("[auth] web3auth init error:", initError);

  // ── Resolve Web3Auth address directly from its provider ───────────────────
  // We don't rely on wagmi here — web3Auth.provider is the EIP-1193 source of truth.
  const [web3authAddress, setWeb3authAddress] = useState<`0x${string}` | undefined>();

  useEffect(() => {
    if (!web3authConnected || !web3Auth?.provider) {
      setWeb3authAddress(undefined);
      return;
    }
    (web3Auth.provider as any)
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts?.[0]) setWeb3authAddress(accounts[0] as `0x${string}`);
      })
      .catch(() => {});
  }, [web3authConnected, web3Auth]);

  // ── Persist active provider to localStorage on auth state change ──────────
  useEffect(() => {
    if (privyAuthenticated) {
      try {
        localStorage.setItem(PROVIDER_KEY, "privy");
        localStorage.setItem(LAST_PROVIDER_KEY, "privy");
      } catch {}
    }
  }, [privyAuthenticated]);

  useEffect(() => {
    if (web3authConnected) {
      try {
        localStorage.setItem(PROVIDER_KEY, "web3auth");
        localStorage.setItem(LAST_PROVIDER_KEY, "web3auth");
      } catch {}
    }
  }, [web3authConnected]);

  // ── Address resolution ────────────────────────────────────────────────────
  const privyEmbeddedAddress = (privyUser as any)?.linkedAccounts?.find(
    (a: any) => a.type === "wallet" && a.walletClientType === "privy"
  )?.address as `0x${string}` | undefined;

  // ── Unified state ─────────────────────────────────────────────────────────
  const authenticated = privyAuthenticated || web3authConnected;

  const provider: AuthProvider = privyAuthenticated
    ? "privy"
    : web3authConnected
    ? "web3auth"
    : null;

  // Prefer address by active auth provider to avoid stale wagmi addresses
  // overshadowing Web3Auth/Privy sessions.
  const privyAddress =
    (wallets?.[0]?.address as `0x${string}` | undefined) ?? privyEmbeddedAddress;
  const fallbackAddress: `0x${string}` | undefined =
    account.address ?? web3authAddress ?? privyAddress;

  const address: `0x${string}` | undefined =
    provider === "web3auth"
      ? web3authAddress ?? account.address ?? privyAddress
      : provider === "privy"
      ? privyAddress ?? account.address ?? web3authAddress
      : fallbackAddress;

  const isReady = ready;

  // ── Email resolution ──────────────────────────────────────────────────────
  const email: string | undefined =
    (privyUser as any)?.email?.address ??
    (privyUser as any)?.linkedAccounts?.find((a: any) => a.type === "email")?.address ??
    userInfo?.email ??
    undefined;

  // ── Login — opens Web3Auth modal; queues if called before init completes ──
  const pendingLogin = useRef(false);

  useEffect(() => {
    if (isInitialized && web3Auth && pendingLogin.current) {
      pendingLogin.current = false;
      web3Auth.connect().catch((err) => {
        console.error("[auth] web3auth connect error:", err);
      });
    }
  }, [isInitialized, web3Auth]);

  const login = () => {
    if (!isInitialized || !web3Auth) {
      pendingLogin.current = true;
      return;
    }
    web3Auth.connect().catch((err) => {
      console.error("[auth] web3auth connect error:", err);
    });
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    let storedProvider: AuthProvider = null;
    try {
      storedProvider = localStorage.getItem(PROVIDER_KEY) as AuthProvider;
    } catch {}

    const activeProvider = provider ?? storedProvider;

    try {
      if (activeProvider === "privy" || privyAuthenticated) {
        await privyLogout();
      } else if (activeProvider === "web3auth" || web3authConnected) {
        await web3authDisconnect();
      }
    } catch (err) {
      console.error("[auth] logout error:", err);
    }

    try { localStorage.removeItem(PROVIDER_KEY); } catch {}
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
