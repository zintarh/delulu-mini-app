"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Fuel } from "lucide-react";
import { useHasGas } from "@/hooks/use-has-gas";
import { useNoGas } from "@/contexts/no-gas-context";
import { cn } from "@/lib/utils";

/** Persistent low-key banner shown across the app for as long as the user has no gas. */
export function NoGasBanner() {
  const { isLowGas, isLoading } = useHasGas();
  const { trigger } = useNoGas();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading || !isLowGas) return null;

  // Portaled to <body> — the main layout's overflow-hidden container clips
  // `position: fixed` descendants otherwise (same issue AppToast works around).
  return createPortal(
    <button
      type="button"
      onClick={trigger}
      role="status"
      className={cn(
        "fixed inset-x-3 bottom-[calc(var(--mobile-bottom-nav-bar)+24px)] z-[90] text-left sm:inset-x-auto sm:right-4 sm:w-80",
        "lg:bottom-6 lg:right-6",
        "press-edge flex items-center gap-3 rounded-[20px] border-2 border-orange/30 bg-orange-soft p-3.5 shadow-[0_4px_0_rgba(180,65,12,0.25)]",
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange">
        <Fuel className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-extrabold leading-tight text-foreground">You need gas to continue</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">Tap to top up or get some free in our Telegram.</span>
      </span>
    </button>,
    document.body,
  );
}
