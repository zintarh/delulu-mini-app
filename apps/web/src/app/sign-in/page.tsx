"use client";

import { useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAccount, useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";

export default function SignInPage() {
  const { authenticated, ready, login, user: privyUser } = usePrivy();
  const { wallets } = useWallets();
  const { address: wagmiAddress } = useAccount();
  const router = useRouter();

  // Resolve address from all available sources
  const privyWalletAddress = (privyUser as any)?.linkedAccounts?.find(
    (a: any) => a.type === "wallet" && a.walletClientType === "privy"
  )?.address as `0x${string}` | undefined;
  const address = wagmiAddress ?? wallets?.[0]?.address as `0x${string}` | undefined ?? privyWalletAddress;

  const { data: existingUsername, isSuccess, isError } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: { enabled: !!authenticated && !!address, staleTime: 0 },
  });

  useEffect(() => {
    if (!ready || !authenticated) return;

    // Still waiting for address or contract response
    if (!address || (!isSuccess && !isError)) return;

    const username = typeof existingUsername === "string" ? existingUsername.trim() : "";
    console.log("[sign-in] address:", address, "| username:", existingUsername, "| isSuccess:", isSuccess, "| isError:", isError);
    if (username.length > 0) {
      // Returning user — go straight home
      router.replace("/");
    } else {
      // New user or no username — profile setup
      router.replace("/welcome");
    }
  }, [ready, authenticated, address, isSuccess, isError, existingUsername, router]);

  // If authenticated but no address yet, redirect to /welcome after a short wait
  // so new users (wallet not created yet) aren't stuck
  useEffect(() => {
    if (!ready || !authenticated || address) return;
    const id = setTimeout(() => router.replace("/welcome"), 4_000);
    return () => clearTimeout(id);
  }, [ready, authenticated, address, router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show spinner while resolving post-auth redirect
  if (authenticated) {
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

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/favicon_io/android-chrome-192x192.png"
            alt="Delulu"
            className="w-14 h-14 rounded-2xl"
          />
          <h1
            className="text-4xl font-black text-white"
            style={{
              textShadow: "3px 3px 0px #1A1A1A, -2px -2px 0px #1A1A1A, 2px -2px 0px #1A1A1A, -2px 2px 0px #1A1A1A",
            }}
          >
            Welcome Back
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Manifest your vision. Let the world support it.
          </p>
        </div>

        {/* CTA */}
        <div className="w-full">
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl
              bg-[#fcff52] text-[#111111] font-black text-base
              border-2 border-[#1A1A1A] shadow-[4px_4px_0px_0px_#1A1A1A]
              hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_#1A1A1A]
              active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
              transition-all"
          >
            <Mail className="w-5 h-5" />
            Continue with email
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
