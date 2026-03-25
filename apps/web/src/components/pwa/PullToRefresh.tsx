"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as any;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    nav?.standalone === true
  );
}

export function PullToRefresh() {
  const router = useRouter();
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const [pullPx, setPullPx] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Keep it PWA-only so web doesn’t feel “weird”.
    if (!isStandalonePwa()) return;

    const threshold = 72;
    const maxPull = 110;

    const atTop = () => (window.scrollY ?? 0) <= 0;

    const onTouchStart = (e: TouchEvent) => {
      if (!atTop()) return;
      startYRef.current = e.touches[0]?.clientY ?? null;
      pullingRef.current = false;
      setPullPx(0);
    };

    const onTouchMove = (e: TouchEvent) => {
      const startY = startYRef.current;
      if (startY === null) return;
      if (!atTop()) return;

      const y = e.touches[0]?.clientY ?? startY;
      const delta = y - startY;
      if (delta <= 0) return;

      pullingRef.current = true;
      // prevent native overscroll glow; keeps gesture feeling consistent
      e.preventDefault();

      const eased = Math.min(maxPull, delta * 0.6);
      setPullPx(eased);
    };

    const onTouchEnd = async () => {
      const px = pullPx;
      startYRef.current = null;

      if (!pullingRef.current) {
        setPullPx(0);
        return;
      }

      pullingRef.current = false;

      if (px >= threshold) {
        setPullPx(threshold);
        // Next/App Router refresh (soft), falls back to reload if needed.
        try {
          router.refresh();
        } catch {
          window.location.reload();
        }
      }

      // snap back
      setTimeout(() => setPullPx(0), 250);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove as any);
      window.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, pullPx]);

  if (pullPx <= 0) return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-0 z-[60] pointer-events-none",
        "flex items-center justify-center",
      )}
      style={{
        transform: `translateY(${Math.min(56, pullPx) - 56}px)`,
        transition: pullPx === 0 ? "transform 180ms ease" : undefined,
      }}
    >
      <div className="mt-3 rounded-full border border-border bg-secondary/95 backdrop-blur px-3 py-1 text-[11px] font-semibold text-foreground">
        Release to refresh
      </div>
    </div>
  );
}

