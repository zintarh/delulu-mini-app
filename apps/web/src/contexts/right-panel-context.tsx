"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { GoodDollarWhitelistAction } from "@/lib/gooddollar-whitelist";

export type RightPanel = "notifications" | "claim" | "verify" | null;

interface RightPanelContextValue {
  panel: RightPanel;
  claimWhitelistIntent: GoodDollarWhitelistAction | null;
  clearClaimWhitelistIntent: () => void;
  closeAll: () => void;
  openNotifications: () => void;
  openClaim: () => void;
  openForWhitelist: (action: GoodDollarWhitelistAction) => void;
  toggleNotifications: () => void;
  toggleClaim: () => void;
  openVerify: () => void;
  /** Closes the verify sheet and opens the claim panel straight into the face check. */
  startFaceCheck: () => void;
  claimAutoVerify: boolean;
  clearClaimAutoVerify: () => void;
}

const RightPanelContext = createContext<RightPanelContextValue | null>(null);

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<RightPanel>(null);
  const [claimWhitelistIntent, setClaimWhitelistIntent] =
    useState<GoodDollarWhitelistAction | null>(null);

  const [claimAutoVerify, setClaimAutoVerify] = useState(false);
  const clearClaimAutoVerify = useCallback(() => setClaimAutoVerify(false), []);
  const openVerify = useCallback(() => setPanel("verify"), []);
  const startFaceCheck = useCallback(() => {
    setClaimWhitelistIntent(null);
    setClaimAutoVerify(true);
    setPanel("claim");
  }, []);

  const clearClaimWhitelistIntent = useCallback(
    () => setClaimWhitelistIntent(null),
    [],
  );

  const closeAll = useCallback(() => {
    setPanel(null);
    setClaimWhitelistIntent(null);
    setClaimAutoVerify(false);
  }, []);

  const openNotifications = useCallback(() => setPanel("notifications"), []);
  const openClaim = useCallback(() => {
    setClaimWhitelistIntent(null);
    setPanel("claim");
  }, []);

  const openForWhitelist = useCallback((action: GoodDollarWhitelistAction) => {
    setClaimWhitelistIntent(action);
    setPanel("claim");
  }, []);

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
      claimWhitelistIntent,
      clearClaimWhitelistIntent,
      closeAll,
      openNotifications,
      openClaim,
      openForWhitelist,
      toggleNotifications,
      toggleClaim,
      openVerify,
      startFaceCheck,
      claimAutoVerify,
      clearClaimAutoVerify,
    }),
    [
      openVerify,
      startFaceCheck,
      claimAutoVerify,
      clearClaimAutoVerify,
      panel,
      claimWhitelistIntent,
      clearClaimWhitelistIntent,
      closeAll,
      openNotifications,
      openClaim,
      openForWhitelist,
      toggleNotifications,
      toggleClaim,
    ],
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
  const {
    panel,
    claimWhitelistIntent,
    clearClaimWhitelistIntent,
    closeAll,
    openClaim,
    openForWhitelist,
    toggleClaim,
    claimAutoVerify,
    clearClaimAutoVerify,
  } = useRightPanel();
  return {
    isOpen: panel === "claim",
    autoVerify: claimAutoVerify,
    clearAutoVerify: clearClaimAutoVerify,
    whitelistIntent: claimWhitelistIntent,
    clearWhitelistIntent: clearClaimWhitelistIntent,
    open: openClaim,
    openForWhitelist,
    close: closeAll,
    toggle: toggleClaim,
  };
}

/** "Prove you're a real person" sheet shown before the GoodDollar face check. */
export function useVerifySheet() {
  const { panel, closeAll, openVerify, startFaceCheck } = useRightPanel();
  return { isOpen: panel === "verify", open: openVerify, close: closeAll, startFaceCheck };
}
