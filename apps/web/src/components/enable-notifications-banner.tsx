"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useHasGas } from "@/hooks/use-has-gas";
import {
  getPushSupportState,
  subscribeToWebPush,
} from "@/lib/web-push-client";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "delulu_push_prompt_dismissed_at_v1";
/** After dismiss, wait this long before showing again. */
const DISMISS_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

function isDismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Soft prompt to enable push — same floating style as the no-gas banner.
 * Dismiss hides it for several hours, then it can resurface.
 */
export function EnableNotificationsBanner() {
  const { address, authenticated } = useAuth();
  const { isLowGas } = useHasGas();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !authenticated || !address) {
      setVisible(false);
      return;
    }
    if (isDismissedRecently()) {
      setVisible(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const state = await getPushSupportState();
        if (cancelled) return;
        if (state.state === "unsupported") {
          setVisible(false);
          return;
        }
        if (state.state === "needs_permission") {
          // Browser already blocked — Settings is the only path.
          if (state.permission === "denied") {
            setVisible(false);
            return;
          }
          setVisible(true);
          return;
        }
        // ready — only prompt if not subscribed yet
        setVisible(!state.subscribed);
      } catch {
        if (!cancelled) setVisible(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, authenticated, address]);

  const handleDismiss = useCallback(() => {
    markDismissed();
    setVisible(false);
    setError(null);
  }, []);

  const handleEnable = useCallback(async () => {
    if (!address || busy) return;
    setBusy(true);
    setError(null);
    try {
      await subscribeToWebPush(address);
      setVisible(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't enable notifications.";
      // If they denied in the browser prompt, hide until cooldown / Settings.
      if (/not granted|denied/i.test(message)) {
        markDismissed();
        setVisible(false);
        return;
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [address, busy]);

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      role="status"
      className={cn(
        "fixed left-1/2 z-[90] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2",
        // Sit above the no-gas banner when both can show.
        isLowGas
          ? "bottom-40 lg:bottom-24 lg:left-auto lg:right-6 lg:translate-x-0"
          : "bottom-24 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0",
        "flex items-start gap-2.5 rounded-xl border border-delulu-blue/25 bg-delulu-blue/10 px-4 py-3 shadow-lg backdrop-blur-sm",
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
    >
      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-delulu-blue" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-foreground">
          Turn on notifications so you don&apos;t miss campaign reminders and rewards.
        </p>
        {error ? (
          <p className="mt-1 text-[11px] text-destructive">{error}</p>
        ) : null}
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-delulu-blue px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
            Enable
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={busy}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={busy}
        className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>,
    document.body,
  );
}
