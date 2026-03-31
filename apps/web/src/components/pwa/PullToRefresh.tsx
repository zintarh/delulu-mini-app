"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const scrollerRef = useRef<HTMLElement | Window | null>(null);
  const [pullPx, setPullPx] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Keep it PWA-only so web doesn’t feel “weird”.
    if (!isStandalonePwa()) return;
    // Disable pull-to-refresh on single delulu pages.
    if (pathname?.startsWith("/delulu/")) return;
    if (pathname?.startsWith("/admin")) return;

    const threshold = 72;
    const maxPull = 110;

    const getScrollableParent = (el: EventTarget | null): HTMLElement | null => {
      let node = el as HTMLElement | null;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const canScrollY =
          /(auto|scroll|overlay)/.test(style.overflowY) &&
          node.scrollHeight > node.clientHeight;
        if (canScrollY) return node;
        node = node.parentElement;
      }
      return null;
    };

    const isAtTop = (scroller: HTMLElement | Window | null) => {
      if (!scroller || scroller instanceof Window) return (window.scrollY ?? 0) <= 0;
      return scroller.scrollTop <= 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      scrollerRef.current = getScrollableParent(e.target) ?? window;
      if (!isAtTop(scrollerRef.current)) return;
      startYRef.current = e.touches[0]?.clientY ?? null;
      pullingRef.current = false;
      setPullPx(0);
    };

    const onTouchMove = (e: TouchEvent) => {
      const startY = startYRef.current;
      if (startY === null) return;
      if (!isAtTop(scrollerRef.current)) return;

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
      scrollerRef.current = null;

      if (!pullingRef.current) {
        setPullPx(0);
        return;
      }

      pullingRef.current = false;

      if (px >= threshold) {
        setIsRefreshing(true);
        setPullPx(threshold);
        // Next/App Router refresh (soft), falls back to reload if needed.
        try {
          router.refresh();
        } catch {
          window.location.reload();
        }
      }

      // snap back
      setTimeout(() => {
        setPullPx(0);
        setIsRefreshing(false);
      }, 550);
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
  }, [router, pullPx, pathname]);

  if (pullPx <= 0 && !isRefreshing) return null;

  const clamped = Math.min(56, pullPx);
  const progress = Math.min(1, clamped / 56);
  const rotateDeg = Math.floor(progress * 260);

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-0 z-[60] pointer-events-none",
        "flex items-center justify-center",
      )}
      style={{
        transform: `translateY(${clamped - 56}px)`,
        transition: pullPx === 0 ? "transform 180ms ease" : undefined,
      }}
    >
      <div className="mt-3 flex items-center justify-center">
        <div
          className={cn(
            "h-9 w-9 rounded-full border border-border bg-secondary/95 backdrop-blur",
            "shadow-neo-sm flex items-center justify-center",
          )}
        >
          <div
            className={cn(
              "h-4 w-4 rounded-full border-2 border-muted-foreground/30",
              "border-t-foreground",
              isRefreshing ? "animate-spin" : "",
            )}
            style={!isRefreshing ? { transform: `rotate(${rotateDeg}deg)` } : undefined}
          />
        </div>
      </div>
    </div>
  );
}

