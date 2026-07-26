"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatUnits } from "viem";
import { CheckCircle2, Clock, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { buildSignInUrl, persistSignInRedirect } from "@/lib/auth-redirect";
import { getTokenDecimals } from "@/lib/token-amounts";
import { DeluluDetailHeader } from "@/components/delulu-detail/delulu-detail-header";
import {
  useAcceptForfeitVerifierInvite,
  useResolveForfeitCommitmentSuccess,
} from "@/hooks/use-create-forfeit-commitment";

type CommitmentDetail = {
  id: string;
  onChainCommitmentId: number | null;
  creatorWallet: string;
  creatorUsername: string | null;
  title: string;
  description: string | null;
  verifierWallet: string | null;
  status: string;
  onChain: {
    stakeAmount: string;
    token: string;
    cadence: number;
    currentPeriodIndex: number;
    currentPeriodDeadline: string;
    active: boolean;
    cancelled: boolean;
    hasPendingVerifierInvite: boolean;
  } | null;
  currentPeriod: { proofUrl: string | null; verifierAction: string | null } | null;
};

function creatorLabel(commitment: CommitmentDetail) {
  return commitment.creatorUsername
    ? `@${commitment.creatorUsername}`
    : `${commitment.creatorWallet.slice(0, 6)}…${commitment.creatorWallet.slice(-4)}`;
}

export default function ForfeitVerifyPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { address, authenticated, isReady } = useAuth();
  const inviteCode = searchParams.get("code");

  const returnPath = `/forfeit/verify/${params.id}${inviteCode ? `?code=${inviteCode}` : ""}`;

  const [commitment, setCommitment] = useState<CommitmentDetail | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actionStep, setActionStep] = useState<"idle" | "working" | "error">("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  const { acceptVerifierInviteAndWait, isPending: isAccepting } = useAcceptForfeitVerifierInvite();
  const { resolveCommitmentSuccessAndWait, isPending: isResolving } =
    useResolveForfeitCommitmentSuccess();

  const fetchCommitment = useCallback(async () => {
    try {
      const res = await fetch(`/api/forfeit/commitments/${params.id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Commitment not found");
      setCommitment(json.commitment);
      setLoadState("ready");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load commitment");
      setLoadState("error");
    }
  }, [params.id]);

  useEffect(() => {
    void fetchCommitment();
  }, [fetchCommitment]);

  useEffect(() => {
    if (!isReady) return;
    if (!authenticated) {
      persistSignInRedirect(returnPath);
      router.replace(buildSignInUrl(returnPath));
    }
  }, [isReady, authenticated, returnPath, router]);

  const handleAccept = async () => {
    if (commitment?.onChainCommitmentId == null || !inviteCode || !address) return;
    setActionStep("working");
    setActionError(null);
    try {
      const txHash = await acceptVerifierInviteAndWait(
        commitment.onChainCommitmentId,
        inviteCode as `0x${string}`,
      );
      const res = await fetch("/api/forfeit/confirm-verifier-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, walletAddress: address }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Accepted on-chain, but saving failed");
      }
      await fetchCommitment();
      setActionStep("idle");
    } catch (err) {
      setActionStep("error");
      setActionError(err instanceof Error ? err.message : "Failed to accept invite");
    }
  };

  const handleApprove = async () => {
    if (commitment?.onChainCommitmentId == null) return;
    setActionStep("working");
    setActionError(null);
    try {
      await resolveCommitmentSuccessAndWait(commitment.onChainCommitmentId);
      await fetchCommitment();
      setActionStep("idle");
    } catch (err) {
      setActionStep("error");
      setActionError(err instanceof Error ? err.message : "Failed to confirm this proof");
    }
  };

  if (!isReady || !authenticated) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-delulu-blue" />
        <p className="text-sm font-semibold text-foreground">Redirecting to sign in…</p>
      </main>
    );
  }

  if (loadState === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-delulu-blue" />
      </main>
    );
  }

  if (loadState === "error" || !commitment) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-semibold text-foreground">{loadError ?? "Commitment not found"}</p>
        <Link href="/" className="text-xs font-semibold text-delulu-blue">
          Go home
        </Link>
      </main>
    );
  }

  const myAddress = address?.toLowerCase();
  const isResolvedVerifier = commitment.verifierWallet?.toLowerCase() === myAddress;
  const canAcceptInvite =
    !commitment.verifierWallet && !!inviteCode && commitment.onChain?.hasPendingVerifierInvite;
  const stakeAmount = commitment.onChain
    ? formatUnits(BigInt(commitment.onChain.stakeAmount), getTokenDecimals(commitment.onChain.token))
    : null;
  const deadline = commitment.onChain
    ? new Date(Number(commitment.onChain.currentPeriodDeadline) * 1000)
    : null;
  const isEnded = commitment.onChain ? !commitment.onChain.active : commitment.status !== "active";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DeluluDetailHeader shareSlot={null} />

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8 lg:max-w-2xl lg:px-8">
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Verifier review
        </div>

        <h1
          className="text-2xl font-black leading-tight text-foreground"
          style={{ fontFamily: '"Clash Display", sans-serif' }}
        >
          {commitment.title}
        </h1>
        {commitment.description ? (
          <p className="mt-2 text-sm text-muted-foreground">{commitment.description}</p>
        ) : null}

        <div className="mt-5 space-y-2 rounded-2xl border border-border/60 bg-card p-4 text-sm">
          <p>
            <span className="text-muted-foreground">Committed by</span>{" "}
            <span className="font-bold text-foreground">{creatorLabel(commitment)}</span>
          </p>
          {stakeAmount ? (
            <p>
              <span className="text-muted-foreground">At stake</span>{" "}
              <span className="font-bold text-foreground">{stakeAmount}</span>
            </p>
          ) : null}
          {deadline && !isEnded ? (
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Due</span>{" "}
              <span className="font-bold text-foreground">
                {deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </p>
          ) : null}
        </div>

        <div className="mt-6">
          {isEnded ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3.5 text-sm font-semibold text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              This commitment has ended — nothing left to review.
            </div>
          ) : canAcceptInvite ? (
            <div className="space-y-3 rounded-2xl border border-delulu-blue/30 bg-delulu-blue-light/40 p-4">
              <p className="text-sm text-foreground">
                {creatorLabel(commitment)} named you to verify this commitment. Accept to become
                their verifier — you&apos;ll review their proof and confirm whether they completed it.
              </p>
              {actionStep === "error" && actionError ? (
                <p className="text-xs font-semibold text-red-500">{actionError}</p>
              ) : null}
              <button
                type="button"
                disabled={isAccepting || actionStep === "working"}
                onClick={() => void handleAccept()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-delulu-charcoal py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {isAccepting || actionStep === "working" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Accept and become verifier
              </button>
            </div>
          ) : isResolvedVerifier ? (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
              {commitment.currentPeriod?.proofUrl ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Proof submitted</p>
                  <a
                    href={commitment.currentPeriod.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-border/60"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={commitment.currentPeriod.proofUrl}
                      alt="Submitted proof"
                      className="w-full object-cover"
                    />
                  </a>
                  {actionStep === "error" && actionError ? (
                    <p className="text-xs font-semibold text-red-500">{actionError}</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={isResolving || actionStep === "working"}
                    onClick={() => void handleApprove()}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-delulu-charcoal py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {isResolving || actionStep === "working" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Confirm completed
                  </button>
                  <p className="text-xs text-muted-foreground">
                    If you don&apos;t respond before the deadline, this resolves as missed automatically.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You&apos;re set as the verifier. {creatorLabel(commitment)} hasn&apos;t submitted proof for
                  this period yet — check back closer to the deadline.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3.5 text-sm text-muted-foreground">
              {commitment.verifierWallet
                ? "Only the assigned verifier can review this commitment."
                : "This commitment isn't set up for verifier review."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
