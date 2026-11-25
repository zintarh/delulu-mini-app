"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Fuel, Loader2, Send, ShieldCheck } from "lucide-react";
import { COMMUNITY_TELEGRAM_URL } from "@/lib/support";
import { Turnstile, TURNSTILE_SITE_KEY, type TurnstileHandle } from "@/components/turnstile";
import { COMFORT_BALANCE_CELO } from "@/lib/faucet/rules";
import { requestGasTopup } from "@/lib/faucet/request-client";
import { gasReasonMessage, type GasRequestReason } from "@/lib/faucet/rules";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";

const IdentityFlow = dynamic(() => import("@/app/(main)/daily-claim/IdentityFlow"), { ssr: false });

interface NoGasModalProps {
  open: boolean;
  /** Why the silent top-up didn't send, if we already tried. */
  reason: string | null;
  onClose: () => void;
  /** The drip was accepted. Close and stop nagging while the balance catches up. */
  onClaimed?: () => void;
}

type TopupState = "idle" | "claiming" | "sent" | "rejected" | "error";

/** Asking again can work: a fresh captcha, a calmer network, or a moment's wait. */
const RETRYABLE = new Set([
  "gas_too_high",
  "in_flight",
  "send_failed",
  "unavailable",
  "captcha_required",
  "captcha_failed",
]);
/** Only a face check gets past these today. */
const NEEDS_FACE_CHECK = new Set(["not_eligible", "ip_limit", "subnet_limit", "blocked"]);
/** Shown as-is when the silent try already hit them, so the first tap isn't wasted. */
const KNOWN_REASONS = new Set<string>([...NEEDS_FACE_CHECK, "sent_out", "stage_cap", "daily_budget", "faucet_empty", "paused"]);

export function NoGasModal({ open, reason, onClose, onClaimed }: NoGasModalProps) {
  const [topupState, setTopupState] = useState<TopupState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
  const [needsFaceCheck, setNeedsFaceCheck] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  useEffect(() => {
    if (!open) return;
    const known = reason && KNOWN_REASONS.has(reason) ? reason : null;
    setTopupState(known ? "rejected" : "idle");
    setMessage(known ? gasReasonMessage(known as GasRequestReason) : null);
    setRetryable(!known || RETRYABLE.has(known));
    setNeedsFaceCheck(!!known && NEEDS_FACE_CHECK.has(known));
    setVerifying(false);
  }, [open, reason]);

  const claim = useCallback(
    (opts?: { afterFaceCheck?: boolean }) => {
      if (topupState === "claiming") return;
      // A face-verified wallet skips the captcha on the server.
      if (TURNSTILE_SITE_KEY && !captchaToken && !opts?.afterFaceCheck) {
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
          setNeedsFaceCheck(NEEDS_FACE_CHECK.has(data.reason ?? "") && !opts?.afterFaceCheck);
        })
        .catch(() => {
          setTopupState("error");
          setMessage("Couldn't reach the faucet. Try again.");
        })
        .finally(() => turnstileRef.current?.reset());
    },
    [topupState, captchaToken, onClaimed],
  );

  const onVerified = useCallback(() => {
    setVerifying(false);
    setNeedsFaceCheck(false);
    claim({ afterFaceCheck: true });
  }, [claim]);

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

          {verifying ? (
            <IdentityFlow open={verifying} onOpenChange={setVerifying} onVerified={onVerified} inline />
          ) : null}

          <div className="space-y-2.5">
            {needsFaceCheck && !verifying ? (
              <button
                type="button"
                onClick={() => setVerifying(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-delulu-charcoal bg-delulu-yellow-reserved py-3.5 text-sm font-extrabold text-delulu-charcoal shadow-[3px_3px_0px_0px_#1a1a19] transition-all hover:brightness-95 active:scale-[0.99]"
              >
                <ShieldCheck className="h-4 w-4" /> Verify my face
              </button>
            ) : null}
            {showClaim && !needsFaceCheck && !verifying ? (
              <button
                type="button"
                onClick={() => claim()}
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

            {/* Last resort when the claim didn't go through: someone in the group sends gas. */}
            {(topupState === "rejected" || topupState === "error") && !verifying ? (
              <a
                href={COMMUNITY_TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border py-3 text-sm font-bold text-foreground transition-colors hover:bg-muted/50"
              >
                <Send className="h-4 w-4" /> Ask for gas on Telegram
              </a>
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
