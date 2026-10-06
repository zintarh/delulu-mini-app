"use client";

import { usePathname } from "next/navigation";
import { hidesBottomNav } from "@/components/main-nav-config";

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
/** After a successful enable, never soft-prompt again on this browser. */
const DONE_KEY = "delulu_push_prompt_done_v1";
/** After dismiss, wait this long before showing again. */
const DISMISS_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode
  }
}

function isDismissedRecently(): boolean {
  const raw = readStorage(DISMISS_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < DISMISS_COOLDOWN_MS;
}

function markDismissed() {
  writeStorage(DISMISS_KEY, String(Date.now()));
}

function isPromptDone(): boolean {
  return readStorage(DONE_KEY) === "1";
}

function markPromptDone() {
  writeStorage(DONE_KEY, "1");
}

/**
 * Soft prompt to enable push — same floating style as the no-gas banner.
 * Only shown when the browser has never decided (permission === "default").
 * If permission is already granted, we never nag — we silently repair the
 * subscription if needed (common after hard refresh / SW race on desktop).
 */
export function EnableNotificationsBanner() {
  const { address, authenticated } = useAuth();
  const { isLowGas } = useHasGas();
  const [mounted, setMounted] = useState(false);
  // Focused screens (contract, campaign, settings…) have no dock and their own bottom action.
  const focusedScreen = hidesBottomNav(usePathname() ?? "");
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
    if (isPromptDone() || isDismissedRecently()) {
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
          // permission === "default" — soft prompt is appropriate
          setVisible(true);
          return;
        }

        // permission already granted — never soft-prompt again.
        // If the PushManager subscription is missing (SW race / cleared),
        // quietly re-register instead of showing "Enable" again.
        markPromptDone();
        setVisible(false);
        if (!state.subscribed) {
          try {
            await subscribeToWebPush(address);
          } catch {
            // Best-effort repair; Settings can still toggle manually.
          }
        }
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
      markPromptDone();
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

  if (!mounted || !visible || focusedScreen) return null;

  return createPortal(
    <div
      role="status"
      className={cn(
        "fixed inset-x-3 z-[90] sm:inset-x-auto sm:right-4 sm:w-80 lg:right-6",
        // Sit above the dock (and above the no-gas banner when both show).
        isLowGas
          ? "bottom-[calc(var(--mobile-bottom-nav-bar)+96px)] lg:bottom-24"
          : "bottom-[calc(var(--mobile-bottom-nav-bar)+24px)] lg:bottom-6",
        "flex items-start gap-3 rounded-[20px] border-2 border-line bg-white p-3.5 shadow-edge",
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow text-ink shadow-[0_3px_0_#c99a0a]">
        <Bell className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-tight text-foreground">Never miss a deadline</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">Get a nudge before your proof is due.</p>
        {error ? (
          <p className="mt-1 text-[11px] font-semibold text-orange">{error}</p>
        ) : null}
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={busy}
            className="press-edge inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 text-xs font-extrabold uppercase tracking-[0.06em] text-white shadow-[0_3px_0_#000] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
            Enable
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={busy}
            className="px-1 text-xs font-bold text-muted-foreground hover:text-foreground"
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
