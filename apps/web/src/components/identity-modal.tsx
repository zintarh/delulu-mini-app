"use client";

import React, { useEffect, useRef } from "react";
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
  /** Requests a fresh FV link from GoodDollar; resolves to the new link (or null on failure). */
  onRegenerate: () => Promise<string | null>;
  isGeneratingLink?: boolean;
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

  // Only for the auto-open effect below, which always has a just-generated
  // (guaranteed-fresh) link. Every manual retry/reopen goes through
  // handleReopen instead — see its comment for why.
  const openInNewTab = () => {
    if (fvLink) window.open(fvLink, "_blank", "noopener,noreferrer");
  };

  // Auto-open the verification link in a new tab as soon as it's ready —
  // GoodDollar's flow (camera access, device checks) is unreliable inside an
  // iframe, so the tab is the only path, not a fallback. Guarded by link so
  // it only fires once per generated fvLink, not on every 5s status poll.
  const autoOpenedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !fvLink || status === "verified") return;
    if (autoOpenedForRef.current === fvLink) return;
    autoOpenedForRef.current = fvLink;
    openInNewTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fvLink, status]);

  // Every manual "retry"/"reopen" click requests a brand-new FV link rather
  // than reusing `fvLink` — reopening a link that already failed (e.g.
  // GoodDollar's FVFlowError) or sat around too long just resends the same
  // broken/expired session. The blank tab opens synchronously inside the
  // click handler so browsers don't block the later navigation (once the
  // async regenerate resolves) as an unrequested popup.
  const handleReopen = async () => {
    const win = window.open("", "_blank", "noopener,noreferrer");
    const link = await onRegenerate();
    if (win) {
      if (link) win.location.href = link;
      else win.close();
    }
  };

  if (!isOpen) return null;

  const content =
    status === "verified" ? (
      /* ── Success ── */
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <CheckCircle2 className="w-14 h-14 text-emerald-500" />
        <p className="text-base font-black text-foreground">Identity verified!</p>
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
          onClick={() => void handleReopen()}
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
          onClick={() => void handleReopen()}
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
            Verification opened in a new tab
          </p>
          <p className="text-xs text-muted-foreground">
            Finish it there, then come back here — we&apos;ll pick it up automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Waiting for verification…
        </div>
        <button
          type="button"
          onClick={() => void handleReopen()}
          disabled={isGeneratingLink}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-60"
        >
          {isGeneratingLink ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ExternalLink className="w-3.5 h-3.5" />
          )}
          Reopen the link
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
            <p className="text-sm font-black text-foreground">Verify your identity</p>
          </div>
          <div className="flex items-center gap-1">
            {fvLink && status !== "verified" && (
              <button
                type="button"
                onClick={() => void handleReopen()}
                disabled={isGeneratingLink}
                title="Open in new tab"
                className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                {isGeneratingLink ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
              </button>
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
