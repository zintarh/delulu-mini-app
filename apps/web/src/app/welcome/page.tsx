"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetProfile } from "@/hooks/use-set-profile";
import { useUserStore } from "@/stores/useUserStore";
import { usePfpUpload } from "@/hooks/use-pfp-upload";
import { Loader2, ArrowRight, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";

type Phase = "verifying" | "form";

export default function WelcomePage() {
  const { address: wagmiAddress } = useAccount();
  const { ready, authenticated, user: privyUser } = usePrivy();
  const { wallets } = useWallets();


  const privyWalletAddress = (privyUser as any)?.wallet?.address as `0x${string}` | undefined;
  const firstWalletAddress = wallets?.[0]?.address as `0x${string}` | undefined;
  const address = wagmiAddress ?? firstWalletAddress ?? privyWalletAddress;
  const router = useRouter();
  const { updateUsername, updateProfile } = useUserStore();

  const [phase, setPhase] = useState<Phase>("verifying");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pfpUrl, setPfpUrl] = useState<string | null>(null);
  const [pfpPreview, setPfpPreview] = useState<string | null>(null);
  const [walletReadyError, setWalletReadyError] = useState<string | null>(null);
  const [walletTimeout, setWalletTimeout] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [touched, setTouched] = useState({ username: false, pfp: false });
  const savedRef = useRef(false);
  const faucetFiredRef = useRef(false);
  const verificationDoneRef = useRef(false);

  useEffect(() => {
    if (address || phase !== "verifying") return;
    const id = setTimeout(() => setWalletTimeout(true), 30_000);
    return () => clearTimeout(id);
  }, [address, phase]);

  const { setProfile, isPending, isSuccess, error } = useSetProfile();
  const { upload, isUploading, inputRef, openPicker } = usePfpUpload();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) router.replace("/sign-in");
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!privyUser) return;
    const linkedEmail =
      (privyUser as any)?.email?.address ??
      (privyUser as any)?.linkedAccounts?.find((a: any) => a.type === "email")?.address ??
      null;
    if (linkedEmail) setEmail(linkedEmail);
  }, [privyUser]);

  const {
    data: existingUsername,
    isSuccess: usernameChecked,
    isError: usernameCheckFailed,
    isFetching: usernameIsFetching,
    error: usernameCheckError,
    status: usernameCheckStatus,
    fetchStatus: usernameCheckFetchStatus,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: { enabled: !!address, staleTime: 0 },
  });

  
  useEffect(() => {
    if (!address) return;
    if (verificationDoneRef.current) return;

   
    if (usernameIsFetching) return;

    if (!usernameChecked && !usernameCheckFailed) return;

    verificationDoneRef.current = true;

    if (usernameCheckFailed) {
      console.warn("[welcome] contract read failed, showing form as fallback");
      setPhase("form");
      return;
    }

    const existing = typeof existingUsername === "string" ? existingUsername.trim() : "";
    if (existing.length > 0) {
      console.log("[welcome] returning user detected, redirecting to /");
      router.replace("/");
      return;
    }


    if (!faucetFiredRef.current) {
      faucetFiredRef.current = true;
      fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      }).catch(() => {});
    }

    setPhase("form");
  }, [address, usernameChecked, usernameCheckFailed, usernameIsFetching, existingUsername, router]);

  useEffect(() => {
    if (!isSuccess || !address || savedRef.current) return;
    savedRef.current = true;
    const saveToSupabase = async () => {
      setIsSavingProfile(true);
      try {
        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            username: username.trim(),
            email: email.trim() || `${address.toLowerCase()}@wallet.local`,
            pfpUrl: pfpUrl ?? undefined,
          }),
        });
      } catch {}
      const normalizedEmail = email.trim() || `${address.toLowerCase()}@wallet.local`;
      updateUsername(username.trim(), normalizedEmail);
      updateProfile({ email: normalizedEmail, pfpUrl: pfpUrl ?? undefined });
      setIsSavingProfile(false);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem("delulu:new-user", "1");
        } catch {
          // ignore storage errors
        }
      }
      router.replace("/");
    };
    saveToSupabase();
  }, [isSuccess, address, username, email, pfpUrl, updateUsername, updateProfile, router]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPfpPreview(URL.createObjectURL(file));
    setTouched((t) => ({ ...t, pfp: true }));
    try {
      const url = await upload(file);
      setPfpUrl(url);
    } catch {
      setPfpPreview(null);
      setPfpUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, pfp: true });
    if (!username.trim() || !pfpUrl) return;
    if (!address) {
      setWalletReadyError("Finalizing wallet connection. Try again in a moment.");
      return;
    }
    setWalletReadyError(null);
    try {
      await setProfile(username.trim());
    } catch {}
  };

  const isLoading = isPending || isSavingProfile || isSuccess;
  const canSubmit = !!username.trim() && !!pfpUrl && !isLoading && !isUploading;
  const missingPfp = touched.pfp && !pfpUrl && !isUploading;
  const missingUsername = touched.username && !username.trim();


  if (phase === "verifying") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6">
        <img
          src="/favicon_io/android-chrome-192x192.png"
          alt="Delulu"
          className="w-14 h-14 rounded-2xl opacity-90"
        />
        {walletTimeout ? (
          <div className="flex flex-col items-center gap-3 text-center max-w-xs">
            <p className="text-sm font-medium text-foreground">Wallet setup is taking longer than expected</p>
            <p className="text-xs text-muted-foreground">
              This can happen on slow networks. Try refreshing the page — your account is safe.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-1 px-4 py-2 rounded-xl bg-muted text-sm font-semibold text-foreground hover:bg-muted/80 transition-colors"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            Setting up your wallet&hellip;
          </div>
        )}
      </div>
    );
  }

  // ── Phase 2: Pinterest-style profile setup ─────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Top wordmark */}
      <div className="flex justify-center pt-10 pb-2">
        <div className="flex items-center gap-2">
          <img
            src="/favicon_io/android-chrome-192x192.png"
            alt="Delulu"
            className="h-6 w-6 rounded-md"
          />
          <span className="text-sm font-black tracking-tight text-foreground">delulu</span>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">

        {/* Headline */}
        <div className="text-center mb-10 max-w-xs">
          <h1 className="text-[2rem] font-black text-foreground leading-[1.15] tracking-tight">
            Set up your profile
          </h1>
          <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
            Add a photo and choose a username to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-0">

          {/* Avatar — large, prominent */}
          <div className="flex flex-col items-center mb-9">
            <button
              type="button"
              onClick={() => {
                setTouched((t) => ({ ...t, pfp: true }));
                openPicker();
              }}
              disabled={isLoading || isUploading}
              className={cn(
                "relative w-32 h-32 rounded-full overflow-hidden transition-all duration-200",
                "ring-[3px] ring-offset-[4px] ring-offset-background",
                missingPfp
                  ? "ring-rose-500"
                  : pfpPreview
                  ? "ring-[#fcff52]"
                  : "ring-border hover:ring-muted-foreground/60",
              )}
            >
              {pfpPreview ? (
                <img src={pfpPreview} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-muted flex flex-col items-center justify-center gap-1">
                  <Camera className="h-8 w-8 text-muted-foreground/70" />
                </div>
              )}

              {isUploading ? (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className={cn(
              "mt-3 text-xs font-medium",
              missingPfp ? "text-rose-500" : pfpPreview ? "text-muted-foreground" : "text-muted-foreground",
            )}>
              {missingPfp ? "Photo is required" : pfpPreview ? "Tap to change" : "Add your photo"}
            </p>
          </div>

          {/* Username */}
          <div className="mb-3">
            <div className={cn(
              "flex items-center gap-2 rounded-2xl border px-4 py-3.5 bg-muted/40 transition-all",
              "focus-within:bg-background focus-within:border-foreground/40",
              missingUsername ? "border-rose-500" : "border-border",
            )}>
              <span className="text-muted-foreground text-sm select-none">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16))
                }
                onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                placeholder="yourname"
                autoFocus
                autoComplete="off"
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            {missingUsername && (
              <p className="mt-1.5 text-xs text-rose-500 px-1">Username is required</p>
            )}
          </div>

          {/* Email */}
          <div className="mb-8">
            <div className="flex items-center gap-2 rounded-2xl border border-border px-4 py-3.5 bg-muted/40 transition-all focus-within:bg-background focus-within:border-foreground/40">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Errors */}
          {(walletReadyError || error) && (
            <p className="mb-3 text-xs text-rose-500 text-center">
              {walletReadyError ?? error?.message}
            </p>
          )}

          {/* CTA */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "w-full rounded-2xl border-2 border-[#1A1A1A] bg-[#fcff52] py-4 text-sm font-black text-[#111111]",
              "shadow-[4px_4px_0px_0px_#1A1A1A] transition-all",
              "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_#1A1A1A]",
              "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_#1A1A1A]",
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {isSavingProfile ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving profile…</>
              ) : isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Confirm in wallet…</>
              ) : isSuccess ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Redirecting…</>
              ) : (
                <>Continue<ArrowRight className="h-4 w-4" /></>
              )}
            </span>
          </button>

          {/* Hint */}
          {!canSubmit && !isLoading && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {!pfpUrl && !username.trim()
                ? "Add a photo and username to continue"
                : !pfpUrl
                ? "Add a profile photo to continue"
                : "Choose a username to continue"}
            </p>
          )}
        </form>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center items-center gap-1.5 pb-10">
        <span className="block h-1.5 w-7 rounded-full bg-[#fcff52]" />
        <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
        <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
      </div>
    </div>
  );
}
