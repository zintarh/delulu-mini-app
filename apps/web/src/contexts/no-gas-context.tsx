"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { NoGasModal } from "@/components/no-gas-modal";

interface NoGasContextValue {
  trigger: () => void;
}

const NoGasContext = createContext<NoGasContextValue>({ trigger: () => {} });

export function useNoGas() {
  return useContext(NoGasContext);
}

export function NoGasProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const trigger = useCallback(() => setOpen(true), []);

  return (
    <NoGasContext.Provider value={{ trigger }}>
      {children}
      <NoGasModal open={open} onClose={() => setOpen(false)} />
    </NoGasContext.Provider>
  );
}
