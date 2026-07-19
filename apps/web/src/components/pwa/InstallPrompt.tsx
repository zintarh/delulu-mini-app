"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "delulu_install_prompt_dismissed_v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    nav.standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Custom "Add to Home Screen" banner. The native beforeinstallprompt popup
 * is suppressed in ServiceWorkerRegister, so this owns install UX instead:
 * Android/Chrome gets a real install button; iOS Safari (no install API)
 * gets one-time instructions.
 */
export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    setDismissed(readDismissed());

    if (isIosSafari()) {
      setShowIosBanner(true);
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const handleDismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
    writeDismissed();
    setDismissed(true);
  };

  if (dismissed) return null;
  if (!deferredEvent && !showIosBanner) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-24 z-[110] sm:inset-x-auto sm:right-4 sm:w-80",
        "lg:bottom-6",
        "rounded-2xl border-2 border-delulu-charcoal bg-background p-3.5",
        "shadow-[2px_2px_0px_0px_#1a1a19]",
        "flex items-start gap-3",
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted border border-border">
        {showIosBanner && !deferredEvent ? (
          <Share className="h-5 w-5 text-foreground" />
        ) : (
          <Download className="h-5 w-5 text-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black leading-tight">Install Delulu</p>
        {deferredEvent ? (
          <>
            <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
              Add it to your home screen for quick access and proof reminders.
            </p>
            <button
              type="button"
              onClick={handleInstall}
              className={cn(
                "mt-2 h-8 rounded-lg border-2 border-delulu-charcoal bg-delulu-yellow-reserved",
                "px-3 text-xs font-black text-delulu-charcoal hover:brightness-95 transition-all",
              )}
            >
              Install app
            </button>
          </>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
            Tap <Share className="inline h-3 w-3 -mt-0.5" /> then &quot;Add to Home Screen&quot;
            for quick access and proof reminders.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
