"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { hidesBottomNav } from "@/components/main-nav-config";
import { Download, Share, X } from "lucide-react";
import { GameButton, Lulu } from "@/components/ds";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

const DISMISS_KEY = "delulu_install_prompt_dismissed_v1";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * In-app "Add to Home Screen" banner. The native beforeinstallprompt popup
 * is suppressed in ServiceWorkerRegister; install state comes from the
 * shared useInstallPrompt store (also used by the landing install sheet).
 * Android/Chrome gets a real install button; iOS Safari gets instructions.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const { canPrompt, prompt, iosSafari, standalone } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  // The landing page has its own install sheet; the create flow stays uncluttered.
  if (dismissed || standalone || (["/", "/sign-in", "/welcome"].includes(pathname ?? "") || hidesBottomNav(pathname ?? ""))) return null;
  if (!canPrompt && !iosSafari) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(var(--mobile-bottom-nav-bar)+24px)] z-[110] flex items-start gap-3 rounded-[20px] border-2 border-line bg-white p-3.5 shadow-edge sm:inset-x-auto sm:right-4 sm:w-80 lg:bottom-6">
      <Lulu size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-tight">Install Delulu</p>
        {canPrompt ? (
          <>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">Opens full-screen, with proof reminders.</p>
            <GameButton
              size="sm"
              className="mt-2"
              onClick={async () => {
                await prompt();
                dismiss();
              }}
            >
              <Download className="h-4 w-4" strokeWidth={2.6} />
              Install
            </GameButton>
          </>
        ) : (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Tap <Share className="-mt-0.5 inline h-3 w-3" /> then &quot;Add to Home Screen&quot;.
          </p>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
