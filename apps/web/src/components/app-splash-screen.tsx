"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Keeps the splash up long enough to read as intentional even on a fast
// load, without ever blocking on a slow one — whichever finishes first past
// this floor wins.
const MIN_VISIBLE_MS = 900;
const FADE_MS = 300;

/**
 * Brand splash shown while the app boots on every launch, like a native
 * app's launch screen. Swaps light/dark logo via Tailwind's `dark:` class
 * variant (same mechanism next-themes drives the rest of the app with), so
 * it stays correct even though dark mode is currently forced off sitewide —
 * no extra work needed when that's re-enabled.
 */
export function AppSplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const start = Date.now();
    let fadeTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;

    const dismiss = () => {
      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - start));
      fadeTimer = setTimeout(() => {
        setFading(true);
        hideTimer = setTimeout(() => setVisible(false), FADE_MS);
      }, wait);
    };

    if (document.readyState === "complete") {
      dismiss();
    } else {
      window.addEventListener("load", dismiss, { once: true });
    }

    return () => {
      window.removeEventListener("load", dismiss);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity ease-out",
        fading ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <Image
        src="/logo-light-mode.png"
        alt="Delulu"
        width={240}
        height={240}
        priority
        className="h-24 w-24 animate-logo-pulse dark:hidden"
      />
      <Image
        src="/logo-dark-mode.png"
        alt="Delulu"
        width={240}
        height={240}
        priority
        className="hidden h-24 w-24 animate-logo-pulse dark:block"
      />
    </div>
  );
}
