"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { useClaimPanel } from "@/contexts/right-panel-context";
import { WHITELIST_TOAST_MESSAGES } from "@/lib/gooddollar-whitelist";
import { cn } from "@/lib/utils";

/** Brief toast when user is redirected to claim for whitelist (tip / create). */
export function WhitelistRedirectToast() {
  const { whitelistIntent, clearWhitelistIntent } = useClaimPanel();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!whitelistIntent) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, [whitelistIntent]);

  if (!whitelistIntent || !visible) return null;

  const message = WHITELIST_TOAST_MESSAGES[whitelistIntent];

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-24 left-1/2 z-[80] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2",
        "lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0",
        "rounded-xl border border-border bg-card px-4 py-3 shadow-lg",
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-delulu-yellow-reserved" />
        <p className="flex-1 text-sm font-medium text-foreground leading-snug">
          {message}
        </p>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            clearWhitelistIntent();
          }}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
