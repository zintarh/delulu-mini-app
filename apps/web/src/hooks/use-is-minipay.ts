"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when the app is running inside the MiniPay wallet browser.
 * MiniPay injects window.ethereum with isMiniPay === true.
 * Safe to call on SSR — always returns false until hydration.
 */
export function useIsMiniPay(): boolean {
  const [isMiniPay, setIsMiniPay] = useState(false);

  useEffect(() => {
    setIsMiniPay(
      typeof window !== "undefined" &&
        (window as any).ethereum?.isMiniPay === true,
    );
  }, []);

  return isMiniPay;
}

/** Synchronous check — only call in browser contexts. */
export function isMiniPayEnv(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as any).ethereum?.isMiniPay === true
  );
}
