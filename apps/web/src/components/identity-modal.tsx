"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  Loader2,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface IdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  fvLink: string | null;
  status: "verified" | "not_verified" | "loading" | "error";
  onRefresh: () => void;
}

export function IdentityModal({
  isOpen,
  onClose,
  fvLink,
  status,
  onRefresh,
}: IdentityModalProps) {
  const [opened, setOpened] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) setOpened(false);
  }, [isOpen]);

  // Auto-close on verified
  useEffect(() => {
    if (status === "verified" && isOpen) {
      const t = setTimeout(onClose, 2000);
      return () => clearTimeout(t);
    }
  }, [status, isOpen, onClose]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpen = () => {
    if (!fvLink) return;
    window.open(fvLink, "_blank", "noopener,noreferrer");
    setOpened(true);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#fcff52]/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-foreground" />
            </div>
            <p className="text-sm font-black text-foreground">Verify your identity</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-5">
          {status === "verified" ? (
            /* ── Success ── */
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-base font-black text-foreground">Identity verified!</p>
              <p className="text-xs text-muted-foreground">You can now claim G$.</p>
            </div>

          ) : !fvLink || status === "loading" ? (
            /* ── Generating link ── */
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Preparing verification link…</p>
            </div>

          ) : !opened ? (
            /* ── Ready to open ── */
            <>
              <div className="space-y-1.5">
                <p className="text-sm text-foreground font-semibold">
                  GoodDollar identity check
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  To claim G$, you need to verify you&apos;re a unique human via GoodDollar.
                  The process takes about 1 minute and uses face verification.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">How it works:</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Tap the button below — it opens in a new tab</li>
                  <li>Complete the face scan in that tab</li>
                  <li>Come back here — we&apos;ll detect it automatically</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={handleOpen}
                className="w-full py-3 rounded-xl border-2 border-[#1A1A1A] bg-[#fcff52] text-[#111111] font-black text-sm flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_#1A1A1A] hover:opacity-90 active:translate-y-px transition-all"
              >
                Open verification
                <ExternalLink className="w-4 h-4" />
              </button>
            </>

          ) : (
            /* ── Waiting for completion ── */
            <>
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
                <p className="text-sm font-black text-foreground">Waiting for verification…</p>
                <p className="text-xs text-muted-foreground max-w-[220px]">
                  Complete the face scan in the tab we opened. We&apos;ll continue automatically once done.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleOpen}
                  className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Reopen tab
                </button>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Check now
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <p className="text-[10px] text-center text-muted-foreground">
            Powered by GoodDollar · Privacy-preserving identity verification
          </p>
        </div>
      </div>
    </div>
  );
}
