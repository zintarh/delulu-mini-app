"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIdentity } from "@/hooks/identityHook";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";

export default function VerifyGoodDollarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected } = useAuth();
  const { status, isVerified, fvLink, setIsVerifying } = useIdentity();
  const { formatted: gDollarBalance, isLoading: isGdLoading } = useTokenBalance(
    GOODDOLLAR_ADDRESSES.mainnet,
  );

  const returnTo = useMemo(() => {
    const raw = searchParams.get("returnTo");
    if (!raw || !raw.startsWith("/")) return "/board";
    return raw;
  }, [searchParams]);

  const gdBalance = Number(gDollarBalance || "0");

  useEffect(() => {
    setIsVerifying(true);
    return () => setIsVerifying(false);
  }, [setIsVerifying]);

  // Auto-open the verification link in a new tab as soon as it's ready —
  // GoodDollar's flow (camera access, device checks) is unreliable inside an
  // iframe, so the tab is the primary path now. Guarded by link so it only
  // fires once per generated fvLink, not on every background status poll.
  const autoOpenedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!fvLink || isVerified) return;
    if (autoOpenedForRef.current === fvLink) return;
    autoOpenedForRef.current = fvLink;
    window.open(fvLink, "_blank", "noopener,noreferrer");
  }, [fvLink, isVerified]);

  // Redirect once verified (even if G$ hasn't arrived yet — they'll claim on the next page)
  useEffect(() => {
    if (!isConnected) return;
    if (isVerified) {
      router.replace(returnTo);
      return;
    }
    // Fallback: also redirect if they somehow already have G$
    if (!isGdLoading && gdBalance > 0) {
      router.replace(returnTo);
    }
  }, [isConnected, isVerified, isGdLoading, gdBalance, returnTo, router]);

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-black">Verify & claim free G$</h1>
        <p className="text-sm text-muted-foreground">
          Complete the GoodDollar check below. Once G$ arrives, we will take you back to create
          your goal.
        </p>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          {fvLink ? (
            <>
              <p className="text-sm font-semibold text-foreground">
                Verification opened in a new tab
              </p>
              <p className="text-xs text-muted-foreground">
                Finish it there, then come back here — we&apos;ll pick it up automatically.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for verification…
              </div>
              <button
                type="button"
                onClick={() => window.open(fvLink, "_blank", "noopener,noreferrer")}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold"
              >
                Reopen the link
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing verification...
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Status: {status === "verified" ? "Verified" : "Waiting for verification"}
        </p>
      </div>
    </div>
  );
}

