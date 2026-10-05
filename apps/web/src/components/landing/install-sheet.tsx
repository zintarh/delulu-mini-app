"use client";

import { useEffect, useState } from "react";
import { Download, PlusSquare, Share, X } from "lucide-react";
import { GameButton, Lulu, Segmented } from "@/components/ds";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

type Platform = "ios" | "android" | "desktop";

/** "Get Delulu" install dialog for the landing page (iPhone / Android / Computer). */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { canPrompt, prompt, ios, mobile } = useInstallPrompt();
  const [platform, setPlatform] = useState<Platform>("ios");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setPlatform(ios ? "ios" : mobile ? "android" : "desktop");
    setOrigin(window.location.host);
  }, [ios, mobile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const step = (n: number, body: React.ReactNode, icon?: React.ReactNode) => (
    <li className="flex animate-bounce-in items-center gap-3.5 rounded-2xl border-2 border-line bg-white px-3.5 py-3 shadow-edge-sm" style={{ animationDelay: `${n * 0.08}s` }}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow font-display text-lg font-extrabold shadow-[0_3px_0_#c99a0a]">{n}</span>
      <span className="flex-1">{body}</span>
      {icon}
    </li>
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[440px] animate-sheet-up flex-col gap-5 rounded-[28px] border-2 border-line bg-white p-7 shadow-[0_8px_0_#e6e6e0]"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-ink">
              <Lulu size={46} />
            </span>
            <div>
              <h2 id="install-title" className="m-0 text-2xl font-extrabold">Get Delulu</h2>
              <div className="mt-0.5 text-sm text-muted-foreground">Free · opens like an app</div>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="press-edge flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white shadow-edge-sm">
            <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
        </div>

        <Segmented<Platform>
          ariaLabel="Your device"
          value={platform}
          onChange={setPlatform}
          options={[
            { value: "ios", label: "iPhone" },
            { value: "android", label: "Android" },
            { value: "desktop", label: "Computer" },
          ]}
        />

        {platform === "ios" && (
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {step(1, <>Open in <b>Safari</b></>)}
            {step(2, <>Tap <b>Share</b></>, <Share className="h-[22px] w-[22px] text-blue" strokeWidth={2.2} />)}
            {step(3, <b>Add to Home Screen</b>, <PlusSquare className="h-[22px] w-[22px]" strokeWidth={2.2} />)}
          </ol>
        )}

        {platform === "android" && (
          <div className="flex flex-col gap-3.5">
            <GameButton full size="lg" disabled={!canPrompt} onClick={() => void prompt().then(onClose)}>
              <Download className="h-5 w-5" strokeWidth={2.6} />
              Install now
            </GameButton>
            <p className="m-0 text-center text-sm text-muted-foreground">
              No prompt? Chrome menu <b className="text-ink">⋮</b> → <b className="text-ink">Install app</b>
            </p>
          </div>
        )}

        {platform === "desktop" && (
          <div className="rounded-2xl bg-paper p-4">
            <div className="text-lg font-extrabold">Open it on your phone</div>
            <div className="mt-1.5 text-sm text-muted-foreground">
              Visit <b className="text-ink">{origin}</b> in your phone&apos;s browser, then install from there.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
