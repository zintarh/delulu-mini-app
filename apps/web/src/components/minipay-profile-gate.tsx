"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useUserSetupCheck } from "@/hooks/use-user-setup-check";
import { useSetProfile } from "@/hooks/use-set-profile";
import { useUserStore } from "@/stores/useUserStore";
import { usePfpUpload } from "@/hooks/use-pfp-upload";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function MinipayProfileGate({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { needsSetup, isChecking } = useUserSetupCheck(isConnected && !!address);
  const [profileComplete, setProfileComplete] = useState(false);

  if (isConnected && isChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <img
          src="/favicon_io/android-chrome-192x192.png"
          alt="Delulu"
          className="w-12 h-12 rounded-xl opacity-80"
        />
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isConnected && needsSetup && !profileComplete) {
    return (
      <ProfileSetupScreen
        address={address!}
        onComplete={() => setProfileComplete(true)}
      />
    );
  }

  return <>{children}</>;
}

function ProfileSetupScreen({
  address,
  onComplete,
}: {
  address: string;
  onComplete: () => void;
}) {
  const { updateUsername, updateProfile } = useUserStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pfpUrl, setPfpUrl] = useState<string | null>(null);
  const [pfpPreview, setPfpPreview] = useState<string | null>(null);
  const [pfpUploadError, setPfpUploadError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [touched, setTouched] = useState({ username: false, email: false });
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const savedRef = useRef(false);

  const {
    setProfile,
    isPending,
    isSuccess,
    isConfirming,
    error: contractError,
  } = useSetProfile();

  const { upload, isUploading, inputRef, openPicker } = usePfpUpload();

  useEffect(() => {
    if (!isSuccess || !address || savedRef.current) return;
    savedRef.current = true;

    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;

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
            auth_provider: "minipay",
          }),
        });
      } catch {
        // non-blocking — profile is already set on-chain
      } finally {
        setIsSavingProfile(false);
      }

      updateUsername(username.trim(), normalizedEmail);
      if (pfpUrl) updateProfile({ pfpUrl });
      onComplete();
    })();
  }, [isSuccess, address]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPfpUploadError(null);
    setPfpPreview(URL.createObjectURL(file));
    try {
      const url = await upload(file);
      setPfpUrl(url);
    } catch {
      setPfpPreview(null);
      setPfpUrl(null);
      setPfpUploadError("Upload failed. Try a different image.");
    }
  };

  const validateEmailField = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setEmailError("Email is required");
      return false;
    }
    if (!isValidEmail(trimmed)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError(null);
    return true;
  };

  const handleSubmit = async () => {
    setTouched({ username: true, email: true });
    if (!username.trim()) return;
    if (!validateEmailField(email)) return;
    setSubmitError(null);
    try {
      await setProfile(username.trim());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to set profile");
    }
  };

  const isSubmitting = isPending || isConfirming || isSavingProfile || isSuccess;
  const emailValid = isValidEmail(email);
  const canSubmit =
    !!username.trim() && emailValid && !isSubmitting && !isUploading;
  const missingUsername = touched.username && !username.trim();
  const showEmailError = touched.email && !!emailError;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex justify-center pt-10 pb-2">
        <div className="flex items-center gap-2">
          <img
            src="/favicon_io/android-chrome-192x192.png"
            alt="Delulu"
            className="h-6 w-6 rounded-md"
          />
          <span className="text-sm font-black tracking-tight text-[#1a1a19]">delulu</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <div className="text-center mb-10 max-w-xs">
          <h1 className="text-[2rem] font-black text-[#1a1a19] leading-[1.15] tracking-tight">
            Set up your profile
          </h1>
          <p className="mt-2.5 text-sm text-gray-500 leading-relaxed">
            Add a photo and choose a username to get started
          </p>
        </div>

        <div className="w-full max-w-xs flex flex-col">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-9">
            <button
              type="button"
              onClick={openPicker}
              disabled={isSubmitting || isUploading}
              className={cn(
                "relative w-32 h-32 rounded-full overflow-hidden transition-all duration-200",
                "ring-[3px] ring-offset-[4px] ring-offset-white",
                pfpUploadError
                  ? "ring-rose-500"
                  : pfpPreview
                    ? "ring-[#f6c324]"
                    : "ring-gray-200 hover:ring-gray-400",
              )}
            >
              {pfpPreview ? (
                <img src={pfpPreview} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                  <Camera className="h-8 w-8 text-gray-400" />
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#1a1a19]" />
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
            <p className={cn("mt-3 text-xs font-medium", pfpUploadError ? "text-rose-500" : "text-gray-400")}>
              {pfpUploadError ?? (pfpPreview ? "Tap to change" : "Add your photo (optional)")}
            </p>
          </div>

          {/* Username */}
          <div className="mb-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-2xl border px-4 py-3.5 bg-gray-50 transition-all",
                "focus-within:bg-white focus-within:border-[#1a1a19]/40",
                missingUsername ? "border-rose-500" : "border-gray-200",
              )}
            >
              <span className="text-gray-400 text-sm select-none">@</span>
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
                disabled={isSubmitting}
                className="flex-1 bg-transparent text-sm text-[#1a1a19] outline-none placeholder:text-gray-400"
              />
            </div>
            {missingUsername && (
              <p className="mt-1.5 text-xs text-rose-500 px-1">Username is required</p>
            )}
          </div>

          {/* Email */}
          <div className="mb-8">
            <div
              className={cn(
                "flex items-center gap-2 rounded-2xl border px-4 py-3.5 bg-gray-50 transition-all focus-within:bg-white focus-within:border-[#1a1a19]/40",
                showEmailError ? "border-rose-500" : "border-gray-200",
              )}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) validateEmailField(e.target.value);
                }}
                onBlur={() => {
                  setTouched((t) => ({ ...t, email: true }));
                  validateEmailField(email);
                }}
                placeholder="Your email"
                autoComplete="email"
                required
                disabled={isSubmitting}
                className="flex-1 bg-transparent text-sm text-[#1a1a19] outline-none placeholder:text-gray-400"
              />
            </div>
            {showEmailError && (
              <p className="mt-1.5 text-xs text-rose-500 px-1">{emailError}</p>
            )}
          </div>

          {(submitError || contractError) && (
            <p className="mb-3 text-xs text-rose-500 text-center">
              {submitError ?? contractError?.message}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "w-full rounded-2xl border-2 border-[#1a1a19] bg-[#f6c324] py-4 text-sm font-black text-[#1a1a19]",
              "shadow-[4px_4px_0px_0px_#1a1a19] transition-all",
              "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {isSavingProfile ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />Saving profile…
              </span>
            ) : isPending || isConfirming ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />Confirm in wallet…
              </span>
            ) : isSuccess ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />Setting up…
              </span>
            ) : (
              "Continue"
            )}
          </button>

          {!canSubmit && !isSubmitting && (
            <p className="mt-4 text-center text-xs text-gray-400">
              Choose a username and email to continue
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-center items-center gap-1.5 pb-10">
        <span className="block h-1.5 w-7 rounded-full bg-[#f6c324]" />
        <span className="block h-1.5 w-1.5 rounded-full bg-gray-200" />
        <span className="block h-1.5 w-1.5 rounded-full bg-gray-200" />
      </div>
    </div>
  );
}
