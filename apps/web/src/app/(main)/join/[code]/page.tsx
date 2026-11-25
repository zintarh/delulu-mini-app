"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useReadContract } from "wagmi";
import { useAuth } from "@/hooks/use-auth";
import { buildSignInWithCommunityUrl, persistReferralCode } from "@/lib/auth-redirect";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function JoinCommunityPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { address, authenticated, isReady } = useAuth();
  const [status, setStatus] = useState<"idle" | "joining" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [successSlug, setSuccessSlug] = useState<string | null>(null);

  const code = params.code?.toUpperCase() ?? "";
  // A partner's referral link (/join/BIGJAY) or an older community invite? null = still checking.
  const [kind, setKind] = useState<"partner" | "community" | null>(null);

  useEffect(() => {
    if (!code) return;
    let live = true;
    fetch(`/api/join/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : { kind: "community" }))
      .then((j: { kind?: string }) => live && setKind(j.kind === "partner" ? "partner" : "community"))
      .catch(() => live && setKind("community"));
    return () => {
      live = false;
    };
  }, [code]);

  // Not a partner's code: community invites are gone from the app — Explore, as before.
  useEffect(() => {
    if (kind === "community") router.replace("/explore");
  }, [kind, router]);

  // Partner link: keep the code (cookie + storage, read when the profile is created) and
  // sign up with it like any referral link; already signed in → straight home.
  useEffect(() => {
    if (kind !== "partner" || !isReady) return;
    persistReferralCode(code);
    router.replace(authenticated && address ? "/home" : `/sign-in?ref=${encodeURIComponent(code)}`);
  }, [kind, isReady, authenticated, address, code, router]);

  const { data: existingUsername, isFetching: isCheckingProfile } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: { enabled: !!authenticated && !!address, staleTime: 0, gcTime: 0 },
  });

  const hasProfile =
    !isCheckingProfile &&
    typeof existingUsername === "string" &&
    existingUsername.trim().length > 0;

  useEffect(() => {
    if (!isReady || kind !== "community") return;
    if (!code) {
      setMessage("Invalid invite link.");
      setStatus("error");
      return;
    }
    if (!authenticated || !address) {
      router.replace(buildSignInWithCommunityUrl(code, `/join/${code}`));
    }
  }, [isReady, authenticated, address, code, router, kind]);

  useEffect(() => {
    if (kind !== "community" || !authenticated || !address || !code || status !== "idle") return;
    if (isCheckingProfile) return;
    if (!hasProfile) {
      router.replace("/welcome");
      return;
    }

    const join = async () => {
      setStatus("joining");
      try {
        const res = await fetch("/api/community/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ walletAddress: address, inviteCode: code }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setCommunityName(json.community?.name ?? "the community");
          setSuccessSlug(json.community?.slug ?? null);
          setStatus("success");
        } else {
          setMessage(json.error ?? "Failed to join.");
          setStatus("error");
        }
      } catch {
        setMessage("Something went wrong. Try again.");
        setStatus("error");
      }
    };

    void join();
  }, [authenticated, address, code, status, router, hasProfile, isCheckingProfile, kind]);

  const goToCommunity = () => {
    router.replace(successSlug ? `/communities/${successSlug}` : "/");
  };

  if (kind !== "community" || !isReady || !authenticated || isCheckingProfile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue" />
        <p className="text-sm font-semibold text-foreground">
          {kind !== "community" ? "Opening your invite…" : !isReady || !authenticated ? "Redirecting to sign in…" : "Checking your profile…"}
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      {(status === "idle" || status === "joining") && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-blue" />
          <p className="text-sm font-semibold text-foreground">Joining community…</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle className="h-10 w-10 text-green-edge" />
          <p className="text-base font-bold text-foreground">You joined {communityName}!</p>
          <button
            type="button"
            onClick={goToCommunity}
            className="mt-2 rounded-xl bg-delulu-yellow px-6 py-2.5 text-sm font-extrabold text-[#1a1a19]"
          >
            Continue to community
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm font-semibold text-foreground">Couldn&apos;t join</p>
          <p className="text-xs text-muted-foreground">{message}</p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="text-xs font-semibold text-blue"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => router.replace("/home")}
              className="text-xs font-semibold text-muted-foreground"
            >
              Go home
            </button>
          </div>
        </>
      )}
    </main>
  );
}
