"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/*
 * `beforeinstallprompt` fires once per page load, so it's captured in a
 * module-level store that every consumer (landing install sheet, in-app
 * banner) shares instead of each racing to grab it.
 */
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let listening = false;

function ensureListening() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)")?.matches === true || nav.standalone === true;
}

export function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return isIos() && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent);
}

/**
 * PWA install state: whether the native prompt is available (Android/Chrome),
 * whether we're on iOS (manual "Add to Home Screen" steps), and a `prompt()`
 * that shows the native dialog and resolves to the user's choice.
 */
export function useInstallPrompt() {
  const [, force] = useState(0);
  const [env, setEnv] = useState({ ios: false, iosSafari: false, standalone: false, mobile: false });

  useEffect(() => {
    ensureListening();
    const rerender = () => force((n) => n + 1);
    listeners.add(rerender);
    setEnv({ ios: isIos(), iosSafari: isIosSafari(), standalone: isStandalone(), mobile: isMobileDevice() });
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  const prompt = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferred) return "unavailable";
    const event = deferred;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred = null;
    listeners.forEach((l) => l());
    return outcome;
  }, []);

  return {
    canPrompt: deferred !== null,
    prompt,
    ...env,
  };
}

// Start listening as soon as this module loads on the client, so an early
// `beforeinstallprompt` isn't missed before the first consumer mounts.
if (typeof window !== "undefined") ensureListening();
