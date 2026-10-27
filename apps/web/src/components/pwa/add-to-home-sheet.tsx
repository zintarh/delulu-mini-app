"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, EllipsisVertical, ExternalLink, Loader2, MonitorDown, Share, SquarePlus } from "lucide-react";
import { GameButton, gameButtonClass, Lulu } from "@/components/ds";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { detectDevice, type Device } from "@/lib/add-to-home";

function StepRow({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex animate-rise items-center gap-4" style={{ animationDelay: `${n * 0.08}s` }}>
      <span className="w-[22px] font-display text-3xl font-extrabold leading-none">{n}</span>
      <span className="flex-1 text-[15px]">{children}</span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper">{icon}</span>
    </li>
  );
}

/**
 * "Add Delulu to your home screen" — one sheet for every device:
 * Chrome's own dialog when it offers one, Share → Add to Home Screen on
 * iPhone, the ⋮ menu on other Android browsers, and "open in your browser"
 * from inside WhatsApp/Instagram (their browsers can't do it at all).
 * Bottom sheet on phones, centered card on larger screens.
 */
export function AddToHomeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { canPrompt, prompt } = useInstallPrompt();
  const [device, setDevice] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDevice(detectDevice());
    setCopied(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !device) return null;

  const addNow = async () => {
    setBusy(true);
    const outcome = await prompt();
    setBusy(false);
    if (outcome === "accepted") onClose();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const browser = device.ios ? "Safari" : "Chrome";
  // Android can jump straight from an in-app browser to Chrome; iPhone can't.
  const chromeIntent = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end`;
  const iconCls = "h-5 w-5";
  // Manual steps end with "Got it"; one-tap and copy-link flows don't need it.
  let manual = true;
  let body: ReactNode;

  if (device.inApp) {
    manual = false;
    body = (
      <>
        <p className="m-0 text-center text-sm text-muted-foreground">
          {device.inApp}&apos;s browser can&apos;t do this. Open Delulu in <b className="text-ink">{browser}</b>, then
          add it from there.
        </p>
        {device.android ? (
          <a href={chromeIntent} className={gameButtonClass({ variant: "ink", full: true })}>
            <ExternalLink className="h-4 w-4" strokeWidth={2.4} />
            Open in Chrome
          </a>
        ) : null}
        <GameButton variant={device.android ? "line" : "ink"} full onClick={() => void copyLink()}>
          {copied ? <Check className="h-4 w-4" strokeWidth={2.6} /> : <Copy className="h-4 w-4" strokeWidth={2.4} />}
          {copied ? "Link copied" : "Copy link"}
        </GameButton>
      </>
    );
  } else if (canPrompt) {
    manual = false;
    body = (
      <GameButton variant="ink" full disabled={busy} onClick={() => void addNow()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SquarePlus className="h-4 w-4" strokeWidth={2.4} />}
        Add to home screen
      </GameButton>
    );
  } else if (device.ios) {
    body = (
      <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
        <StepRow n={1} icon={<Share className={`${iconCls} text-blue`} />}>
          Tap <b>Share</b>
          {device.iosNonSafari ? " in the address bar" : ""}
        </StepRow>
        <StepRow n={2} icon={<SquarePlus className={iconCls} />}>
          Tap <b>Add to Home Screen</b>
        </StepRow>
        <StepRow n={3} icon={<Lulu size={24} />}>
          Open Delulu from your home screen
        </StepRow>
      </ol>
    );
  } else if (device.android) {
    body = (
      <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
        <StepRow n={1} icon={<EllipsisVertical className={iconCls} />}>
          Tap the <b>menu</b> at the top
        </StepRow>
        <StepRow n={2} icon={<SquarePlus className={iconCls} />}>
          Tap <b>Add to home screen</b>
        </StepRow>
        <StepRow n={3} icon={<Lulu size={24} />}>
          Open Delulu from your home screen
        </StepRow>
      </ol>
    );
  } else {
    body = (
      <div className="flex items-center gap-4 rounded-2xl bg-paper px-4 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
          <MonitorDown className={`${iconCls} text-ink`} />
        </span>
        <p className="m-0 text-sm text-muted-foreground">
          Click this icon at the right end of your <b className="text-ink">address bar</b>
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-home-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] animate-sheet-up overflow-hidden rounded-t-[28px] bg-white sm:rounded-[28px]"
      >
        <div className="flex flex-col items-center gap-3 px-5 pb-5 pt-2.5 text-center">
          <span className="h-[5px] w-10 rounded-full bg-[#dadad4]" aria-hidden />
          <Lulu size={64} />
          <div>
            <h2 id="add-to-home-title" className="m-0 text-[22px] font-extrabold leading-tight">
              Add Delulu to your home screen
            </h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground">Opens full-screen, like an app.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t-2 border-dashed border-line px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-5">
          {body}
          {manual ? (
            <GameButton variant="ink" full onClick={onClose}>
              Got it
            </GameButton>
          ) : null}
          <button type="button" onClick={onClose} className="p-2 text-center text-sm font-semibold text-muted-foreground">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
