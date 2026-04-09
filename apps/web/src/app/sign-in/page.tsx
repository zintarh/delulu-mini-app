"use client";

import { useEffect, useState, useRef } from "react";
import { usePrivy, useLoginWithEmail, useLogin, useWallets, useModalStatus } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "entry" | "otp";

const OTP_LENGTH = 6;

function OtpInput({
  value,
  onChange,
  onComplete,
  error,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (code: string) => void;
  error: boolean;
  disabled: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split("").concat(Array(OTP_LENGTH).fill("")).slice(0, OTP_LENGTH);

  const focus = (i: number) => refs.current[i]?.focus();

  const handleChange = (i: number, char: string) => {
    const d = char.replace(/\D/g, "").slice(-1);
    const next = digits.map((v, idx) => (idx === i ? d : v)).join("").slice(0, OTP_LENGTH);
    onChange(next);
    if (d && i < OTP_LENGTH - 1) focus(i + 1);
    if (next.length === OTP_LENGTH && next.split("").every(Boolean)) onComplete(next);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = digits.map((v, idx) => (idx === i ? "" : v)).join("");
        onChange(next);
      } else if (i > 0) {
        focus(i - 1);
        const next = digits.map((v, idx) => (idx === i - 1 ? "" : v)).join("");
        onChange(next);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      focus(i - 1);
    } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
      focus(i + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    onChange(pasted);
    focus(Math.min(pasted.length, OTP_LENGTH - 1));
    if (pasted.length === OTP_LENGTH) onComplete(pasted);
  };

  return (
    <div className="flex gap-2.5 justify-between">
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digits[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          className={cn(
            "w-full aspect-square rounded-xl text-center text-lg font-bold text-foreground",
            "bg-muted/50 outline-none transition-all",
            "border focus:border-foreground focus:bg-background focus:shadow-sm",
            error ? "border-rose-500" : "border-transparent",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            digits[i] ? "border-foreground/20 bg-background" : ""
          )}
        />
      ))}
    </div>
  );
}

export default function SignInPage() {
  const { authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();

  const [step, setStep] = useState<Step>("entry");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const authSettledRef = useRef(false);

  // If already authenticated, hand off to /welcome which will sort out routing
  useEffect(() => {
    if (!ready) return;
    if (authenticated) {
      router.replace("/welcome");
    }
  }, [ready, authenticated, router]);

  const { sendCode, loginWithCode } = useLoginWithEmail({
    onComplete: () => {
      // Privy session is now active — let /welcome do the profile check
      setIsRedirecting(true);
      router.replace("/welcome");
    },
    onError: (err) => {
      if (authSettledRef.current) return;
      setIsVerifying(false);
      setIsSending(false);
      const normalized = String(err ?? "").toLowerCase();
      setError(
        normalized.includes("too_many_requests")
          ? "Too many attempts. Wait a moment."
          : normalized.includes("invalid")
            ? "Invalid code. Please check and try again."
            : "Something went wrong."
      );
    },
  });

  const { login } = useLogin({
    onComplete: () => {
      setIsWalletLoading(false);
      setIsRedirecting(true);
      router.replace("/welcome");
    },
    onError: () => { setIsWalletLoading(false); },
  });

  const { isOpen: isModalOpen } = useModalStatus();

  useEffect(() => {
    if (!isModalOpen && isWalletLoading) {
      setIsWalletLoading(false);
    }
  }, [isModalOpen, isWalletLoading]);

  const handleVerify = async (fullCode: string) => {
    if (isVerifying) return;
    setError(null);
    setIsVerifying(true);
    authSettledRef.current = false;
    try {
      await loginWithCode({ code: fullCode });
    } catch {
      if (!authSettledRef.current) {
        setError("Invalid code. Please check and try again.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setIsSending(true);
    try {
      await sendCode({ email: email.trim() });
      setStep("otp");
    } catch {}
    finally { setIsSending(false); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px] space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/favicon_io/android-chrome-192x192.png"
            alt="Delulu"
            className="w-12 h-12 rounded-xl"
          />
          <h1 className="text-3xl font-black text-foreground">
            Welcome back
          </h1>
        </div>

        <div className="bg-card rounded-2xl p-7 space-y-5 shadow-sm border border-border/50">

          {step === "entry" && (
            <>
              <div>
                <h2 className="text-lg font-bold text-foreground">Continue with your email</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Enter your email to get a code.</p>
              </div>

              <form onSubmit={handleSendCode} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                  required
                  className={cn(
                    "w-full px-4 py-3 rounded-xl bg-muted/50 text-sm text-foreground",
                    "placeholder:text-muted-foreground/50",
                    "border outline-none transition-all",
                    "focus:bg-background focus:shadow-sm",
                    error ? "border-rose-500" : "border-transparent focus:border-border"
                  )}
                />
                {error && <p className="text-xs text-rose-500">{error}</p>}

                <button
                  type="submit"
                  disabled={isSending || !email.trim()}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl",
                    "bg-[#fcff52] text-[#111111] font-bold text-sm",
                    "border-2 border-[#1A1A1A] shadow-[3px_3px_0px_0px_#1A1A1A]",
                    "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#1A1A1A]",
                    "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
                    "disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[3px_3px_0px_0px_#1A1A1A]",
                    "transition-all"
                  )}
                >
                  {isSending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>
                  }
                </button>
              </form>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsWalletLoading(true);
                  try {
                    login({ loginMethods: ["wallet"] });
                  } catch {
                    setIsWalletLoading(false);
                  }
                }}
                disabled={isWalletLoading}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-xl",
                  "bg-muted/50 text-foreground text-sm font-semibold",
                  "border border-transparent hover:border-border hover:bg-muted",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "transition-all"
                )}
              >
                {isWalletLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 12h5v4h-5a2 2 0 010-4z" />
                  </svg>
                )}
                Connect Wallet
              </button>
            </>
          )}

          {step === "otp" && (
            <>
              <div>
                <h2 className="text-lg font-bold text-foreground">Check your inbox</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Code sent to <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <div className="space-y-4">
                <OtpInput
                  value={code}
                  onChange={(v) => { setCode(v); setError(null); }}
                  onComplete={handleVerify}
                  error={!!error}
                  disabled={isVerifying || isRedirecting}
                />
                {error && <p className="text-xs text-rose-500">{error}</p>}

                {(isVerifying || isRedirecting) && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isRedirecting ? "Signing in…" : "Verifying…"}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep("entry");
                  setCode("");
                  setError(null);
                  setIsRedirecting(false);
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Use a different email
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
