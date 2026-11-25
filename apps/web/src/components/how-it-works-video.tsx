"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CLIP = "/how-it-works/clip";

type ClipSound = "click" | "stamp" | "climb" | "whoosh" | "chime";

let audio: AudioContext | null = null;

function audioContext() {
  if (!audio) audio = new AudioContext();
  return audio;
}

/** Short sounds for the clip. Started from the Watch click so the browser allows them. */
function playClipSound(name: ClipSound) {
  const ctx = audioContext();
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime;
  const tone = (freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  if (name === "click") tone(220, 0.06, "square", 0.08, 90);
  if (name === "stamp") tone(520, 0.09, "triangle", 0.1, 180);
  if (name === "climb") {
    tone(440, 0.12, "sine", 0.08, 660);
    tone(660, 0.16, "sine", 0.06, 990);
  }
  if (name === "whoosh") {
    const len = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(2200, t + 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t);
  }
  if (name === "chime") {
    tone(880, 0.18, "sine", 0.09);
    tone(1320, 0.28, "sine", 0.06);
  }
}

/** The clip, in a modal over the page. Portaled so a scrolling page can't drag it down. */
export function HowItWorksVideo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onSound = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const name = e.data?.type === "delulu-clip-sound" ? e.data.name : null;
      if (name === "click" || name === "stamp" || name === "climb" || name === "whoosh" || name === "chime") playClipSound(name);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onSound);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onSound);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-ink/60 p-4 sm:p-10" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How Delulu works"
        className="flex h-[min(760px,88dvh)] w-full max-w-[400px] flex-col overflow-hidden rounded-[28px] bg-ink shadow-edge-ink"
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
    </div>,
    document.body,
  );
}

/** Opens the clip. Same control on Home, How to earn, and sign-in. */
export function WatchHowItWorks({ className, label = "Watch the video" }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const ctx = audioContext();
          void ctx.resume();
          setOpen(true);
        }}
        className={cn("press-edge inline-flex items-center gap-2 text-left font-extrabold", className)}
      >
        <span className="flex h-8 w-11 shrink-0 items-center justify-center rounded-[8px] bg-[#ff0033] text-white shadow-[0_3px_0_#9d0020]" aria-hidden>
          <Play className="h-4 w-4 translate-x-[1px] fill-current" strokeWidth={0} />
        </span>
        {label}
      </button>
      <HowItWorksVideo open={open} onClose={() => setOpen(false)} />
    </>
  );
}
