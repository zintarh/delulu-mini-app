"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X } from "lucide-react";
import { APP_TOAST_EVENT } from "@/lib/celebrate";
import { cn } from "@/lib/utils";

type ToastState = { message: string } | null;

/** Global success/info toast for the main app (listens to `delulu:app-toast`). */
export function AppToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onToast = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      if (!message) return;
      setToast({ message });
    };
    window.addEventListener(APP_TOAST_EVENT, onToast);
    return () => window.removeEventListener(APP_TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast || !mounted) return null;

  // Portaled straight to <body> — the main layout wraps children in an
  // `overflow-hidden` container, and if any sheet/drawer elsewhere applies a
  // transform to an ancestor, `position: fixed` descendants get re-contained
  // and clipped by that overflow, hiding the toast behind the bottom nav.
  return createPortal(
    <div
      role="status"
      className={cn(
        "fixed bottom-24 left-1/2 z-[200] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2",
        "lg:bottom-6 lg:left-1/2",
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
    >
      <div className="flex items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/12 px-4 py-2.5 shadow-lg backdrop-blur-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <p className="flex-1 text-sm font-semibold text-foreground">{toast.message}</p>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-black/5"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
