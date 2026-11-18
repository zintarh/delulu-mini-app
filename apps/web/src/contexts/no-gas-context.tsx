"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { NoGasModal } from "@/components/no-gas-modal";
import { useHasGas } from "@/hooks/use-has-gas";

interface NoGasContextValue {
  /**
   * Opens the no-gas modal. Without `force` only when CELO is confirmed below
   * 0.01 (the banner); with `force` always — a transaction just failed for gas,
   * which happens with ~0.1 CELO too when staking needs more.
   */
  trigger: (opts?: { force?: boolean }) => void;
}

const NoGasContext = createContext<NoGasContextValue>({ trigger: () => {} });

export function useNoGas() {
  return useContext(NoGasContext);
}

export function NoGasProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { isLowGas, isLoading, balanceKnown } = useHasGas();
  const stateRef = useRef({ isLowGas, isLoading, balanceKnown });
  stateRef.current = { isLowGas, isLoading, balanceKnown };

  const trigger = useCallback((opts?: { force?: boolean }) => {
    if (opts?.force) {
      setOpen(true);
      return;
    }
    const { isLowGas: low, isLoading: loading, balanceKnown: known } = stateRef.current;
    // Never open on loading/unknown balance — avoids false positives when users have gas.
    if (loading || !known || !low) return;
    setOpen(true);
  }, []);

  return (
    <NoGasContext.Provider value={{ trigger }}>
      {children}
      <NoGasModal open={open} onClose={() => setOpen(false)} />
    </NoGasContext.Provider>
  );
}
