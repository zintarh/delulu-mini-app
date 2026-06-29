"use client";

import { useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Copy, Check, Fuel, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TG_GROUP_URL } from "@/components/get-gas-modal";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";

interface NoGasModalProps {
  open: boolean;
  onClose: () => void;
}

type TopupState = "idle" | "claiming" | "sent" | "rejected" | "error";

export function NoGasModal({ open, onClose }: NoGasModalProps) {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);
  const [topupState, setTopupState] = useState<TopupState>("idle");
  const [topupReason, setTopupReason] = useState<string | null>(null);
  const topupCalledRef = useRef(false);

  const handleGetGas = () => {
    if (topupCalledRef.current || topupState === "claiming") return;
    topupCalledRef.current = true;
    setTopupState("claiming");
    fetch("/api/faucet/topup", { method: "POST" })
      .then((r) => r.json())
      .then((data: { success: boolean; reason?: string }) => {
        setTopupState(data.success ? "sent" : "rejected");
        if (!data.success) setTopupReason(data.reason ?? null);
      })
      .catch(() => { setTopupState("error"); topupCalledRef.current = false; });
  };

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent className="max-w-sm p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-6 space-y-5">
          <ModalHeader className="p-0">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30">
                <Fuel className="w-4 h-4 text-amber-600" />
              </span>
              <ModalTitle className="text-lg font-black">Gas fee needed</ModalTitle>
            </div>
            <ModalDescription className="text-sm text-muted-foreground leading-relaxed">
              You need a small amount of CELO to pay transaction fees. Copy your address below and
              top up, or join our Telegram and we&apos;ll help you out.
            </ModalDescription>
          </ModalHeader>

          {/* Address + copy */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Your address
            </p>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!address}
              className={cn(
                "w-full flex items-center justify-between gap-3 rounded-xl border bg-secondary/60 px-4 py-3.5 text-left transition-all",
                "hover:bg-secondary active:scale-[0.99]",
                copied ? "border-emerald-500/40 bg-emerald-500/10" : "border-border",
              )}
            >
              <span className="font-mono text-xs text-foreground break-all leading-relaxed">
                {address ?? "Not connected"}
              </span>
              {copied ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4 shrink-0 text-muted-foreground" />
              )}
            </button>
            {copied && (
              <p className="text-[11px] text-emerald-600 font-medium">Address copied!</p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            {/* Auto top-up button — shown unless rejected for abuse (low_nonce) */}
            {topupState === "sent" ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                0.3 CELO sent — retry your transaction in a moment.
              </div>
            ) : topupReason === "low_nonce" ? null : (
              <button
                type="button"
                onClick={handleGetGas}
                disabled={topupState === "claiming"}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-delulu-charcoal bg-delulu-yellow-reserved py-3.5 text-sm font-black text-delulu-charcoal shadow-[3px_3px_0px_0px_#1a1a19] hover:brightness-95 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {topupState === "claiming" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Getting your gas…</>
                ) : (
                  <>⚡ Get gas automatically</>
                )}
              </button>
            )}

            {/* Contextual message after rejection */}
            {topupState === "rejected" && topupReason === "too_soon" ? (
              <p className="text-center text-xs text-muted-foreground">You received gas recently. Join Telegram if you need more.</p>
            ) : topupState === "rejected" && topupReason === "ip_rate_exceeded" ? (
              <p className="text-center text-xs text-muted-foreground">Daily limit reached. Try again tomorrow.</p>
            ) : topupState === "error" ? (
              <p className="text-center text-xs text-muted-foreground">Couldn&apos;t reach the faucet. Try Telegram below.</p>
            ) : null}

            <a
              href={TG_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary py-3 text-sm font-semibold text-foreground hover:bg-secondary/80 transition-colors"
            >
              {/* Telegram icon */}
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
              </svg>
              Join Telegram for help
            </a>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-transparent text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              I&apos;ll top up myself
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
