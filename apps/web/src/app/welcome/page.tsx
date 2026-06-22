"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSetProfile } from "@/hooks/use-set-profile";
import { useUserStore } from "@/stores/useUserStore";
import { usePfpUpload } from "@/hooks/use-pfp-upload";
import { Loader2, ArrowRight, Camera, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import {
  consumeCommunityReferral,
  consumeSignInRedirect,
  peekCommunityReferral,
} from "@/lib/auth-redirect";

type WizardStep = "profile" | "community";

export default function WelcomePage() {
  const router = useRouter();
  const { address, isReady, authenticated, email: resolvedEmail, provider: authProvider } = useAuth();
  const { updateUsername, updateProfile } = useUserStore();

  const [step, setStep] = useState<WizardStep>("profile");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pfpUrl, setPfpUrl] = useState<string | null>(null);
  const [pfpPreview, setPfpPreview] = useState<string | null>(null);
  const [touched, setTouched] = useState({ username: false, pfp: false });

  const [communityCode, setCommunityCode] = useState("");
  const [communityName, setCommunityName] = useState<string | null>(null);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [isJoiningCommunity, setIsJoiningCommunity] = useState(false);

  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const savedRef = useRef(false);
  const profileSubmittedRef = useRef(false);

  const { setProfile, isPending, isSuccess, error: contractError } = useSetProfile();
  const { upload, isUploading, error: pfpUploadError, inputRef, openPicker, clearError } = usePfpUpload();

  useEffect(() => {
    if (resolvedEmail) setEmail(resolvedEmail);
  }, [resolvedEmail]);

  useEffect(() => {
    if (isReady && !authenticated) router.replace("/sign-in");
  }, [isReady, authenticated, router]);

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

  useEffect(() => {
    if (!alreadyOnboarded) return;
    const referral = peekCommunityReferral();
    const redirect = consumeSignInRedirect() ?? "/";
    if (referral && (redirect === "/" || !redirect.startsWith("/join/"))) {
      router.replace(`/join/${referral}`);
    } else {
      router.replace(redirect);
    }
  }, [alreadyOnboarded, router]);

  useEffect(() => {
    const referral = peekCommunityReferral();
    if (referral) setCommunityCode(referral);
  }, []);

  const validateCommunityCode = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setCommunityName(null);
      setCommunityError(null);
      return false;
    }
    setIsValidatingCode(true);
    setCommunityError(null);
    try {
      const res = await fetch(`/api/community/validate-code?code=${encodeURIComponent(trimmed)}`);
      const json = await res.json();
      if (!res.ok || !json.valid) {
        setCommunityName(null);
        setCommunityError(json.error ?? "Invalid community code.");
        return false;
      }
      setCommunityName(json.community?.name ?? null);
      return true;
    } catch {
      setCommunityError("Could not validate code. Try again.");
      return false;
    } finally {
      setIsValidatingCode(false);
    }
  }, []);

  useEffect(() => {
    if (!communityCode.trim()) {
      setCommunityName(null);
      setCommunityError(null);
      return;
    }
    const t = setTimeout(() => void validateCommunityCode(communityCode), 400);
    return () => clearTimeout(t);
  }, [communityCode, validateCommunityCode]);

  const finishOnboarding = async (joinCommunity: boolean) => {
    if (!address) return;
    setIsJoiningCommunity(true);
    setCommunityError(null);

    let joinedSlug: string | null = null;

    try {
      if (joinCommunity && communityCode.trim()) {
        const valid = communityName ? true : await validateCommunityCode(communityCode);
        if (!valid) {
          setIsJoiningCommunity(false);
          return;
        }
        const res = await fetch("/api/community/join-onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            walletAddress: address,
            inviteCode: communityCode.trim().toUpperCase(),
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setCommunityError(json.error ?? "Failed to join community.");
          setIsJoiningCommunity(false);
          return;
        }
        joinedSlug = json.community?.slug ?? null;
      }

      consumeCommunityReferral();

      const onboardingRes = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address, auth_provider: authProvider ?? "web3auth" }),
      });
      if (!onboardingRes.ok) {
        setCommunityError("Failed to complete setup. Please try again.");
        setIsJoiningCommunity(false);
        return;
      }

      const redirect = consumeSignInRedirect() ?? "/";
      if (joinedSlug) {
        router.replace(`/communities/${joinedSlug}`);
      } else if (redirect.startsWith("/join/") && joinCommunity) {
        router.replace("/");
      } else {
        router.replace(redirect);
      }
    } catch {
      setCommunityError("Something went wrong. Please try again.");
    } finally {
      setIsJoiningCommunity(false);
    }
  };

  useEffect(() => {
    if (!isSuccess || !address || savedRef.current) return;
    savedRef.current = true;

    const normalizedEmail = email.trim() || `${address.toLowerCase()}@wallet.local`;

    (async () => {
      setProfileSaveError(null);
      try {
        const profileRes = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            address,
            username: username.trim(),
            email: normalizedEmail,
            pfpUrl: pfpUrl ?? undefined,
            auth_provider: authProvider ?? "web3auth",
          }),
        });
        if (!profileRes.ok) {
          const json = await profileRes.json().catch(() => ({}));
          savedRef.current = false;
          setProfileSaveError(json.error ?? "Failed to save profile. Please try again.");
          return;
        }
      } catch {
        savedRef.current = false;
        setProfileSaveError("Failed to save profile. Check your connection and try again.");
        return;
      }

      updateUsername(username.trim(), normalizedEmail);
      updateProfile({ email: normalizedEmail, pfpUrl: pfpUrl ?? undefined });

      try {
        window.sessionStorage.setItem("delulu:new-user", "1");
      } catch {}

      setStep("community");
    })();
  }, [isSuccess, address, email, username, pfpUrl, authProvider, updateUsername, updateProfile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    clearError();
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

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, pfp: true });
    if (username.trim().length < 3 || !pfpUrl || !address || profileSubmittedRef.current) return;
    profileSubmittedRef.current = true;
    try {
      await setProfile(username.trim());
    } catch {
      profileSubmittedRef.current = false;
    }
  };

  const isCheckingOnboarding = !isReady || (authenticated && (!address || isCheckingProfile));

  if (isCheckingOnboarding) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="h-14 w-14 rounded-2xl opacity-90" />
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Setting up your wallet…
        </div>
      </div>
    );
  }

  const isSubmittingProfile = isPending || isSuccess;
  const usernameTooShort = username.trim().length > 0 && username.trim().length < 3;
  const canSubmitProfile =
    username.trim().length >= 3 && !!pfpUrl && !isSubmittingProfile && !isUploading;
  const missingPfp = touched.pfp && !pfpUrl && !isUploading;
  const missingUsername = touched.username && !username.trim();
  const showUsernameTooShort = touched.username && usernameTooShort;
  const displayPfpError = pfpUploadError;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex justify-center pt-10 pb-2">
        <div className="flex items-center gap-2">
          <img src="/favicon_io/android-chrome-192x192.png" alt="Delulu" className="h-6 w-6 rounded-md" />
          <span className="text-sm font-black tracking-tight text-foreground">delulu</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
        <div className="mb-6 flex items-center gap-2">
          <span className={cn("h-1.5 w-7 rounded-full", step === "profile" ? "bg-[#f6c324]" : "bg-[#f6c324]/40")} />
          <span className={cn("h-1.5 w-7 rounded-full", step === "community" ? "bg-[#f6c324]" : "bg-muted-foreground/20")} />
        </div>

        {step === "profile" ? (
          <>
            <div className="mb-10 max-w-xs text-center">
              <h1 className="text-[2rem] font-black leading-[1.15] tracking-tight text-foreground">
                Set up your profile
              </h1>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                Step 1 of 2 — photo and username
              </p>
            </div>

            <form onSubmit={handleProfileSubmit} className="flex w-full max-w-xs flex-col">
              <div className="mb-9 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    setTouched((t) => ({ ...t, pfp: true }));
                    openPicker();
                  }}
                  disabled={isSubmittingProfile || isUploading}
                  className={cn(
                    "relative h-32 w-32 overflow-hidden rounded-full ring-[3px] ring-offset-4 ring-offset-background transition-all",
                    missingPfp ? "ring-rose-500" : pfpPreview ? "ring-[#f6c324]" : "ring-border hover:ring-muted-foreground/60",
                  )}
                >
                  {pfpPreview ? (
                    <img src={pfpPreview} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted">
                      <Camera className="h-8 w-8 text-muted-foreground/70" />
                    </div>
                  )}
                  {isUploading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity hover:opacity-100">
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                  )}
                </button>
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <p className={cn("mt-3 text-xs font-medium", missingPfp || displayPfpError ? "text-rose-500" : "text-muted-foreground")}>
                  {displayPfpError ??
                    (missingPfp ? "Photo is required" : pfpPreview ? "Tap to change · we compress large photos" : "Add your photo")}
                </p>
                {displayPfpError ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      openPicker();
                    }}
                    className="mt-1 text-xs font-semibold text-delulu-blue"
                  >
                    Try another photo
                  </button>
                ) : null}
              </div>

              <div className="mb-3">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border px-4 py-3.5 bg-muted/40 transition-all focus-within:bg-background focus-within:border-foreground/40",
                    missingUsername || showUsernameTooShort ? "border-rose-500" : "border-border",
                  )}
                >
                  <span className="select-none text-sm text-muted-foreground">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16))}
                    onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                    placeholder="yourname"
                    autoFocus
                    autoComplete="off"
                    disabled={isSubmittingProfile}
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
                {missingUsername ? (
                  <p className="mt-1.5 px-1 text-xs text-rose-500">Username is required</p>
                ) : showUsernameTooShort ? (
                  <p className="mt-1.5 px-1 text-xs text-rose-500">Username must be at least 3 characters</p>
                ) : null}
              </div>

              <div className="mb-8">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3.5 transition-all focus-within:border-foreground/40 focus-within:bg-background">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={isSubmittingProfile}
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {contractError ? (
                <p className="mb-3 text-center text-xs text-rose-500">{contractError.message}</p>
              ) : null}
              {profileSaveError ? (
                <p className="mb-3 text-center text-xs text-rose-500">{profileSaveError}</p>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmitProfile}
                className={cn(
                  "w-full rounded-2xl border-2 border-[#1a1a19] bg-[#f6c324] py-4 text-sm font-black text-[#1a1a19]",
                  "shadow-[4px_4px_0px_0px_#1a1a19] transition-all disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Confirm in wallet…</>
                  ) : isSuccess ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                  ) : (
                    <>Continue <ArrowRight className="h-4 w-4" /></>
                  )}
                </span>
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-10 max-w-xs text-center">
              <h1 className="text-[2rem] font-black leading-[1.15] tracking-tight text-foreground">
                Join your community
              </h1>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                Step 2 of 2 — enter the code from your organizer (optional)
              </p>
            </div>

            <div className="w-full max-w-xs space-y-4">
              <div>
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3.5 focus-within:border-foreground/40 focus-within:bg-background">
                  <input
                    type="text"
                    value={communityCode}
                    onChange={(e) => setCommunityCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="Community code"
                    autoFocus
                    className="flex-1 bg-transparent text-sm font-semibold tracking-wider text-foreground outline-none placeholder:text-muted-foreground/50"
                  />
                  {isValidatingCode ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                </div>
                {communityName ? (
                  <p className="mt-2 px-1 text-xs font-medium text-emerald-600">Joining {communityName}</p>
                ) : null}
                {communityError ? (
                  <p className="mt-2 px-1 text-xs text-rose-500">{communityError}</p>
                ) : null}
              </div>

              <button
                type="button"
                disabled={isJoiningCommunity || isValidatingCode || !communityCode.trim() || !!communityError}
                onClick={() => void finishOnboarding(true)}
                className="w-full rounded-2xl border-2 border-[#1a1a19] bg-[#f6c324] py-4 text-sm font-black text-[#1a1a19] shadow-[4px_4px_0px_0px_#1a1a19] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isJoiningCommunity ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Joining…
                  </span>
                ) : (
                  "Join community"
                )}
              </button>

              <button
                type="button"
                disabled={isJoiningCommunity}
                onClick={() => void finishOnboarding(false)}
                className="w-full py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Skip for now
              </button>

              <button
                type="button"
                onClick={() => setStep("profile")}
                className="mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to profile
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
