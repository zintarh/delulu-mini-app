"use client";

import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";

interface ConnectorSelectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectorSelectionSheet({
  open,
  onOpenChange,
}: ConnectorSelectionSheetProps) {
  const { login, authenticated } = usePrivy();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!open) {
      hasTriggeredRef.current = false;
      return;
    }
    if (hasTriggeredRef.current) return;

    hasTriggeredRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        // Only trigger Privy login if the user is not already authenticated.
        if (!authenticated) {
          await login();
        }
      } finally {
        if (!cancelled) {
          onOpenChange(false);
          hasTriggeredRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, authenticated, login, onOpenChange]);

  // Do not render any sheet UI; this component is just a trigger for Privy.
  return null;
}
