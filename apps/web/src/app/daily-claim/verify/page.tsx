"use client";

import { useEffect, useMemo } from "react";
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

        <div className="rounded-2xl border border-border bg-card p-3">
          {fvLink ? (
            <iframe
              src={fvLink}
              title="GoodDollar verification"
              className="h-[70vh] w-full rounded-xl border border-border"
              allow="camera; microphone"
            />
          ) : (
            <div className="flex h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing verification...
            </div>
          )}
        </div>

        {fvLink && (
          <button
            type="button"
            onClick={() => window.open(fvLink, "_blank", "noopener,noreferrer")}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold"
          >
            Open in new tab
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}

        <p className="text-xs text-muted-foreground">
          Status: {status === "verified" ? "Verified" : "Waiting for verification"}
        </p>
      </div>
    </div>
  );
}

