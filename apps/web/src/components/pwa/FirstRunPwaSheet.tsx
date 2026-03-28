"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Download, Share2 } from "lucide-react";
import { Modal, ModalContent } from "@/components/ui/modal";

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mountedRef = useRef(true);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installing, setInstalling] = useState(false);

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

  useEffect(() => {
    if (!open) return;
  }, [open]);

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

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        showClose
        className={cn(
          "max-w-xl w-[calc(100%-1.5rem)] p-0 overflow-hidden rounded-3xl",
          "bg-secondary border border-border",
        )}
      >
        <div className="flex flex-col h-full bg-secondary">
          <div className="px-6 pt-5 pb-4 border-b border-border/70">
            <h2 className="text-lg font-black text-foreground">Quick setup</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add Delulu to Home Screen.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {!standalone && (
              <div className="rounded-3xl border border-border bg-card px-5 py-4 shadow-neo-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-blue-500" />
                      <p className="text-sm font-black text-foreground">Add to Home Screen</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Best on mobile.</p>
                  </div>
                  {canInstallButton ? (
                    <button
                      type="button"
                      onClick={handleInstall}
                      disabled={installing}
                      className={cn(
                        "shrink-0 px-4 py-2 rounded-full text-xs font-black",
                        "bg-foreground text-background border border-border",
                        "shadow-neo-sm active:translate-y-[1px]",
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
      </ModalContent>
    </Modal>
  );
}

