"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Fuel } from "lucide-react";
import { useHasGas } from "@/hooks/use-has-gas";
import { useNoGas } from "@/contexts/no-gas-context";
import { cn } from "@/lib/utils";

/** Persistent low-key banner shown across the app for as long as the user has no gas. */
export function NoGasBanner() {
  const { hasGas, isLoading } = useHasGas();
  const { trigger } = useNoGas();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading || hasGas) return null;

  // Portaled to <body> — the main layout's overflow-hidden container clips
  // `position: fixed` descendants otherwise (same issue AppToast works around).
  return createPortal(
    <button
      type="button"
      onClick={trigger}
      role="status"
      className={cn(
        "fixed bottom-24 left-1/2 z-[90] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 text-left",
        "lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0",
        "flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/12 px-4 py-3 shadow-lg backdrop-blur-sm",
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
        "transition-colors hover:bg-amber-500/18",
      )}
    >
      <Fuel className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span className="flex-1 text-sm font-medium leading-snug text-foreground">
        You don&apos;t have gas. Top up your gas or join our Telegram group to continue.
      </span>
    </button>,
    document.body,
  );
}
