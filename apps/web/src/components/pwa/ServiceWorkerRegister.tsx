"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        // Register at root scope so PushManager works site-wide.
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Ignore registration failures (e.g., unsupported browser / dev quirks).
      }
    };

    register();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Hard-disable any browser-driven PWA install popup or mini-infobar.
    const suppressInstallPrompt = (event: Event) => {
      event.preventDefault();
    };

    window.addEventListener("beforeinstallprompt", suppressInstallPrompt as EventListener);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        suppressInstallPrompt as EventListener,
      );
    };
  }, []);

  return null;
}

