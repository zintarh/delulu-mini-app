"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Loader2, Mail, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWeb3Auth, useWeb3AuthConnect } from "@web3auth/modal/react";
import { AUTH_CONNECTION, WALLET_CONNECTORS } from "@web3auth/modal";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { TG_GROUP_URL } from "@/components/get-gas-modal";
import { normalizeCommunityCode, peekCommunityReferral, persistCommunityReferral } from "@/lib/auth-redirect";
import { usePostAuthRoute } from "@/hooks/use-post-auth-route";
import { useDebouncedEmailProvider } from "@/hooks/use-debounced-email-provider";
import { getEmailValidationMessage, isValidEmail, normalizeEmail, emailLooksComplete } from "@/lib/email-validation";
import { cn } from "@/lib/utils";
import { establishWalletSession } from "@/lib/auth/establish-wallet-session-client";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { authenticated } = useAuth();
  const { isInitialized, provider: web3authProvider } = useWeb3Auth();
  const { connect, connectTo } = useWeb3AuthConnect();
  const { login: privyLogin, ready: privyReady } = usePrivy();
  const { wallets: privyWallets } = useWallets();

  const communityCode = normalizeCommunityCode(searchParams.get("community"));
  const [referralCode, setReferralCode] = useState<string | null>(communityCode);
  const [communityName, setCommunityName] = useState<string | null>(null);
  const [isLoadingCommunityName, setIsLoadingCommunityName] = useState(false);

  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const {
    isChecking: isCheckingEmail,
    resolveForSubmit,
  } = useDebouncedEmailProvider(email);

  const [isLaunchingEmailProvider, setIsLaunchingEmailProvider] = useState(false);
  const [isLaunchingWalletProvider, setIsLaunchingWalletProvider] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const { routeState, address, refetchBalance, isCheckingAccount } = usePostAuthRoute();

  // Faucet state — auto-triggered when routeState === "needs_gas"
  type FaucetState = "idle" | "claiming" | "claimed" | "rejected" | "error" | "tx_timeout";
  const [faucetState, setFaucetState] = useState<FaucetState>("idle");
  const [faucetReason, setFaucetReason] = useState<string | null>(null);
  const faucetCalledRef = useRef(false);
  // Rejection reasons the user can act on (show blocking card).
  // Everything else auto-redirects after 2s.
  const ACTIONABLE_REASONS = new Set(["already_received_wallet", "already_received_email", "ip_rate_exceeded", "insufficient_faucet_funds"]);

  // Dropped-tx watchdog: if we've been in "claimed" for 3 minutes with no
  // CELO arriving, the transaction was likely dropped on-chain. Show the
  // blocking card so the user can reach out via Telegram instead of waiting forever.
  useEffect(() => {
    if (faucetState !== "claimed") return;
    const t = setTimeout(() => setFaucetState("tx_timeout"), 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, [faucetState]);

  const normalizedEmail = normalizeEmail(email);
  const emailValidationError = getEmailValidationMessage(email);
  const showEmailError =
    Boolean(emailValidationError) &&
    (emailTouched || submitAttempted || emailLooksComplete(email)) &&
    email.trim().length > 0;

  const isEmailPending = isCheckingEmail || isLaunchingEmailProvider;
  const isAnyPending = isEmailPending || isLaunchingWalletProvider;

  // Community referral
  useEffect(() => {
    if (communityCode) persistCommunityReferral(communityCode);
    setReferralCode(communityCode ?? peekCommunityReferral());
  }, [communityCode]);

  useEffect(() => {
    if (!referralCode) { setCommunityName(null); setIsLoadingCommunityName(false); return; }
    let cancelled = false;
    setIsLoadingCommunityName(true);
    void (async () => {
      try {
        const res = await fetch(`/api/community/validate-code?code=${encodeURIComponent(referralCode)}`);
        const json = (await res.json()) as { valid?: boolean; community?: { name?: string } };
        if (cancelled) return;
        setCommunityName(res.ok && json.valid ? (json.community?.name ?? null) : null);
      } catch { if (!cancelled) setCommunityName(null); }
      finally { if (!cancelled) setIsLoadingCommunityName(false); }
    })();
    return () => { cancelled = true; };
  }, [referralCode]);

  // Auto-claim faucet when needs_gas — fires once per page load.
  // Web3Auth: uses web3authProvider directly.
  // Privy: finds the embedded wallet from useWallets() and gets its EIP-1193 provider.
  // In both cases, establishWalletSession() deduplicates with WalletSessionBootstrap
  // so no extra signing prompt is shown when the session is already in-flight.
  useEffect(() => {
    if (!authenticated || routeState !== "needs_gas" || faucetCalledRef.current) return;
    if (!address) return;

    const privyWallet = privyWallets.find(
      (w) => w.walletClientType === "privy" || w.walletClientType === "privy-v2",
    );

    // Wait until whichever provider is active has loaded
    if (!web3authProvider && !privyWallet) return;

    faucetCalledRef.current = true;
    setFaucetState("claiming");

    const run = async () => {
      if (web3authProvider) {
        const ok = await establishWalletSession(address, web3authProvider as {
          request: (args: { method: string; params: unknown[] }) => Promise<string>;
        });
        if (!ok) { setFaucetState("error"); return; }
      } else if (privyWallet) {
        const ethProvider = await privyWallet.getEthereumProvider();
        const ok = await establishWalletSession(privyWallet.address as `0x${string}`, {
          request: (args: { method: string; params: unknown[] }) =>
            ethProvider.request(args) as Promise<string>,
        });
        if (!ok) { setFaucetState("error"); return; }
      }

      const r = await fetch("/api/faucet/claim", { method: "POST" });
      if (!r.ok) { setFaucetState("error"); return; }
      const data = (await r.json()) as { success: boolean; reason?: string };
      setFaucetState(data.success ? "claimed" : "rejected");
      if (!data.success) setFaucetReason(data.reason ?? null);
    };

    run().catch(() => setFaucetState("error"));
  }, [authenticated, routeState, address, web3authProvider, privyWallets]);

  // Gas polling — detects when CELO lands and advances to /welcome
  useEffect(() => {
    if (routeState !== "needs_gas") return;
    const id = setInterval(() => void refetchBalance(), 10000);
    return () => clearInterval(id);
  }, [routeState, refetchBalance]);

  // Redirect silently after 2s for non-actionable faucet rejections only.
  // "error" and "tx_timeout" now show blocking cards so users are never stuck.
  useEffect(() => {
    const isActionableRejection = faucetState === "rejected" && ACTIONABLE_REASONS.has(faucetReason ?? "");
    const isNonActionableRejection = faucetState === "rejected" && !isActionableRejection;
    if (!isNonActionableRejection) return;
    const t = setTimeout(() => router.replace("/welcome"), 2000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faucetState, faucetReason, router]);

  const triggerEmailAuth = async (targetEmail: string) => {
    if (!isInitialized) {
      setRouteError("Sign-in is still loading. Wait a moment and try again.");
      return;
    }
    await connectTo(WALLET_CONNECTORS.AUTH, {
      authConnection: AUTH_CONNECTION.EMAIL_PASSWORDLESS,
      loginHint: targetEmail,
      extraLoginOptions: { login_hint: targetEmail },
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmailTouched(true);
    setSubmitAttempted(true);
    if (!isValidEmail(email) || isAnyPending) return;

    setRouteError(null);
    setIsLaunchingEmailProvider(true);
    try {
      // Check DB to see if this email belongs to an existing Privy account.
      const detectedProvider = await resolveForSubmit();
      if (detectedProvider === "privy") {
        // Existing Privy user — open Privy modal so they keep their original address.
        privyLogin();
      } else {
        // New user or Web3Auth user — use Web3Auth email OTP.
        await triggerEmailAuth(normalizedEmail);
      }
    } catch (err) {
      setRouteError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't open email sign in. Try again.",
      );
    } finally {
      setIsLaunchingEmailProvider(false);
    }
  };

  const handleWalletConnect = async () => {
    setRouteError(null);
    if (isAnyPending) return;
    setIsLaunchingWalletProvider(true);
    try {
      if (!isInitialized) {
        setRouteError("Sign-in is still loading. Wait a moment and try again.");
        return;
      }
      await connect();
    } catch {
      setRouteError("Couldn't open wallet connection. Try again.");
    } finally {
      setIsLaunchingWalletProvider(false);
    }
  };

  // ── Authenticated states ──────────────────────────────────────────────────

  if (authenticated && (isCheckingAccount || routeState === "loading" || routeState === "redirecting_home" || routeState === "redirecting_welcome")) {
    const label =
      routeState === "redirecting_welcome" ? "Setting up your profile…"
      : routeState === "redirecting_home"  ? "Welcome back…"
      : "Checking your account…";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="h-12 w-12 rounded-2xl opacity-90" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {label}
        </div>
      </div>
    );
  }

  if (authenticated && routeState === "needs_gas") {
    // "error" and "tx_timeout" are now actionable — show blocking cards.
    // Only non-actionable rejections keep the spinner + silent redirect.
    const isActionableRejection =
      faucetState === "rejected" && ACTIONABLE_REASONS.has(faucetReason ?? "");
    const isNonActionableRejection = faucetState === "rejected" && !isActionableRejection;
    const showSpinner =
      faucetState === "idle" || faucetState === "claiming" || faucetState === "claimed" || isNonActionableRejection;

    if (showSpinner) {
      const label =
        faucetState === "claimed"
          ? "Gas sent! Waiting for confirmation…"
          : isNonActionableRejection
            ? "Getting you started…"
            : "Getting your gas… this takes a few seconds";
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
          <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="h-12 w-12 rounded-2xl opacity-90" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {label}
          </div>
        </div>
      );
    }

    // Blocking card — all actionable states land here:
    // - rejected (known reason): already_received, ip_limit, faucet_empty
    // - error: faucet API returned 500 (retry makes sense)
    // - tx_timeout: gas was "sent" but never confirmed after 3 min (tx likely dropped)
    const isAlreadyReceived =
      faucetReason === "already_received_wallet" || faucetReason === "already_received_email";
    const isIpLimit = faucetReason === "ip_rate_exceeded";
    const isFaucetEmpty = faucetReason === "insufficient_faucet_funds";
    const isTxTimeout = faucetState === "tx_timeout";
    const isServerError = faucetState === "error";

    const title = isAlreadyReceived
      ? "Gas already received"
      : isIpLimit
        ? "Daily limit reached"
        : isFaucetEmpty
          ? "Faucet being refilled"
          : isTxTimeout
            ? "Transaction taking too long"
            : "Something went wrong";

    const description = isAlreadyReceived
      ? "This address or email has already been funded. Join our Telegram if you need more CELO."
      : isIpLimit
        ? "We limit faucet requests per network to prevent abuse. Try again tomorrow or join Telegram."
        : isFaucetEmpty
          ? "Our gas faucet is temporarily empty. Join our Telegram group and we'll send you CELO manually so you can complete setup."
          : isTxTimeout
            ? "Your gas transaction was submitted but hasn't confirmed after 3 minutes — it may have been dropped. Copy your address and message us on Telegram so we can send it manually."
            : "We hit an error while getting your gas. You can try again or reach out on Telegram for help.";

    const shortAddress = address
      ? `${address.slice(0, 6)}…${address.slice(-4)}`
      : null;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-border/80 bg-card p-6 shadow-lg">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>

          {shortAddress && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(address);
                setCopiedAddress(true);
                setTimeout(() => setCopiedAddress(false), 2000);
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm transition-colors hover:bg-muted/70"
            >
              <span className="font-mono text-xs text-muted-foreground">{shortAddress}</span>
              <span className={cn("flex items-center gap-1.5 text-xs font-semibold", copiedAddress ? "text-emerald-600" : "text-foreground")}>
                {copiedAddress ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedAddress ? "Copied!" : "Copy address"}
              </span>
            </button>
          )}

          <a href={TG_GROUP_URL} target="_blank" rel="noreferrer"
            className="flex w-full items-center justify-center rounded-2xl border border-foreground/90 bg-foreground py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
          >
            Join Telegram group
          </a>
          {isServerError && (
            <button
              type="button"
              onClick={() => {
                faucetCalledRef.current = false;
                setFaucetState("idle");
              }}
              className="w-full rounded-2xl border border-border py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
            >
              Try again
            </button>
          )}
          <button type="button" onClick={() => void refetchBalance()}
            className="w-full py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            I have gas — check again
          </button>
        </div>
      </div>
    );
  }

  // ── Sign-in form ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* Left panel — desktop only */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:bg-[#1a1a19] lg:p-12">
        <img src="/bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-black/50 to-[#1a1a19]" />
        <div className="relative z-10 flex items-center gap-2">
          <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="h-9 w-9 rounded-xl" />
          <span className="text-lg font-black text-white" style={{ fontFamily: '"Clash Display", sans-serif' }}>Delulu</span>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-black leading-tight text-white" style={{ fontFamily: '"Clash Display", sans-serif' }}>
            Make your wildest dreams real.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Join campaigns, track milestones, and claim your daily Good Dollar.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-16">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="h-12 w-12 rounded-2xl" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-foreground" style={{ fontFamily: '"Clash Display", sans-serif' }}>
            Sign in or create account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Use email or your wallet — new accounts are created automatically.
          </p>

          {referralCode ? (
            <div className="mt-4 rounded-xl border border-delulu-blue/30 bg-delulu-blue-light px-3 py-2.5 text-xs text-delulu-blue">
              {isLoadingCommunityName ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Looking up community…
                </span>
              ) : communityName ? (
                <>You&apos;re joining <span className="font-bold">{communityName} community</span>. We&apos;ll confirm your invite after profile setup.</>
              ) : (
                <>You&apos;re joining a community. We&apos;ll confirm your code after profile setup.</>
              )}
            </div>
          ) : null}

          <form
            noValidate
            onSubmit={(e) => void handleSubmit(e)}
            className="mt-8 flex flex-col gap-3"
          >
            <div>
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3.5 transition-colors",
                  showEmailError
                    ? "border-rose-300 bg-rose-50/50 focus-within:border-rose-400"
                    : email.trim()
                      ? "border-foreground/25 bg-background focus-within:border-foreground/40"
                      : "border-border bg-muted/30",
                )}
              >
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (routeError) setRouteError(null);
                  }}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="Email address"
                  autoComplete="email"
                  autoFocus={false}
                  aria-invalid={showEmailError}
                  aria-describedby={showEmailError ? "email-error" : undefined}
                  className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
                  disabled={isAnyPending}
                />
              </div>
              {showEmailError ? (
                <p id="email-error" className="mt-1.5 px-1 text-xs text-rose-500">
                  {emailValidationError}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={isAnyPending || (!isInitialized && !privyReady) || !isValidEmail(email)}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1a1a19] bg-[#f6c324] py-3.5 text-[15px] font-extrabold text-[#1a1a19]",
                "shadow-[3px_3px_0px_0px_#1a1a19] transition-all hover:translate-x-[1px] hover:translate-y-[1px]",
                "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-[3px_3px_0px_0px_#1a1a19] disabled:translate-x-0 disabled:translate-y-0",
              )}
            >
              {isCheckingEmail ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Checking your account…</>
              ) : isLaunchingEmailProvider ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Starting secure sign in…</>
              ) : (
                <><Mail className="h-5 w-5" /> Continue with email</>
              )}
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <p className="relative mx-auto w-fit bg-background px-2 text-xs text-muted-foreground">or</p>
            </div>

            <button
              type="button"
              onClick={() => void handleWalletConnect()}
              disabled={isAnyPending || !isInitialized}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3.5 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLaunchingWalletProvider ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Opening wallet options…</>
              ) : (
                <><Wallet className="h-5 w-5" /> Continue with wallet</>
              )}
            </button>

            {routeError ? <p className="text-center text-sm text-destructive">{routeError}</p> : null}
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <a href="/terms" className="underline underline-offset-2 hover:text-foreground">terms of service</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
