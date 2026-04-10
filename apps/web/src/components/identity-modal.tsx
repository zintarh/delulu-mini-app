"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  Loader2,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
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
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Reset iframe loaded state when modal opens or link changes
  useEffect(() => {
    if (isOpen) setIframeLoaded(false);
  }, [isOpen, fvLink]);

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

  const openInNewTab = () => {
    if (fvLink) window.open(fvLink, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal — tall enough to house the iframe */}
      <div className="relative w-full max-w-lg h-[90dvh] bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#fcff52]/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-foreground" />
            </div>
            <p className="text-sm font-black text-foreground">Verify your identity</p>
          </div>
          <div className="flex items-center gap-1">
            {fvLink && status !== "verified" && (
              <button
                type="button"
                onClick={openInNewTab}
                title="Open in new tab"
                className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Device warning banner — always visible when link is ready */}
        {fvLink && status !== "verified" && (
          <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="flex-1 text-xs text-amber-700 dark:text-amber-400 leading-snug">
              If you see a <span className="font-semibold">new device</span> or <span className="font-semibold">device change</span> error, tap{" "}
              <button
                type="button"
                onClick={openInNewTab}
                className="font-semibold underline underline-offset-2"
              >
                open in new tab
              </button>{" "}
              to complete verification.
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 relative">
          {status === "verified" ? (
            /* ── Success ── */
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-500" />
              <p className="text-base font-black text-foreground">Identity verified!</p>
              <p className="text-xs text-muted-foreground">You can now claim G$.</p>
            </div>

          ) : !fvLink || status === "loading" ? (
            /* ── Generating link ── */
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <img
                src="/gooddollar-logo.png"
                alt="GoodDollar"
                className="w-10 h-10 rounded-full"
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing verification…
              </div>
            </div>

          ) : (
            /* ── iFrame ── */
            <>
              {!iframeLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card z-10">
                  <img
                    src="/gooddollar-logo.png"
                    alt="GoodDollar"
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </div>
                </div>
              )}
              <iframe
                key={fvLink}
                src={fvLink}
                title="GoodDollar identity verification"
                className="w-full h-full border-0"
                allow="camera; microphone; clipboard-write"
                onLoad={() => setIframeLoaded(true)}
              />
            </>
          )}
        </div>

        {/* Footer */}
        {(!fvLink || status === "loading" || status === "verified") && (
          <div className="px-6 py-3 border-t border-border shrink-0">
            <p className="text-[10px] text-center text-muted-foreground">
              Powered by GoodDollar · Privacy-preserving identity verification
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
