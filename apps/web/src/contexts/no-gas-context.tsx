"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { NoGasModal } from "@/components/no-gas-modal";
import { useHasGas } from "@/hooks/use-has-gas";
import { useAuth } from "@/hooks/use-auth";

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

export function NoGasProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { isLowGas, isLoading, balanceKnown, refetch } = useHasGas();
  const { authenticated } = useAuth();
  const stateRef = useRef({ isLowGas, isLoading, balanceKnown });
  stateRef.current = { isLowGas, isLoading, balanceKnown };
  const shown = useRef(false);
  const quietUntil = useRef(0);

  useEffect(() => {
    if (!authenticated || !balanceKnown) return;
    // They can pay a fee. Close the prompt and allow a future shortage to show it once.
    if (!isLowGas) {
      shown.current = false;
      quietUntil.current = 0;
      setOpen(false);
      return;
    }
    if (shown.current || Date.now() < quietUntil.current) return;
    shown.current = true;
    setOpen(true);
  }, [authenticated, balanceKnown, isLowGas]);

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
      <NoGasModal open={open} notice={null} onClose={() => setOpen(false)} onClaimed={onClaimed} />
    </NoGasContext.Provider>
  );
}
