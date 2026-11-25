"use client";

import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CLIP = "/how-it-works/clip";

/** Plays the short how-it-works clip in the page. The iframe stays inside the app. */
export function HowItWorksVideo({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-10" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How Delulu works"
        className="flex h-[100dvh] w-full max-w-[400px] flex-col overflow-hidden bg-ink sm:h-[min(760px,88dvh)] sm:rounded-[28px] sm:shadow-edge-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 text-white">
          <p className="m-0 text-sm font-extrabold">How it works</p>
          <button type="button" onClick={onClose} className="press-edge flex h-8 w-8 items-center justify-center rounded-full bg-white/10" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <iframe title="How Delulu works" src={CLIP} className="min-h-0 w-full flex-1 border-0 bg-[#f6f3e8]" />
      </div>
    </div>
  );
}

/** Opens the clip. Same control on Home and How to earn. */
export function WatchHowItWorks({ className, label = "Watch the video" }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("press-edge inline-flex items-center gap-2 text-left font-extrabold", className)}>
        <span className="flex h-8 w-11 shrink-0 items-center justify-center rounded-[8px] bg-[#ff0033] text-white shadow-[0_3px_0_#9d0020]" aria-hidden>
          <Play className="h-4 w-4 translate-x-[1px] fill-current" strokeWidth={0} />
        </span>
        {label}
      </button>
      <HowItWorksVideo open={open} onClose={() => setOpen(false)} />
    </>
  );
}
