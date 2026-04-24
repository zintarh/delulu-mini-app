"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  useWeb3Auth,
  useWeb3AuthConnect,
  useWeb3AuthDisconnect,
  useWeb3AuthUser,
} from "@web3auth/modal/react";

export type AuthProvider = "privy" | "web3auth" | null;

const PROVIDER_KEY = "delulu:auth_provider";
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

  const {
    ready,
    authenticated: privyAuthenticated,
    logout: privyLogout,
    user: privyUser,
  } = usePrivy();
  const { wallets } = useWallets();

  const {
    isConnected: web3authConnected,
    isInitialized,
    web3Auth,
    initError,
  } = useWeb3Auth();
  const { connect: web3authConnect } = useWeb3AuthConnect();
  const { disconnect: web3authDisconnect } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();

  if (initError) console.error("[auth] web3auth init error:", initError);

  const [web3authAddress, setWeb3authAddress] = useState<
    `0x${string}` | undefined
  >();

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

  const privyEmbeddedAddress = (privyUser as any)?.linkedAccounts?.find(
    (a: any) => a.type === "wallet" && a.walletClientType === "privy",
  )?.address as `0x${string}` | undefined;

  const authenticated = privyAuthenticated || web3authConnected;

  const provider: AuthProvider = privyAuthenticated
    ? "privy"
    : web3authConnected
      ? "web3auth"
      : null;

  const privyAddress =
    (wallets?.[0]?.address as `0x${string}` | undefined) ??
    privyEmbeddedAddress;
  const fallbackAddress: `0x${string}` | undefined =
    account.address ?? web3authAddress ?? privyAddress;

  const address: `0x${string}` | undefined =
    provider === "web3auth"
      ? (web3authAddress ?? account.address)
      : provider === "privy"
        ? (privyAddress ?? account.address ?? web3authAddress)
        : fallbackAddress;

  const isReady = ready;

  const email: string | undefined =
    (privyUser as any)?.email?.address ??
    (privyUser as any)?.linkedAccounts?.find((a: any) => a.type === "email")
      ?.address ??
    userInfo?.email ??
    undefined;

  const pendingLogin = useRef(false);

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
      console.log("[auth] login queued: Web3Auth not initialized yet", {
        isInitialized,
        hasWeb3AuthInstance: !!web3Auth,
      });
      pendingLogin.current = true;
      return;
    }
    console.log("[auth] login started: opening Web3Auth modal");
    web3authConnect().catch((err) => {
      console.error("[auth] web3auth connect error:", err);
    });
  };

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

    try {
      localStorage.removeItem(PROVIDER_KEY);
    } catch {}
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
