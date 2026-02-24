"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Sparkles,
  ExternalLink,
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

  // Auto-close if status becomes verified while modal is open
  useEffect(() => {
    if (status === "verified" && isOpen) {
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  }, [status, isOpen, onClose]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl h-[85vh] bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-800 dark:text-white">
                Human Verification
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-white transition-all active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 relative bg-neutral-50 dark:bg-[#0a0a0b]">
          {status === "verified" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6">
                <Sparkles size={48} />
              </div>
              <h3 className="text-2xl font-black mb-2 text-neutral-800 dark:text-white">
                Identity Confirmed! ✨
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 font-medium max-w-sm">
                You are now a verified Focuser. Your Dinosaur is safe and your
                G$ rewards are unlocking...
              </p>
            </div>
          ) : fvLink ? (
            <div className="w-full h-full flex flex-col">
              <div className="flex-1 relative">
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest text-center px-6">
                      Initializing Secure Face Verification...
                    </span>
                  </div>
                )}
                <iframe
                  src={fvLink}
                  className={`w-full h-full border-0 transition-opacity duration-1000 ${
                    iframeLoaded ? "opacity-100" : "opacity-0"
                  }`}
                  onLoad={() => setIframeLoaded(true)}
                  allow="camera"
                />
              </div>

              {/* Fallback Footer */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border-t border-indigo-100/50 dark:border-indigo-900/30 flex items-center justify-between gap-4">
                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                  Having trouble with the camera?
                </p>
                <a
                  href={fvLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-4 py-2 rounded-xl text-[10px] font-black shadow-sm border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50 transition-all"
                >
                  Open in New Tab
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-neutral-900">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full animate-pulse" />
                <ShieldAlert className="w-16 h-16 text-amber-500 relative z-10" />
              </div>
              <h3 className="text-xl font-black mb-2 text-neutral-800 dark:text-white">
                Synchronizing Portal...
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-xs mb-8 font-medium leading-relaxed">
                We&apos;re establishing a secure connection to the GoodDollar
                Identity protocol. This ensures your verification is private
                and tamper-proof.
              </p>
              <div className="flex flex-col gap-4 w-full max-w-[200px]">
                <button
                  onClick={onRefresh}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Loader2 size={14} className="animate-spin" />
                  Retry Connection
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-2xl text-xs font-bold hover:bg-neutral-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Warning */}
        <div className="px-8 py-4 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-center gap-2">
          <p className="text-[12px] font-bold text-neutral-400 dark:text-neutral-500 tracking-tight">
            Delulu integrates with GoodDollar for decentralized,
            privacy-focused identity verification
          </p>
        </div>
      </div>
    </div>
  );
}
