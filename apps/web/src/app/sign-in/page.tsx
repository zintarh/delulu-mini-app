"use client";

import { useEffect } from "react";
import { useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { useAuth } from "@/hooks/use-auth";
import { usePrivy } from "@privy-io/react-auth";

const LAST_PROVIDER_KEY = "delulu:last_provider";

export default function SignInPage() {
  const router = useRouter();
  const { authenticated, isReady, address, login } = useAuth();
  const { login: privyLogin } = usePrivy();

  // Single source of truth: does this address have an on-chain profile?
  const { data: username, isFetching } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: { enabled: !!authenticated && !!address, staleTime: 0, gcTime: 0 },
  });

  // Route once we have a confirmed, fresh response from the contract.
  useEffect(() => {
    if (!isReady || !authenticated || !address || isFetching) return;
    const hasProfile = typeof username === "string" && username.trim().length > 0;
    router.replace(hasProfile ? "/" : "/welcome");
  }, [isReady, authenticated, address, isFetching, username, router]);

  const handleReturningUser = () => {
    let lastProvider = "privy";
    try { lastProvider = localStorage.getItem(LAST_PROVIDER_KEY) ?? "privy"; } catch {}
    lastProvider === "web3auth" ? login() : privyLogin({ disableSignup: true });
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (authenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="w-12 h-12 rounded-2xl opacity-90" />
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
          <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="w-14 h-14 rounded-2xl" />
          <h1
            className="text-4xl font-black text-white"
            style={{ textShadow: "3px 3px 0px #1A1A1A, -2px -2px 0px #1A1A1A, 2px -2px 0px #1A1A1A, -2px 2px 0px #1A1A1A" }}
          >
            Delulu
          </h1>
          <p className="text-sm text-muted-foreground text-center">Make your wildest dreams real.</p>
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl
              bg-[#fcff52] text-[#111111] font-black text-base
              border-2 border-[#1A1A1A] shadow-[4px_4px_0px_0px_#1A1A1A]
              hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_#1A1A1A]
              active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            <Mail className="w-5 h-5" />
            Get Started
          </button>

          <button
            onClick={handleReturningUser}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl
              bg-transparent text-foreground font-bold text-base border-2 border-border
              hover:bg-muted/40 active:bg-muted/60 transition-all"
          >
            I already have an account
          </button>

          <a
            href="https://t.me/+96pLkvSh0I4wZThk"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl
              bg-[#229ED9] text-white font-bold text-base hover:opacity-90 active:opacity-80 transition-opacity"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Join our Telegram
          </a>
        </div>

        <p className="text-center text-xs text-muted-foreground">By continuing you agree to our terms of service.</p>
      </div>
    </div>
  );
}
