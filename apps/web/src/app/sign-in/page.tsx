"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useBalance, useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Mail, Wallet } from "lucide-react";
import { DELULU_ABI } from "@/lib/abi";
import { CELO_MAINNET_ID, DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "@privy-io/react-auth";
import { useWeb3AuthConnect } from "@web3auth/modal/react";
import { WALLET_CONNECTORS } from "@web3auth/modal";
import { TG_GROUP_URL } from "@/components/get-gas-modal";

type ProfileProvider = "privy" | "web3auth" | null;
type EmailCheckResponse = {
  taken: boolean;
  auth_provider: ProfileProvider;
};

function pickProvider(input: EmailCheckResponse): "privy" | "web3auth" {
  if (input.taken && input.auth_provider === "privy") return "privy";
  if (input.taken && input.auth_provider === "web3auth") return "web3auth";
  return "web3auth";
}

export default function SignInPage() {
  const router = useRouter();
  const { authenticated, isReady, address, login } = useAuth();
  const { login: privyLogin } = useLogin();
  const { connect, connectTo } = useWeb3AuthConnect();
  const [email, setEmail] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isLaunchingEmailProvider, setIsLaunchingEmailProvider] =
    useState(false);
  const [isLaunchingWalletProvider, setIsLaunchingWalletProvider] =
    useState(false);
  const [resolvedProvider, setResolvedProvider] = useState<ProfileProvider>(null);
  const [resolvedEmail, setResolvedEmail] = useState<string>("");
  const [routeError, setRouteError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const isEmailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail),
    [normalizedEmail],
  );
  const isEmailPending = isChecking || isLaunchingEmailProvider;
  const isWalletPending = isLaunchingWalletProvider;
  const isAnyPending = isEmailPending || isWalletPending;
  const isEmailRouterEnabled =
    process.env.NEXT_PUBLIC_SIGNIN_EMAIL_ROUTER_V1 !== "false";

  const { data: username, isFetching } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: { enabled: !!authenticated && !!address, staleTime: 0, gcTime: 0 },
  });
  const { data: celoBalance, isLoading: isBalanceLoading, refetch: refetchBalance } = useBalance(
    {
      address,
      chainId: CELO_MAINNET_ID,
      query: { enabled: !!authenticated && !!address },
    },
  );
  const hasProfile =
    typeof username === "string" && username.trim().length > 0;
  const hasGas = (celoBalance?.value ?? 0n) > 0n;
  const safeAddress = address ?? "";

  useEffect(() => {
    if (!isReady || !authenticated || !address || isFetching || isBalanceLoading) return;
    if (hasProfile) {
      router.replace("/");
      return;
    }
    if (hasGas) {
      router.replace("/welcome");
    }
  }, [
    isReady,
    authenticated,
    address,
    isFetching,
    isBalanceLoading,
    hasProfile,
    hasGas,
    router,
  ]);

  const checkEmailRoute = async (
    value: string,
  ): Promise<EmailCheckResponse> => {
    const response = await fetch(
      `/api/profile/check-email?email=${encodeURIComponent(value)}`,
    );
    if (!response.ok) {
      throw new Error("Couldn’t start sign in. Try again.");
    }
    return (await response.json()) as EmailCheckResponse;
  };

  // Pre-resolve provider while user types, so submit remains a single-click flow.
  useEffect(() => {
    setResolvedProvider(null);
    setResolvedEmail("");
    if (!isEmailRouterEnabled || !isEmailValid) return;

    const timer = setTimeout(async () => {
      try {
        const result = await checkEmailRoute(normalizedEmail);
        setResolvedProvider(pickProvider(result));
        setResolvedEmail(normalizedEmail);
      } catch {
        // Silent: submit path will still handle errors.
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [isEmailRouterEnabled, isEmailValid, normalizedEmail]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRouteError(null);
    if (!isEmailValid || isAnyPending) return;

    setIsLaunchingEmailProvider(true);
    try {
      const provider =
        isEmailRouterEnabled &&
        resolvedProvider &&
        resolvedEmail === normalizedEmail
          ? resolvedProvider
          : isEmailRouterEnabled
            ? pickProvider(await checkEmailRoute(normalizedEmail))
            : "web3auth";

      if (provider === "privy") {
        await privyLogin({
          disableSignup: true,
          prefill: { type: "email", value: normalizedEmail },
        });
      } else {
        // Single-click Web3Auth connect with loginHint.
        await connectTo(WALLET_CONNECTORS.AUTH, {
          authConnection: "email_passwordless",
          loginHint: normalizedEmail,
        });
      }
    } catch {
      // Keep graceful fallback for environments where AUTH connectTo may reject.
      try {
        login();
      } catch {
        setRouteError("Couldn’t start sign in. Try again.");
      }
    } finally {
      setIsChecking(false);
      setIsLaunchingEmailProvider(false);
    }
  };

  const handleWalletContinue = () => {
    setRouteError(null);
    if (isAnyPending) return;
    setIsLaunchingWalletProvider(true);
    connect()
      .catch(() => {
        setRouteError("Couldn’t open wallet connection. Try again.");
      })
      .finally(() => {
        setIsLaunchingWalletProvider(false);
      });
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (authenticated) {
    if (isFetching || isBalanceLoading) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
          <img
            src="/favicon_io/android-chrome-192x192.png"
            alt="Delulu"
            className="w-12 h-12 rounded-2xl opacity-90"
          />
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking your account…
          </div>
        </div>
      );
    }

    if (!hasProfile && !hasGas) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-border/80 bg-card/95 p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] backdrop-blur space-y-5">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">You need gas to continue</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Join our Telegram group to receive CELO gas. After you get gas, come back and refresh this page.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-muted/30 px-3 py-3">
              <span className="flex-1 text-xs font-mono text-foreground break-all">
                {safeAddress}
              </span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(safeAddress);
                    setCopiedAddress(true);
                    setTimeout(() => setCopiedAddress(false), 2000);
                  } catch {}
                }}
                className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                {copiedAddress ? (
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
              className="flex items-center justify-center w-full py-3 rounded-2xl bg-foreground text-background font-semibold text-sm border border-foreground/90 shadow-sm hover:opacity-90 transition-opacity"
            >
              Join Telegram group
            </a>

            <button
              type="button"
              onClick={() => {
                refetchBalance();
                window.location.reload();
              }}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Refresh this page after receiving gas
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <img
          src="/favicon_io/android-chrome-192x192.png"
          alt="Delulu"
          className="w-12 h-12 rounded-2xl opacity-90"
        />
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Signing in…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[360px] flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/favicon_io/android-chrome-192x192.png"
            alt="Delulu"
            className="w-14 h-14 rounded-2xl"
          />
          <h1
            className="text-4xl font-black text-white"
            style={{
              textShadow:
                "3px 3px 0px #1A1A1A, -2px -2px 0px #1A1A1A, 2px -2px 0px #1A1A1A, -2px 2px 0px #1A1A1A",
            }}
          >
            Delulu
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Make your wildest dreams real.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <div className="w-full rounded-2xl border border-border bg-background/80 px-4 py-3.5 transition-colors focus-within:border-foreground/40 focus-within:bg-background">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/80"
              disabled={isAnyPending}
            />
          </div>

          <button
            type="submit"
            disabled={!isEmailValid || isAnyPending}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl
              bg-[#fcff52] text-[#111111] font-extrabold text-[15px]
              border-2 border-[#1A1A1A] shadow-[3px_3px_0px_0px_#1A1A1A]
              hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_#1A1A1A]
              active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all
              disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0"
          >
            {isEmailPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isChecking
                  ? "Checking your account…"
                  : "Starting secure sign in…"}
              </>
            ) : (
              <>
                <Mail className="w-5 h-5" />
                Continue with email
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground">or</p>

          <button
            type="button"
            onClick={handleWalletContinue}
            disabled={isAnyPending}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl
              bg-transparent text-foreground font-semibold text-[15px] border border-border
              hover:bg-muted/40 active:bg-muted/60 transition-all
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isWalletPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Opening wallet options…
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                Continue with wallet
              </>
            )}
          </button>

          {routeError ? (
            <p className="text-center text-sm text-rose-500">{routeError}</p>
          ) : null}
          {!isEmailValid && email.length > 0 ? (
            <p className="text-center text-xs text-muted-foreground">
              Enter a valid email to continue.
            </p>
          ) : null}
        </form>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
