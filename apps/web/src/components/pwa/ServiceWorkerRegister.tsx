"use client";

import { useEffect } from "react";

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    nav.standalone === true
  );
}

/**
 * Registers the push SW and keeps the installed PWA on the latest deploy.
 * Standalone apps have no browser refresh chrome, so we:
 * - never cache sw.js (`updateViaCache: "none"` + Cache-Control headers)
 * - activate waiting workers immediately
 * - reload once when a new worker takes control
 * - re-check for updates when the app becomes visible again
 * - bust bfcache restores that can show a frozen shell
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    let updateTimer: number | undefined;
    // First activation shouldn't force a reload — only subsequent updates.
    let hadController = Boolean(navigator.serviceWorker.controller);

    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const promptWaiting = (reg: ServiceWorkerRegistration) => {
      const waiting = reg.waiting;
      if (!waiting) return;
      waiting.postMessage({ type: "SKIP_WAITING" });
    };

    const watchInstalling = (reg: ServiceWorkerRegistration) => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          installing.postMessage({ type: "SKIP_WAITING" });
        }
      });
    };

    const checkForUpdates = (reg: ServiceWorkerRegistration) => {
      void reg.update().catch(() => {});
      promptWaiting(reg);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void navigator.serviceWorker.getRegistration("/").then((reg) => {
        if (reg) checkForUpdates(reg);
      });
    };

    const onPageShow = (event: PageTransitionEvent) => {
      // iOS/Android can restore the PWA from bfcache with a frozen JS heap.
      if (event.persisted && isStandalonePwa()) {
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        promptWaiting(reg);
        watchInstalling(reg);
        reg.addEventListener("updatefound", () => watchInstalling(reg));

        checkForUpdates(reg);
        updateTimer = window.setInterval(() => checkForUpdates(reg), 60_000);
      } catch {
        // Ignore registration failures (unsupported / insecure context).
      }
    };

    void register();

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      if (updateTimer) window.clearInterval(updateTimer);
    };
  }, []);

  // beforeinstallprompt is captured by <InstallPrompt />, which owns install UX.

  return null;
}
