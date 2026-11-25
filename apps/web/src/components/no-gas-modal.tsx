"use client";

import { useEffect, useRef, useState } from "react";
import { Fuel, Loader2 } from "lucide-react";
import { Turnstile, TURNSTILE_SITE_KEY, type TurnstileHandle } from "@/components/turnstile";
import { COMFORT_BALANCE_CELO } from "@/lib/faucet/rules";
import { requestGasTopup } from "@/lib/faucet/request-client";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";

interface NoGasModalProps {
  open: boolean;
  /** Why the silent top-up didn't finish, if we already tried. */
  notice: string | null;
  onClose: () => void;
  /** The drip was accepted. Close and stop nagging while the balance catches up. */
  onClaimed?: () => void;
}

type TopupState = "idle" | "claiming" | "sent" | "rejected" | "error";

const RETRYABLE = new Set([
  "gas_too_high",
  "in_flight",
  "send_failed",
  "unavailable",
  "captcha_required",
  "captcha_failed",
]);

export function NoGasModal({ open, notice, onClose, onClaimed }: NoGasModalProps) {
  const [topupState, setTopupState] = useState<TopupState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  useEffect(() => {
    if (!open) return;
    setTopupState("idle");
    setMessage(notice);
    setRetryable(true);
  }, [open, notice]);

  const handleClaim = () => {
    if (topupState === "claiming") return;
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setMessage("One moment — checking you're human.");
      return;
    }
    setTopupState("claiming");
    setMessage(null);
    void requestGasTopup(captchaToken)
      .then((data) => {
        if (data.success) {
          onClaimed?.();
          return;
        }
        setTopupState("rejected");
        setMessage(data.message ?? "Couldn't send gas right now. Try again.");
        setRetryable(RETRYABLE.has(data.reason ?? ""));
      })
      .catch(() => {
        setTopupState("error");
        setMessage("Couldn't reach the faucet. Try again.");
      })
      .finally(() => turnstileRef.current?.reset());
  };

  const showClaim = topupState !== "sent" && !(topupState === "rejected" && !retryable);

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent className="max-w-sm overflow-hidden p-0">
        <div className="space-y-5 px-6 pb-6 pt-6">
          <ModalHeader className="p-0">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15">
                <Fuel className="h-4 w-4 text-orange" />
              </span>
              <ModalTitle className="text-lg font-extrabold">You ran out of gas</ModalTitle>
            </div>
            <ModalDescription className="text-sm leading-relaxed text-muted-foreground">
              Claim about {COMFORT_BALANCE_CELO} CELO. It lands in your wallet and you can continue.
            </ModalDescription>
          </ModalHeader>

          {message ? <p className="m-0 text-center text-sm font-semibold text-foreground">{message}</p> : null}
          <Turnstile ref={turnstileRef} onToken={setCaptchaToken} />

          <div className="space-y-2.5">
            {showClaim ? (
              <button
                type="button"
                onClick={handleClaim}
                disabled={topupState === "claiming"}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-delulu-charcoal bg-delulu-yellow-reserved py-3.5 text-sm font-extrabold text-delulu-charcoal shadow-[3px_3px_0px_0px_#1a1a19] transition-all hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {topupState === "claiming" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Claiming gas…
                  </>
                ) : (
                  "Claim gas"
                )}
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-transparent py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
