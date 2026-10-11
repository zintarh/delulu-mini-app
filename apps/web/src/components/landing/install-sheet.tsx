"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Check, PlusSquare, Share } from "lucide-react";
import { Lulu, Segmented } from "@/components/ds";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

type Platform = "ios" | "android";

/**
 * "Get Delulu" install sheet (design: docs/redesign/screens/Install.dc.html).
 * Bottom sheet on phones, centered card on larger screens.
 */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { canPrompt, prompt, ios, iosSafari, mobile } = useInstallPrompt();
  const [platform, setPlatform] = useState<Platform>("ios");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // Real iOS Safari is the only thing that should land on the manual-steps
    // tab — it's the only browser on the only platform with no install API,
    // full stop. Everything else (Android, desktop, a desktop window just
    // resized/emulated to look like a phone without spoofing the user
    // agent, or an iPhone running Chrome/Firefox instead of Safari) defaults
    // to the "Install now" tab — never wrong to show, worst case it's
    // disabled with a "use the browser menu" fallback, versus actively
    // misleading a non-Safari user with "tap Share in Safari" steps they
    // can't follow in the browser they're actually in.
    setPlatform(iosSafari ? "ios" : "android");
    setOrigin(window.location.host);
  }, [iosSafari]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const steps = [
    { body: <>Tap <b>Share</b> in Safari</>, icon: <Share className="h-[22px] w-[22px] text-blue" strokeWidth={2} /> },
    { body: <b>Add to Home Screen</b>, icon: <PlusSquare className="h-[22px] w-[22px]" strokeWidth={2} /> },
    { body: <>Tap <b>Add</b></>, icon: <Check className="h-[22px] w-[22px] text-green-edge" strokeWidth={2.4} /> },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] animate-sheet-up overflow-hidden rounded-t-[28px] bg-white sm:rounded-[28px]"
      >
        <div className="flex flex-col gap-5 px-5 pb-5 pt-2.5">
          <span className="h-[5px] w-10 self-center rounded-full bg-[#dadad4]" aria-hidden />
          <div className="flex items-center gap-4">
            <Lulu size={64} />
            <div>
              <span className="label-mono text-muted-foreground">Install</span>
              <h2 id="install-title" className="m-0 mt-1 font-display text-[40px] font-extrabold uppercase leading-[0.88]">
                Get Delulu
              </h2>
            </div>
          </div>
          <Segmented<Platform>
            ariaLabel="Your phone"
            value={platform}
            onChange={setPlatform}
            options={[
              { value: "ios", label: "iPhone" },
              { value: "android", label: "Android" },
            ]}
          />
        </div>

        <div className="relative flex flex-col gap-4 border-t-2 border-dashed border-line px-5 pb-7 pt-[22px]">
          <span className="absolute -left-2.5 -top-[11px] h-5 w-5 rounded-full bg-paper" aria-hidden />
          <span className="absolute -right-2.5 -top-[11px] h-5 w-5 rounded-full bg-paper" aria-hidden />

          {!mobile ? (
            <p className="m-0 rounded-2xl bg-paper px-4 py-3 text-sm text-muted-foreground">
              On a computer? Open <b className="text-ink">{origin}</b> on your phone, then:
            </p>
          ) : null}

          {platform === "ios" ? (
            ios && !iosSafari ? (
              <p className="m-0 rounded-2xl bg-paper px-4 py-3 text-sm text-muted-foreground">
                You&apos;re on iPhone, but not in Safari — only Safari can add this to your home screen. Open{" "}
                <b className="text-ink">{origin}</b> in Safari, then follow the steps there.
              </p>
            ) : (
              <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
                {steps.map((s, i) => (
                  <li key={i} className="flex animate-rise items-center gap-4" style={{ animationDelay: `${(i + 1) * 0.1}s` }}>
                    <span className="w-[26px] font-display text-4xl font-extrabold uppercase leading-[0.88]">{i + 1}</span>
                    <span className="flex-1">{s.body}</span>
                    {s.icon}
                  </li>
                ))}
              </ol>
            )
          ) : (
            <>
              <button
                type="button"
                disabled={!canPrompt}
                onClick={() => void prompt().then(onClose)}
                className="press-edge flex h-14 w-full items-center justify-between rounded-2xl bg-ink pl-6 pr-1.5 text-base font-bold text-white shadow-edge-ink disabled:opacity-60"
              >
                Install now
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow text-ink">
                  <ArrowDown className="h-5 w-5" strokeWidth={2.4} />
                </span>
              </button>
              <p className="m-0 text-center text-sm text-muted-foreground">
                No prompt? Chrome menu <b className="text-ink">⋮</b> → <b className="text-ink">Install app</b>
              </p>
            </>
          )}

          <button type="button" onClick={onClose} className="p-3 text-center font-semibold text-muted-foreground">
            Continue in browser
          </button>
        </div>
      </div>
    </div>
  );
}
