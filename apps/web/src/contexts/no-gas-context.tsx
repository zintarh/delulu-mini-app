"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { parseEther } from "viem";
import { NoGasModal } from "@/components/no-gas-modal";
import { useHasGas } from "@/hooks/use-has-gas";
import { useAuth } from "@/hooks/use-auth";
import { COMFORT_BALANCE_CELO } from "@/lib/faucet/rules";

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

const COMFORT_WEI = parseEther(String(COMFORT_BALANCE_CELO));

export function NoGasProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { isLowGas, isLoading, balanceKnown, balanceWei } = useHasGas();
  const { authenticated } = useAuth();
  const stateRef = useRef({ isLowGas, isLoading, balanceKnown });
  stateRef.current = { isLowGas, isLoading, balanceKnown };
  const shown = useRef(false);

  useEffect(() => {
    if (!authenticated || !balanceKnown || balanceWei == null) return;
    if (balanceWei >= COMFORT_WEI) {
      shown.current = false;
      return;
    }
    if (shown.current) return;
    shown.current = true;
    setOpen(true);
  }, [authenticated, balanceKnown, balanceWei]);

  const trigger = useCallback((opts?: { force?: boolean }) => {
    if (opts?.force) {
      setOpen(true);
      return;
    }
    const { isLowGas: low, isLoading: loading, balanceKnown: known } = stateRef.current;
    if (loading || !known || !low) return;
    setOpen(true);
  }, []);

  const covered = balanceKnown && balanceWei != null && balanceWei >= COMFORT_WEI;

  return (
    <NoGasContext.Provider value={{ trigger, covered }}>
      {children}
      <NoGasModal open={open} notice={null} onClose={() => setOpen(false)} />
    </NoGasContext.Provider>
  );
}
