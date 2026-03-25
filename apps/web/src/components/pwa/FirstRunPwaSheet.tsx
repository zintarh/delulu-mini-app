"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { Bell, Download, Share2 } from "lucide-react";
import { subscribeToWebPush } from "@/lib/web-push-client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as any;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    nav?.standalone === true
  );
}

export function FirstRunPwaSheet({
  open,
  onOpenChange,
  address,
  isAuthenticated,
  onRequestLogin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address?: `0x${string}` | undefined;
  isAuthenticated: boolean;
  onRequestLogin: () => void;
}) {
  const mountedRef = useRef(true);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installing, setInstalling] = useState(false);
  const [notifWorking, setNotifWorking] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler as any);
    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, []);

  const standalone = useMemo(() => isStandalone(), []);
  const ios = useMemo(() => isIos(), []);

  const canInstallButton = Boolean(installEvent) && !standalone;

  const handleInstall = async () => {
    if (!installEvent) return;
    setInstalling(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice.catch(() => null);
    } finally {
      setInstalling(false);
      setInstallEvent(null);
    }
  };

  const handleEnableNotifications = async () => {
    if (!isAuthenticated) {
      onRequestLogin();
      return;
    }
    if (!address) {
      setNotifError("Connect a wallet to enable reminders.");
      return;
    }
    if (mountedRef.current) {
      setNotifWorking(true);
      setNotifError(null);
    }
    try {
      await subscribeToWebPush(address);
      // Avoid state updates after the sheet is closed/unmounted.
      if (mountedRef.current) {
        setNotifWorking(false);
      }
      onOpenChange(false);
    } catch (e: any) {
      if (mountedRef.current) {
        setNotifError(e?.message ?? "Failed to enable notifications.");
      }
    } finally {
      if (mountedRef.current) {
        setNotifWorking(false);
      }
    }
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title=""
      sheetClassName={cn(
        "border-t border-border max-h-[88vh] overflow-hidden p-0 rounded-t-3xl",
        "bg-secondary/95 backdrop-blur-xl",
        "shadow-[0_24px_80px_rgba(0,0,0,0.75)]",
        "[&>button]:text-foreground [&>button]:bg-transparent [&>button]:hover:bg-muted/60",
      )}
      modalClassName="max-w-xl"
    >
      <div className="flex flex-col h-full bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.10),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.10),_transparent_55%)]">
        <div className="px-6 pt-5 pb-4 border-b border-border/70">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-2">
            Welcome
          </p>
          <h2 className="text-xl font-black text-foreground">
            Get the seamless Delulu experience
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add Delulu to your Home Screen, then enable reminders so you never miss proof deadlines.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {!standalone && (
            <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-background/80 via-background/40 to-background/80 px-5 py-4 shadow-neo-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-blue-500" />
                    <p className="text-sm font-black text-foreground">Add to Home Screen</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Faster launches, full-screen, and iOS push notifications work best when installed.
                  </p>
                </div>
                {canInstallButton ? (
                  <button
                    type="button"
                    onClick={handleInstall}
                    disabled={installing}
                    className={cn(
                      "shrink-0 px-4 py-2 rounded-full text-xs font-black",
                      "bg-delulu-yellow-reserved text-delulu-charcoal border border-delulu-charcoal",
                      "shadow-[2px_2px_0px_0px_#1A1A1A] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#1A1A1A]",
                      installing && "opacity-70 cursor-not-allowed",
                    )}
                  >
                    {installing ? "Installing…" : "Install"}
                  </button>
                ) : (
                  <div className="shrink-0 text-[11px] text-muted-foreground">
                    {ios ? (
                      <span className="inline-flex items-center gap-1">
                        <Share2 className="h-3.5 w-3.5" />
                        Share → Add to Home Screen
                      </span>
                    ) : (
                      <span>Use browser menu → Install</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-background/80 via-background/40 to-background/80 px-5 py-4 shadow-neo-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-black text-foreground">Enable notifications</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  We’ll remind you 30 minutes before proof is due and 30 minutes before your delulu ends.
                </p>
                {notifError ? (
                  <p className="mt-2 text-[11px] text-destructive">{notifError}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={notifWorking}
                className={cn(
                  "shrink-0 px-4 py-2 rounded-full text-xs font-black",
                  "bg-delulu-yellow-reserved text-delulu-charcoal border border-delulu-charcoal",
                  "shadow-[2px_2px_0px_0px_#1A1A1A] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#1A1A1A]",
                  notifWorking && "opacity-70 cursor-not-allowed",
                )}
              >
                {notifWorking ? "Enabling…" : "Enable"}
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/70 flex items-center justify-end gap-3 bg-secondary/95">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-semibold border border-border text-muted-foreground",
              "hover:bg-muted/60 hover:text-foreground transition-colors",
            )}
          >
            Not now
          </button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}

