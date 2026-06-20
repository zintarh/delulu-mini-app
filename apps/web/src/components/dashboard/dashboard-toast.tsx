"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { DashboardToast } from "@/components/dashboard/dashboard-ui";

type DashboardToastContextValue = {
  show: (message: string, ms?: number) => void;
};

const DashboardToastContext = createContext<DashboardToastContextValue | null>(null);

export function DashboardToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((msg: string, ms = 2500) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(null), ms);
  }, []);

  return (
    <DashboardToastContext.Provider value={{ show }}>
      {children}
      {message ? (
        <DashboardToast message={message} onDismiss={() => setMessage(null)} />
      ) : null}
    </DashboardToastContext.Provider>
  );
}

export function useDashboardToast() {
  const ctx = useContext(DashboardToastContext);
  if (!ctx) {
    throw new Error("useDashboardToast must be used within DashboardToastProvider");
  }
  return { show: ctx.show };
}
