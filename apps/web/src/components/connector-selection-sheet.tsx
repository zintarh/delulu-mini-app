"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";

interface ConnectorSelectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectorSelectionSheet({
  open,
  onOpenChange,
}: ConnectorSelectionSheetProps) {
  const { login } = usePrivy();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      try {
        await login();
      } finally {
        if (!cancelled) {
          onOpenChange(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, login, onOpenChange]);

  // Do not render any sheet UI; this component is just a trigger for Privy.
  return null;
}
