"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DeluluShareMenu({
  shareUrl,
  shareTitle,
  creatorHandle,
  variant = "desktop",
}: {
  shareUrl: string;
  shareTitle: string;
  creatorHandle?: string | null;
  variant?: "mobile" | "desktop";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const onX = () => {
    const truncatedTitle =
      shareTitle.length > 100 ? shareTitle.slice(0, 100) + "…" : shareTitle;
    const byLine = creatorHandle ? `@${creatorHandle}` : "someone";
    const body = [
      `${byLine} just staked real money on this 🎯`,
      ``,
      `"${truncatedTitle}"`,
      ``,
      `delusional or actually gonna happen? support them on Delulu 👀`,
    ].join("\n");
    const text = encodeURIComponent(body);
    const url = encodeURIComponent(shareUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer",
    );
    setOpen(false);
  };
  const onLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setOpen(false);
  };
  const onCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const menu = open && (
    <div className="absolute right-0 top-11 z-50 w-44 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onX}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
      >
        <XIcon className="w-4 h-4" />
        Post on X
      </button>
      <button
        type="button"
        onClick={onLinkedIn}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium hover:bg-muted transition-colors border-t border-border"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        LinkedIn
      </button>
      <button
        type="button"
        onClick={onCopy}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium hover:bg-muted transition-colors border-t border-border"
      >
        <Share2 className="w-4 h-4" />
        Copy link
      </button>
    </div>
  );

  if (variant === "mobile") {
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Share"
        >
          {copied ? (
            <span className="text-[11px] font-bold text-[#f6c324]">✓</span>
          ) : (
            <Share2 className="w-5 h-5" />
          )}
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-secondary text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
      >
        <Share2 className="w-4 h-4" />
        {copied ? "Copied!" : "Share"}
      </button>
      {menu}
    </div>
  );
}
