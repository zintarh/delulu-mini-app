"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { parseEther } from "viem";
import { NoGasModal } from "@/components/no-gas-modal";
import { useHasGas } from "@/hooks/use-has-gas";
import { useAuth } from "@/hooks/use-auth";
import { COMFORT_BALANCE_CELO } from "@/lib/faucet/rules";
import { requestGasTopup } from "@/lib/faucet/request-client";

interface NoGasContextValue {
  /**
   * Opens the claim-gas popup. With `force`, always (a transaction just failed).
   * Without it, only when the wallet is confirmed short of gas.
   */
  trigger: (opts?: { force?: boolean }) => void;
  /** Wallet holds enough CELO, so the low-gas banner stays hidden. */
  covered: boolean;
}

const NoGasContext = createContext<NoGasContextValue>({ trigger: () => {}, covered: false });

export function useNoGas() {
  return useContext(NoGasContext);
}

/** After a successful claim, stay quiet so a stale balance reading can't pop the prompt again. */
const QUIET_MS = 2 * 60_000;
const COMFORT_WEI = parseEther(String(COMFORT_BALANCE_CELO));
/**
 * Asking again in the background won't change these. Some only pass from a
 * tap in the popup (captcha), some need a face check or tomorrow.
 */
const TERMINAL = new Set([
  "sent_out",
  "blocked",
  "not_eligible",
  "stage_cap",
  "paused",
  "has_enough",
  "captcha_required",
  "captcha_failed",
  "ip_limit",
  "subnet_limit",
]);

export function NoGasProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [autoFailed, setAutoFailed] = useState(false);
  const [autoReason, setAutoReason] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const { isLowGas, isLoading, balanceKnown, balanceWei, refetch } = useHasGas();
  const { authenticated, address } = useAuth();
  const stateRef = useRef({ isLowGas, isLoading, balanceKnown });
  stateRef.current = { isLowGas, isLoading, balanceKnown };
  const shown = useRef(false);
  const quietUntil = useRef(0);
  const autoFor = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  // Any signed-in wallet under 0.4 CELO gets filled back up, including the
  // 0.01–0.4 band where a fee still fits so the prompt stays closed.
  useEffect(() => {
    if (!authenticated || !address || !balanceKnown || balanceWei == null) return;
    if (balanceWei >= COMFORT_WEI) {
      autoFor.current = null;
      setAutoFailed(false);
      setAutoReason(null);
      return;
    }
    const key = address.toLowerCase();
    if (autoFor.current === key) return;
    autoFor.current = key;
    void requestGasTopup().then((res) => {
      if (res.success) {
        quietUntil.current = Date.now() + QUIET_MS;
        shown.current = true;
        setAutoFailed(false);
        setAutoReason(null);
        setOpen(false);
        void refetch();
        timers.current.push(window.setTimeout(() => void refetch(), 4_000));
        timers.current.push(window.setTimeout(() => void refetch(), 12_000));
        return;
      }
      setAutoFailed(true);
      setAutoReason(res.reason ?? null);
      if (!TERMINAL.has(res.reason ?? "")) {
        timers.current.push(window.setTimeout(() => {
          if (autoFor.current === key) autoFor.current = null;
          setRetryTick((n) => n + 1);
        }, QUIET_MS));
      }
    });
  }, [authenticated, address, balanceKnown, balanceWei, refetch, retryTick]);

  useEffect(() => {
    const pending = timers;
    return () => {
      for (const timer of pending.current) window.clearTimeout(timer);
      pending.current = [];
    };
  }, [address]);

  useEffect(() => {
    if (!authenticated || !balanceKnown) return;
    // They can pay a fee. Close the prompt and allow a future shortage to show it once.
    if (!isLowGas) {
      shown.current = false;
      quietUntil.current = 0;
      setOpen(false);
      return;
    }
    // The silent refill is the first try. The prompt is only for a wallet that
    // still cannot pay a fee after that try.
    if (!autoFailed || shown.current || Date.now() < quietUntil.current) return;
    shown.current = true;
    setOpen(true);
  }, [authenticated, balanceKnown, isLowGas, autoFailed]);

  const trigger = useCallback((opts?: { force?: boolean }) => {
    if (opts?.force) {
      if (Date.now() < quietUntil.current) return;
      setOpen(true);
      return;
    }
    const { isLowGas: low, isLoading: loading, balanceKnown: known } = stateRef.current;
    if (loading || !known || !low || Date.now() < quietUntil.current) return;
    setOpen(true);
  }, []);

  const onClaimed = useCallback(() => {
    quietUntil.current = Date.now() + QUIET_MS;
    shown.current = true;
    setOpen(false);
    void refetch();
  }, [refetch]);

  const covered = balanceKnown && !isLowGas;

  return (
    <NoGasContext.Provider value={{ trigger, covered }}>
      {children}
      <NoGasModal open={open} reason={autoReason} onClose={() => setOpen(false)} onClaimed={onClaimed} />
    </NoGasContext.Provider>
  );
}
