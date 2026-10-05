"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const HOLD_MS = 1200;

/**
 * Press-and-hold confirm ("Hold to sign"). Yellow fills the button while
 * held; releasing early cancels. Keyboard users (Enter/Space → click with
 * detail 0) sign immediately.
 */
export function HoldToSign({
  onComplete,
  disabled = false,
  busy = false,
  busyLabel,
  label = "Hold to sign",
  className,
}: {
  onComplete: () => void;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  label?: string;
  className?: string;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const start = () => {
    if (disabled || busy) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      onComplete();
    }, HOLD_MS);
  };

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onClick={(e) => {
        if (e.detail === 0 && !disabled && !busy) onComplete();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative h-16 w-full touch-none select-none overflow-hidden rounded-2xl bg-ink font-extrabold uppercase tracking-[0.06em] text-white shadow-edge-ink",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 origin-left bg-yellow"
        style={{
          transform: `scaleX(${holding ? 1 : 0})`,
          transition: `transform ${holding ? HOLD_MS : 250}ms ${holding ? "linear" : "ease-out"}`,
        }}
      />
      <span className={cn("relative flex items-center justify-center gap-2.5", holding && "text-ink")}>
        {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Lock className="h-[18px] w-[18px]" strokeWidth={2.4} />}
        {busy ? busyLabel ?? "Signing…" : holding ? "Keep holding…" : label}
      </span>
    </button>
  );
}
