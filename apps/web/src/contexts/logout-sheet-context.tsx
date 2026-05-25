"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { LogoutSheet } from "@/components/logout-sheet";
import { useAuth } from "@/hooks/use-auth";
import { useUserStore } from "@/stores/useUserStore";

type LogoutSheetContextValue = {
  openLogoutSheet: () => void;
};

const LogoutSheetContext = createContext<LogoutSheetContextValue | null>(null);

export function LogoutSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();

  const openLogoutSheet = useCallback(() => setOpen(true), []);

  const handleLogout = useCallback(async () => {
    await logout();
    useUserStore.getState().logout();
    setOpen(false);
    router.push("/sign-in");
  }, [logout, router]);

  const value = useMemo(() => ({ openLogoutSheet }), [openLogoutSheet]);

  return (
    <LogoutSheetContext.Provider value={value}>
      {children}
      <LogoutSheet open={open} onOpenChange={setOpen} onLogout={handleLogout} />
    </LogoutSheetContext.Provider>
  );
}

export function useLogoutSheet() {
  const ctx = useContext(LogoutSheetContext);
  if (!ctx) {
    throw new Error("useLogoutSheet must be used within LogoutSheetProvider");
  }
  return ctx;
}

/** Safe for components that may render outside `(main)` layout */
export function useLogoutSheetOptional() {
  return useContext(LogoutSheetContext);
}
