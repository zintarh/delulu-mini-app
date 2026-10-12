"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  ShieldCheck,
  Loader2,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { isStandalone } from "@/hooks/use-install-prompt";

interface IdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  fvLink: string | null;
  status: "verified" | "not_verified" | "loading" | "error";
  /** Requests a fresh FV link from GoodDollar; resolves to the new link (or null on failure). */
  onRegenerate: () => Promise<string | null>;
  isGeneratingLink?: boolean;
  /** Verified before, but GoodDollar's window lapsed — a quick re-check, not a first-time verification. Adjusts copy only; the flow itself is identical. */
  isLapsed?: boolean;
  /**
   * Renders the same status content as a plain inline block instead of a
   * fixed-overlay modal — no backdrop, no close button, no iframe. Used on
   * the sign-in page, where clicking "Verify" should just open GoodDollar's
   * link in a new tab and show status right there in the page, not pop up
   * another layer on top of it.
   */
  inline?: boolean;
}

export function IdentityModal({
  isOpen,
  onClose,
  fvLink,
  status,
  onRegenerate,
  isGeneratingLink = false,
  isLapsed = false,
  inline = false,
}: IdentityModalProps) {
  // Auto-close on verified (modal presentation only — inline has no "close").
  useEffect(() => {
    if (!inline && status === "verified" && isOpen) {
      const t = setTimeout(onClose, 2000);
      return () => clearTimeout(t);
    }
  }, [inline, status, isOpen, onClose]);

  // Prevent background scroll — not applicable when rendered inline.
  useEffect(() => {
    if (inline) return;
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [inline, isOpen]);

  // Installed as a PWA (standalone display mode) has no tab/window chrome
  // for window.open() to target — it just returns null there and silently
  // does nothing, both for the auto-open below and for a window.open-based
  // "reopen" trick. A real <a> tag the user taps themselves is the one
  // thing that reliably still escapes the standalone shell, so that's the
  // primary path in the "fvLink available" branch below; auto-open and the
  // window.open trick are only attempted in an ordinary browser tab.
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    setStandalone(isStandalone());
  }, []);

  // Auto-open the verification link in a new tab as soon as it's ready —
  // GoodDollar's flow (camera access, device checks) is unreliable inside an
  // iframe, so the tab is the primary path in a normal browser. Guarded by
  // link so it only fires once per generated fvLink, not on every 5s status
  // poll. Skipped entirely when standalone — see above.
  const autoOpenedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !fvLink || status === "verified" || standalone) return;
    if (autoOpenedForRef.current === fvLink) return;
    autoOpenedForRef.current = fvLink;
    window.open(fvLink, "_blank", "noopener,noreferrer");
  }, [isOpen, fvLink, status, standalone]);

  // Requests a brand-new FV link rather than reusing `fvLink` — reopening a
  // link that already failed (e.g. GoodDollar's FVFlowError) or sat around
  // too long just resends the same broken/expired session. onRegenerate
  // updates the caller's fvLink state, so once it resolves this component
  // just re-renders into the "fvLink available" branch with a working link
  // — no window.open needed here at all, so this works in standalone too.
  const handleRefresh = async () => {
    await onRegenerate();
  };

  if (!isOpen) return null;

  const content =
    status === "verified" ? (
      /* ── Success ── */
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <CheckCircle2 className="w-14 h-14 text-emerald-500" />
        <p className="text-base font-extrabold text-foreground">Identity verified!</p>
        <p className="text-xs text-muted-foreground">You can now claim G$.</p>
      </div>
    ) : status === "error" ? (
      /* ── Error ── */
      <div className="flex flex-col items-center justify-center gap-4 text-center px-6 py-10">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Verification couldn&apos;t start
          </p>
          <p className="text-xs text-muted-foreground">
            Please refresh and try again. If it still fails, open verification in a new tab.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={isGeneratingLink}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-60"
        >
          {isGeneratingLink ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Retry
        </button>
      </div>
    ) : status === "loading" ? (
      /* ── Generating link ── */
      <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
        <img src="/gooddollar-logo.png" alt="GoodDollar" className="w-10 h-10 rounded-full" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Preparing verification…
        </div>
      </div>
    ) : !fvLink ? (
      /* ── Missing link fallback ── */
      <div className="flex flex-col items-center justify-center gap-4 text-center px-6 py-10">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Verification link unavailable</p>
          <p className="text-xs text-muted-foreground">
            We couldn&apos;t generate your verification session yet. Retry to continue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={isGeneratingLink}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-60"
        >
          {isGeneratingLink ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Retry
        </button>
      </div>
    ) : (
      /* ── Verifying in a new tab ── */
      <div className="flex flex-col items-center justify-center gap-4 text-center px-6 py-10">
        <img src="/gooddollar-logo.png" alt="GoodDollar" className="w-10 h-10 rounded-full" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {standalone
              ? "Tap below to verify"
              : isLapsed
                ? "Quick re-check opened in a new tab"
                : "Verification opened in a new tab"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isLapsed
              ? "Your last verification expired — this refreshes it, only takes a minute."
              : "Finish it there, then come back here — we'll pick it up automatically."}
          </p>
        </div>
        <a
          href={fvLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Open verification
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Waiting for verification…
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={isGeneratingLink}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-60"
        >
          {isGeneratingLink ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Get a fresh link
        </button>
      </div>
    );

  if (inline) {
    return (
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-lg h-[90dvh] bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-delulu-yellow/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-foreground" />
            </div>
            <p className="text-sm font-extrabold text-foreground">
              {isLapsed ? "Quick re-verify" : "Verify your identity"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {fvLink && status !== "verified" && (
              <a
                href={fvLink}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab"
                className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 relative flex flex-col justify-center">{content}</div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border shrink-0">
          <p className="text-[10px] text-center text-muted-foreground">
            Powered by GoodDollar · Privacy-preserving identity verification
          </p>
        </div>
      </div>
    </div>
  );
}
