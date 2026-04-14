"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Modal, ModalContent } from "@/components/ui/modal";

export const TG_GROUP_URL = "https://t.me/+96pLkvSh0I4wZThk";

export function GetGasModal({
  open,
  onOpenChange,
  address,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        showClose
        className="max-w-sm w-[calc(100%-1.5rem)] p-0 overflow-hidden rounded-3xl bg-card border border-border"
      >
        <div className="px-6 pt-6 pb-5 space-y-4">
          <div>
            <h2 className="text-base font-black text-foreground">You need gas to continue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Send your address in the Telegram group and we'll send you CELO for gas.
            </p>
          </div>

          {/* Address + copy */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <span className="flex-1 text-xs font-mono text-foreground break-all">{address}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>

          <a
            href={TG_GROUP_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#fcff52] text-[#111111] font-black text-sm border-2 border-[#1A1A1A] shadow-[2px_2px_0px_0px_#1A1A1A] hover:opacity-90 active:translate-y-px transition-all"
          >
            Join Telegram group
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            I already have gas
          </button>
        </div>
      </ModalContent>
    </Modal>
  );
}
