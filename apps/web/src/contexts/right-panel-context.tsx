"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type RightPanel = "notifications" | null;

interface RightPanelContextValue {
  panel: RightPanel;
  closeAll: () => void;
  openNotifications: () => void;
  toggleNotifications: () => void;
}

const RightPanelContext = createContext<RightPanelContextValue | null>(null);

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<RightPanel>(null);

  const closeAll = useCallback(() => setPanel(null), []);
  const openNotifications = useCallback(() => setPanel("notifications"), []);
  const toggleNotifications = useCallback(
    () => setPanel((p) => (p === "notifications" ? null : "notifications")),
    [],
  );

  const value = useMemo(
    () => ({ panel, closeAll, openNotifications, toggleNotifications }),
    [panel, closeAll, openNotifications, toggleNotifications],
  );

  return (
    <RightPanelContext.Provider value={value}>{children}</RightPanelContext.Provider>
  );
}

function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) throw new Error("useRightPanel must be used within RightPanelProvider");
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

/** @deprecated Use RightPanelProvider */
export const NotificationsPanelProvider = RightPanelProvider;
