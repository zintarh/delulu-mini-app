"use client";

import { useState, useEffect, useRef } from "react";
import { useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSetProfile } from "@/hooks/use-set-profile";
import { useUserStore } from "@/stores/useUserStore";
import { usePfpUpload } from "@/hooks/use-pfp-upload";
import { Loader2, ArrowRight, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";

export default function WelcomePage() {
  const router = useRouter();
  const { address, isReady, authenticated, email: resolvedEmail, provider: authProvider } = useAuth();
  const { updateUsername, updateProfile } = useUserStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pfpUrl, setPfpUrl] = useState<string | null>(null);
  const [pfpPreview, setPfpPreview] = useState<string | null>(null);
  const [pfpError, setPfpError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [touched, setTouched] = useState({ username: false, pfp: false });

  const savedRef = useRef(false);
  const faucetFiredRef = useRef(false);

  const { setProfile, isPending, isSuccess, error: contractError } = useSetProfile();
  const { upload, isUploading, inputRef, openPicker } = usePfpUpload();

  // Pre-fill email from auth provider
  useEffect(() => {
    if (resolvedEmail) setEmail(resolvedEmail);
  }, [resolvedEmail]);

  // Guard: must be authenticated
  useEffect(() => {
    if (isReady && !authenticated) router.replace("/sign-in");
  }, [isReady, authenticated, router]);

  // Single source of truth: does this address already have a profile?
  const { data: existingUsername, isFetching: isCheckingProfile } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: { enabled: !!address, staleTime: 0, gcTime: 0 },
  });

  const alreadyOnboarded =
    !isCheckingProfile &&
    typeof existingUsername === "string" &&
    existingUsername.trim().length > 0;

  // Already has a profile — send home
  useEffect(() => {
    if (alreadyOnboarded) router.replace("/");
  }, [alreadyOnboarded, router]);

  // New user confirmed — fire faucet once
  useEffect(() => {
    if (!address || isCheckingProfile || alreadyOnboarded || faucetFiredRef.current) return;
    faucetFiredRef.current = true;
    fetch("/api/faucet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    }).catch(() => {});
  }, [address, isCheckingProfile, alreadyOnboarded]);

  // After on-chain setProfile confirms, save to Supabase then redirect
  useEffect(() => {
    if (!isSuccess || !address || savedRef.current) return;
    savedRef.current = true;

    const normalizedEmail = email.trim() || `${address.toLowerCase()}@wallet.local`;

    (async () => {
      setIsSavingProfile(true);
      try {
        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            username: username.trim(),
            email: normalizedEmail,
            pfpUrl: pfpUrl ?? undefined,
            auth_provider: authProvider ?? "web3auth",
          }),
        });
      } catch {
        // Profile saved on-chain; Supabase failure is non-blocking
      } finally {
        setIsSavingProfile(false);
      }

      updateUsername(username.trim(), normalizedEmail);
      updateProfile({ email: normalizedEmail, pfpUrl: pfpUrl ?? undefined });

      try { window.sessionStorage.setItem("delulu:new-user", "1"); } catch {}
      router.replace("/");
    })();
  }, [isSuccess, address]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPfpError(null);
    setPfpPreview(URL.createObjectURL(file));
    setTouched(t => ({ ...t, pfp: true }));
    try {
      const url = await upload(file);
      setPfpUrl(url);
    } catch {
      setPfpPreview(null);
      setPfpUrl(null);
      setPfpError("Upload failed. Please try a different image.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, pfp: true });
    if (!username.trim() || !pfpUrl || !address) return;
    try { await setProfile(username.trim()); } catch {}
  };

  // Loading: Privy not ready, or authenticated but still waiting for address/contract check
  const isCheckingOnboarding = !isReady || (authenticated && (!address || isCheckingProfile));

  if (isCheckingOnboarding) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="w-14 h-14 rounded-2xl opacity-90" />
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          Setting up your wallet…
        </div>
      </div>
    );
  }

  const isSubmitting = isPending || isSavingProfile || isSuccess;
  const canSubmit = !!username.trim() && !!pfpUrl && !isSubmitting && !isUploading;
  const missingPfp = touched.pfp && !pfpUrl && !isUploading;
  const missingUsername = touched.username && !username.trim();

  return (
    <div className="min-h-screen bg-background flex flex-col">

      <div className="flex justify-center pt-10 pb-2">
        <div className="flex items-center gap-2">
          <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="h-6 w-6 rounded-md" />
          <span className="text-sm font-black tracking-tight text-foreground">delulu</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">

        <div className="text-center mb-10 max-w-xs">
          <h1 className="text-[2rem] font-black text-foreground leading-[1.15] tracking-tight">
            Set up your profile
          </h1>
          <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
            Add a photo and choose a username to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-0">

          {/* Avatar */}
          <div className="flex flex-col items-center mb-9">
            <button
              type="button"
              onClick={() => { setTouched(t => ({ ...t, pfp: true })); openPicker(); }}
              disabled={isSubmitting || isUploading}
              className={cn(
                "relative w-32 h-32 rounded-full overflow-hidden transition-all duration-200",
                "ring-[3px] ring-offset-[4px] ring-offset-background",
                missingPfp ? "ring-rose-500" : pfpPreview ? "ring-[#fcff52]" : "ring-border hover:ring-muted-foreground/60",
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
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <p className={cn("mt-3 text-xs font-medium", missingPfp || pfpError ? "text-rose-500" : "text-muted-foreground")}>
              {pfpError ?? (missingPfp ? "Photo is required" : pfpPreview ? "Tap to change" : "Add your photo")}
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
                onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16))}
                onBlur={() => setTouched(t => ({ ...t, username: true }))}
                placeholder="yourname"
                autoFocus
                autoComplete="off"
                disabled={isSubmitting}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            {missingUsername && <p className="mt-1.5 text-xs text-rose-500 px-1">Username is required</p>}
          </div>

          {/* Email */}
          <div className="mb-8">
            <div className="flex items-center gap-2 rounded-2xl border border-border px-4 py-3.5 bg-muted/40 transition-all focus-within:bg-background focus-within:border-foreground/40">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isSubmitting}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {contractError && (
            <p className="mb-3 text-xs text-rose-500 text-center">{contractError.message}</p>
          )}

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
                <>Continue <ArrowRight className="h-4 w-4" /></>
              )}
            </span>
          </button>

          {!canSubmit && !isSubmitting && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {!pfpUrl && !username.trim()
                ? "Add a photo and username to continue"
                : !pfpUrl ? "Add a profile photo to continue"
                : "Choose a username to continue"}
            </p>
          )}
        </form>
      </div>

      <div className="flex justify-center items-center gap-1.5 pb-10">
        <span className="block h-1.5 w-7 rounded-full bg-[#fcff52]" />
        <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
        <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
      </div>
    </div>
  );
}
