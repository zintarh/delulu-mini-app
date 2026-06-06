"use client";

import { useEffect } from "react";
import { useConnect, useAccount } from "wagmi";
import { injected } from "wagmi/connectors";
import { isMiniPayEnv } from "@/hooks/use-is-minipay";

/**
 * Silently connects to MiniPay's injected wallet on mount.
 * Per MiniPay docs: call eth_requestAccounts to get the address,
 * then connect wagmi's injected connector so the rest of the app
 * (useAccount, useBalance, etc.) sees the wallet as connected.
 * Renders nothing — purely a side effect.
 */
export function MiniPayConnect() {
  const { connect } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (!isMiniPayEnv() || isConnected) return;

    // Step 1: request accounts per MiniPay docs
    (window as any).ethereum
      .request({ method: "eth_requestAccounts", params: [] })
      .then(() => {
        // Step 2: connect wagmi injected connector so useAccount() populates
        connect({ connector: injected() });
      })
      .catch((err: unknown) => {
        console.error("[MiniPay] eth_requestAccounts failed:", err);
      });
  }, [connect, isConnected]);

  return null;
}
