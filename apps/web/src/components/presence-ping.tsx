"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

const KEY = "delulu:presence-at";
const EVERY_MS = 30 * 60_000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function platformOf(): string {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/**
 * Tells the server when someone is in the app (at most every 30 min) and
 * whether it's the installed home-screen app — feeds retention analytics and
 * the nudge engine. Silent; never blocks anything.
 */
export function PresencePing() {
  const { address } = useAuth();

  useEffect(() => {
    if (!address) return;
    const ping = (extra: { installed?: boolean } = {}) => {
      try {
        const last = Number(localStorage.getItem(KEY) ?? 0);
        if (!extra.installed && Date.now() - last < EVERY_MS) return;
        localStorage.setItem(KEY, String(Date.now()));
      } catch {
        /* storage blocked — still ping */
      }
      void fetch("/api/me/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standalone: isStandalone(), platform: platformOf(), ...extra }),
        keepalive: true,
      }).catch(() => {});
    };
    ping();
    const onVisible = () => document.visibilityState === "visible" && ping();
    const onInstalled = () => ping({ installed: true });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [address]);

  return null;
}
