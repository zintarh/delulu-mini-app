"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type RightPanel = "notifications" | "claim" | null;

interface RightPanelContextValue {
  panel: RightPanel;
  closeAll: () => void;
  openNotifications: () => void;
  openClaim: () => void;
  toggleNotifications: () => void;
  toggleClaim: () => void;
}

const RightPanelContext = createContext<RightPanelContextValue | null>(null);

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<RightPanel>(null);

  const closeAll = useCallback(() => setPanel(null), []);

  const openNotifications = useCallback(() => setPanel("notifications"), []);
  const openClaim = useCallback(() => setPanel("claim"), []);

  const toggleNotifications = useCallback(
    () => setPanel((p) => (p === "notifications" ? null : "notifications")),
    []
  );

  const toggleClaim = useCallback(
    () => setPanel((p) => (p === "claim" ? null : "claim")),
    []
  );

  const value = useMemo(
    () => ({
      panel,
      closeAll,
      openNotifications,
      openClaim,
      toggleNotifications,
      toggleClaim,
    }),
    [panel, closeAll, openNotifications, openClaim, toggleNotifications, toggleClaim]
  );

  return (
    <RightPanelContext.Provider value={value}>{children}</RightPanelContext.Provider>
  );
}

function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) {
    throw new Error("useRightPanel must be used within RightPanelProvider");
  }
  return ctx;
}

export function useNotificationsPanel() {
  const { panel, closeAll, openNotifications, toggleNotifications } = useRightPanel();
  return {
    isOpen: panel === "notifications",
    open: openNotifications,
    close: closeAll,
    toggle: toggleNotifications,
  };
}

export function useClaimPanel() {
  const { panel, closeAll, openClaim, toggleClaim } = useRightPanel();
  return {
    isOpen: panel === "claim",
    open: openClaim,
    close: closeAll,
    toggle: toggleClaim,
  };
}

/** @deprecated Use RightPanelProvider */
export const NotificationsPanelProvider = RightPanelProvider;
