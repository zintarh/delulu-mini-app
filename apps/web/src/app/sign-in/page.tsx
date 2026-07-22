"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWeb3Auth, useWeb3AuthConnect } from "@web3auth/modal/react";
import { AUTH_CONNECTION, WALLET_CONNECTORS } from "@web3auth/modal";
import { usePrivy } from "@privy-io/react-auth";
import { normalizeCommunityCode, peekCommunityReferral, persistCommunityReferral } from "@/lib/auth-redirect";
import { usePostAuthRoute } from "@/hooks/use-post-auth-route";
import { ClaimPanelContent } from "@/components/claim-panel-content";
import { useDebouncedEmailProvider } from "@/hooks/use-debounced-email-provider";
import { getEmailValidationMessage, isValidEmail, normalizeEmail, emailLooksComplete } from "@/lib/email-validation";
import { cn } from "@/lib/utils";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { authenticated } = useAuth();
  const { isInitialized } = useWeb3Auth();
  const { connect, connectTo } = useWeb3AuthConnect();
  const { login: privyLogin, ready: privyReady } = usePrivy();

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

  const [skippedUbiClaim, setSkippedUbiClaim] = useState(false);
  const { routeState, address, isCheckingAccount, refreshGoodDollarStatus } =
    usePostAuthRoute({ skipUbiGate: skippedUbiClaim });

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

  if (authenticated && routeState === "needs_ubi_claim") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-delulu-blue-light to-white p-6">
        <div className="w-full max-w-md space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="h-12 w-12 rounded-2xl" />
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground">
                Claim your first Good Dollars
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Verify your identity to claim free G$ — then we&apos;ll set up your profile. Takes just a couple of minutes.
              </p>
            </div>
          </div>

          <div className="flex flex-col rounded-3xl border border-border/80 bg-card shadow-lg overflow-hidden">
            <ClaimPanelContent
              onClose={() => {}}
              showCloseButton={false}
              onWhitelisted={() => void refreshGoodDollarStatus()}
            />
          </div>

          <button
            type="button"
            onClick={() => setSkippedUbiClaim(true)}
            className="mx-auto block py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // ── Sign-in form ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-delulu-blue-light to-white lg:grid lg:grid-cols-2">
      {/* Left panel — desktop only */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:bg-[#1a1a19] lg:p-12">
        <img src="/bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-black/50 to-[#1a1a19]" />
        <div className="relative z-10 flex items-center gap-2">
          <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="h-9 w-9 rounded-xl" />
          <span className="text-lg font-black text-white" style={{ fontFamily: '"Clash Display", sans-serif' }}>Delulu</span>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-black leading-tight text-white">
            Make your wildest dreams real.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Join campaigns, track milestones, and claim your daily Good Dollar.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-16">
        <div className="mx-auto w-full max-w-[400px] text-center">
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="h-12 w-12 rounded-2xl" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-foreground">
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
            className="mt-8 flex flex-col gap-4 pb-4 text-left"
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
              disabled={isAnyPending || !isInitialized || !privyReady || !isValidEmail(email)}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#1a1a19] bg-delulu-yellow py-3.5 text-[15px] font-extrabold text-[#1a1a19]",
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
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background py-3.5 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLaunchingWalletProvider ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Opening wallet options…</>
              ) : (
                <><Wallet className="h-5 w-5" /> Continue with wallet</>
              )}
            </button>

            {routeError ? <p className="text-center text-sm text-destructive">{routeError}</p> : null}

            {searchParams.get("privyTest") === "1" ? (
              <button
                type="button"
                onClick={() => {
                  setRouteError(null);
                  try {
                    privyLogin();
                  } catch {
                    setRouteError("Couldn't open Privy sign in. Try again.");
                  }
                }}
                disabled={isAnyPending || !privyReady}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-amber-500/60 bg-amber-500/10 py-3 text-[13px] font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Test: Sign in with Privy
              </button>
            ) : null}
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
