"use client";

import { useState, useEffect, useRef } from "react";
import { useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useIdentity } from "@/hooks/identityHook";
import { useSetProfile } from "@/hooks/use-set-profile";
import { useUserStore } from "@/stores/useUserStore";
import { usePfpUpload } from "@/hooks/use-pfp-upload";
import { Loader2, ArrowRight, Camera, Copy, Check, Plus } from "lucide-react";
import { Lulu } from "@/components/ds";
import { cn, formatAddress } from "@/lib/utils";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import {
  consumeCommunityReferral,
  consumeSignInRedirect,
  peekReferralCode,
  consumeReferralCode,
} from "@/lib/auth-redirect";
import { getEmailValidationMessage } from "@/lib/email-validation";
import { requestGasTopup } from "@/lib/faucet/request-client";
import { isInventedUsername, hasChosenUsername } from "@/lib/profile/invented-username";

export default function WelcomePage() {
  const router = useRouter();
  const { address, isReady, authenticated, email: resolvedEmail, provider: authProvider } = useAuth();
  const { updateUsername, updateProfile } = useUserStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pfpUrl, setPfpUrl] = useState<string | null>(null);
  const [pfpPreview, setPfpPreview] = useState<string | null>(null);
  const [touched, setTouched] = useState({ username: false, pfp: false });

  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [emailCheckError, setEmailCheckError] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  // Invite code from the ?ref= link (kept across tabs), or typed in by hand
  // when the link was opened in another browser (e.g. WhatsApp's).
  const [inviteCode, setInviteCode] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const savedRef = useRef(false);
  const profileSubmittedRef = useRef(false);

  const { setProfile, isPending, isSuccess, error: contractError } = useSetProfile();
  const { upload, isUploading, error: pfpUploadError, inputRef, openPicker, clearError } = usePfpUpload();

  useEffect(() => {
    if (resolvedEmail) setEmail(resolvedEmail);
  }, [resolvedEmail]);

  useEffect(() => {
    const stored = peekReferralCode();
    if (stored) {
      setInviteCode(stored);
      setShowInvite(true);
    }
  }, []);

  useEffect(() => {
    if (isReady && !authenticated) router.replace("/sign-in");
  }, [isReady, authenticated, router]);

  // Face check before the profile: verifying is what puts gas in the wallet
  // for setProfile. Other gates send anyone without a profile here, so send
  // a wallet that is confirmed unverified back to the check on /sign-in.
  // A failed identity read ("error") stays, so a flaky RPC can't loop them.
  const { status: identityStatus } = useIdentity();
  const mustVerifyFirst = identityStatus === "not_verified";

  // setProfile needs gas. Top the wallet up as soon as this form opens.
  useEffect(() => {
    if (authenticated && address) void requestGasTopup();
  }, [authenticated, address]);

  const { data: existingUsername, isFetching: isCheckingProfile } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: { enabled: !!address, staleTime: 0, gcTime: 0 },
  });

  const alreadyOnboarded =
    !isCheckingProfile &&
    !!address &&
    hasChosenUsername(address, typeof existingUsername === "string" ? existingUsername : "");

  /** Communities are gone from the app, so a leftover /join/ redirect lands on Home. */
  const finishOnboarding = () => {
    consumeCommunityReferral();
    const redirect = consumeSignInRedirect() ?? "/play";
    router.replace(redirect.startsWith("/join/") ? "/home" : redirect);
  };

  useEffect(() => {
    if (mustVerifyFirst && !isCheckingProfile && !alreadyOnboarded) router.replace("/sign-in");
  }, [mustVerifyFirst, isCheckingProfile, alreadyOnboarded, router]);

  useEffect(() => {
    if (!alreadyOnboarded) return;
    finishOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyOnboarded]);

  const handleCopyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  useEffect(() => {
    if (!isSuccess || !address || savedRef.current) return;
    savedRef.current = true;

    // Never store a placeholder — the form now requires a non-empty email before submit.
    const normalizedEmail = email.trim().toLowerCase() || `${address.toLowerCase()}@wallet.local`;
    if (!email.trim()) {
      // Shouldn't reach here since canSubmitProfile already requires email,
      // but guard against any edge case to avoid polluting the profile row.
      savedRef.current = false;
      setProfileSaveError("Please enter an email address before continuing.");
      return;
    }

    (async () => {
      setProfileSaveError(null);
      const referredByCode = inviteCode.trim().toUpperCase() || peekReferralCode();
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
            referredByCode: referredByCode ?? undefined,
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
      consumeReferralCode();

      try {
        window.sessionStorage.setItem("delulu:new-user", "1");
      } catch {}

      // Profile (username + photo) is what actually defines "onboarded" —
      // the community step after this is optional/skippable and shouldn't
      // gate it. Best-effort: the profile is already saved above regardless
      // of this call's outcome, and the dashboard's onboarding-gift check
      // re-evaluates on every load, so a dropped request here self-heals.
      fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address, auth_provider: authProvider ?? "web3auth" }),
      }).catch(() => {});

      // Profile is on-chain now, so the starter gas drip unlocks: enough for a
      // first goal and proofs. The server checks the profile itself and only
      // tops up what's missing. A short wait lets the RPC see the new block.
      window.setTimeout(() => {
        fetch("/api/faucet/topup", { method: "POST", credentials: "include" }).catch(() => {});
      }, 3000);

      finishOnboarding();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, address, email, username, pfpUrl, inviteCode, authProvider, updateUsername, updateProfile]);

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
    setEmailCheckError(null);
    if (username.trim().length < 3 || !pfpUrl || !address || profileSubmittedRef.current) return;
    if (isInventedUsername(address, username)) {
      setProfileSaveError("That name was made up for you. Choose your own.");
      return;
    }

    try {
      const params = new URLSearchParams({ email: email.trim() });
      if (address) params.set("excludeAddress", address.toLowerCase());
      const res = await fetch(`/api/profile/check-email?${params.toString()}`);
      if (!res.ok) {
        setEmailCheckError("Could not verify email. Please try again.");
        return;
      }
      const json = await res.json() as { taken?: boolean };
      if (json.taken) {
        setEmailCheckError("This email is already in use. Please use a different one.");
        return;
      }
    } catch {
      setEmailCheckError("Could not verify email. Check your connection and try again.");
      return;
    }

    profileSubmittedRef.current = true;
    try {
      await setProfile(username.trim());
    } catch {
      profileSubmittedRef.current = false;
    }
  };

  const isCheckingOnboarding =
    !isReady || (authenticated && (!address || isCheckingProfile || identityStatus === "loading" || mustVerifyFirst));

  if (isCheckingOnboarding) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
        <span>
          <Lulu size={64} />
        </span>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Setting up your wallet…
        </div>
      </div>
    );
  }

  const isSubmittingProfile = isPending || isSuccess;
  const usernameTooShort = username.trim().length > 0 && username.trim().length < 3;
  const emailFormatError = email.trim() ? getEmailValidationMessage(email) : null;
  const emailError = emailFormatError ?? emailCheckError;
  const inventedName = !!address && isInventedUsername(address, username);
  const canSubmitProfile =
    username.trim().length >= 3 &&
    !inventedName &&
    !!pfpUrl &&
    !!email.trim() &&
    !emailError &&
    !isSubmittingProfile &&
    !isUploading;
  const missingPfp = touched.pfp && !pfpUrl && !isUploading;
  const missingUsername = touched.username && !username.trim();
  const showUsernameTooShort = touched.username && usernameTooShort;
  const displayPfpError = pfpUploadError;

  // Design: docs/redesign/screens/Welcome.dc.html (single step)
  return (
    <div className="flex min-h-screen flex-col overflow-y-auto bg-paper">
      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col px-5 pb-8 pt-6">
        <form onSubmit={handleProfileSubmit} className="flex flex-1 flex-col gap-6">
          <h1 className="m-0 animate-rise text-[30px] font-bold leading-[1.15] tracking-[-0.025em]">
            Who&apos;s
            <br />
            signing?
          </h1>

          <div className="flex animate-rise items-center gap-5 [animation-delay:.1s]">
            <button
              type="button"
              aria-label={pfpPreview ? "Change photo" : "Add photo"}
              onClick={() => {
                setTouched((t) => ({ ...t, pfp: true }));
                openPicker();
              }}
              disabled={isSubmittingProfile || isUploading}
              className={cn(
                "relative flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-full border-2 border-dashed bg-white text-muted-foreground",
                missingPfp ? "border-orange" : pfpPreview ? "border-transparent" : "border-[#bdbdb6]",
              )}
            >
              {pfpPreview ? (
                <img src={pfpPreview} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <Camera className="h-[30px] w-[30px]" strokeWidth={1.8} />
              )}
              {isUploading ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </span>
              ) : null}
              <span className="absolute -bottom-0.5 right-0 flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-yellow text-ink shadow-edge-yellow">
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} />
              </span>
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <div className="min-w-0">
              <p className={cn("m-0 text-sm leading-normal", missingPfp || displayPfpError ? "font-semibold text-orange" : "text-muted-foreground")}>
                {displayPfpError ??
                  (missingPfp ? "A photo is required" : pfpPreview ? "Looking good. Tap to change." : "Your photo goes on every contract you sign.")}
              </p>
              {displayPfpError ? (
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    openPicker();
                  }}
                  className="mt-1 text-xs font-bold text-blue"
                >
                  Try another photo
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex animate-rise flex-col gap-2 [animation-delay:.2s]">
            <label htmlFor="welcome-username" className="label-mono text-muted-foreground">
              Username
            </label>
            <div
              className={cn(
                "flex h-14 items-center gap-1 rounded-2xl border-2 bg-white px-4 transition-colors",
                missingUsername || showUsernameTooShort ? "border-orange" : "border-line focus-within:border-ink",
              )}
            >
              <span className="select-none text-muted-foreground">@</span>
              <input
                id="welcome-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16))}
                onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                placeholder="yourname"
                autoFocus
                autoComplete="off"
                disabled={isSubmittingProfile}
                className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-faint"
              />
            </div>
            {inventedName ? (
              <p className="px-1 text-xs font-semibold text-orange">That name was made up for you. Choose your own.</p>
            ) : missingUsername ? (
              <p className="px-1 text-xs font-semibold text-orange">Username is required</p>
            ) : showUsernameTooShort ? (
              <p className="px-1 text-xs font-semibold text-orange">At least 3 characters</p>
            ) : null}
          </div>

          <div className="flex animate-rise flex-col gap-2 [animation-delay:.3s]">
            <label htmlFor="welcome-email" className="label-mono text-muted-foreground">
              Email · for reminders
            </label>
            <input
              id="welcome-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailCheckError(null);
              }}
              placeholder="you@email.com"
              autoComplete="email"
              disabled={isSubmittingProfile}
              className={cn(
                "h-14 rounded-2xl border-2 bg-white px-4 text-base font-medium text-foreground outline-none transition-colors placeholder:text-faint",
                emailError ? "border-orange" : "border-line focus:border-ink",
              )}
            />
            {emailError ? <p className="px-1 text-xs font-semibold text-orange">{emailError}</p> : null}
          </div>

          {showInvite ? (
            <div className="flex animate-rise flex-col gap-2">
              <label htmlFor="welcome-invite" className="label-mono text-muted-foreground">
                Invite code · optional
              </label>
              <input
                id="welcome-invite"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16))}
                placeholder="ABC12345"
                autoComplete="off"
                autoCapitalize="characters"
                disabled={isSubmittingProfile}
                className="h-14 rounded-2xl border-2 border-line bg-white px-4 font-mono text-base font-semibold uppercase tracking-[0.08em] text-foreground outline-none transition-colors placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-faint focus:border-ink"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="-mt-2 self-start text-xs font-bold text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
            >
              Got an invite code?
            </button>
          )}

          <div className="mt-auto flex flex-col gap-3 pt-4">
            {contractError ? <p className="text-center text-xs font-semibold text-orange">{contractError.message}</p> : null}
            {profileSaveError ? <p className="text-center text-xs font-semibold text-orange">{profileSaveError}</p> : null}

            <button
              type="submit"
              disabled={!canSubmitProfile}
              className="press-edge flex h-14 w-full items-center justify-between rounded-2xl bg-ink pl-5 pr-1.5 text-base font-bold text-white shadow-edge-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Confirm in wallet…" : isSuccess ? "Saving…" : "Start"}
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow text-ink">
                {isPending || isSuccess ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowRight className="h-5 w-5" strokeWidth={2.4} />
                )}
              </span>
            </button>

            {address ? (
              <button
                type="button"
                onClick={handleCopyAddress}
                className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="font-mono">{formatAddress(address)}</span>
                {addressCopied ? <Check className="h-3 w-3 text-green-strong" /> : <Copy className="h-3 w-3" />}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
