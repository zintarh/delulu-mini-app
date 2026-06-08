"use client";

import { useWalletClient } from "wagmi";

export function useUnifiedWalletClient() {
  const { data: wagmiWalletClient } = useWalletClient();
  return wagmiWalletClient ?? null;
}
