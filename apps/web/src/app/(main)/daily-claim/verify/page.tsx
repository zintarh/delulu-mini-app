"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIdentity } from "@/hooks/identityHook";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { isStandalone } from "@/hooks/use-install-prompt";

export default function VerifyGoodDollarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected } = useAuth();
  const { status, isVerified, isLapsed, fvLink, setIsVerifying, generateLink } = useIdentity();
  const { formatted: gDollarBalance, isLoading: isGdLoading } = useTokenBalance(
    GOODDOLLAR_ADDRESSES.mainnet,
  );

  const returnTo = useMemo(() => {
    const raw = searchParams.get("returnTo");
    if (!raw || !raw.startsWith("/")) return "/forfeit";
    return raw;
  }, [searchParams]);

  const gdBalance = Number(gDollarBalance || "0");

  // Installed as a PWA (standalone display mode) has no tab/window chrome
  // at all, so window.open() has nowhere to put a new tab — it just
  // returns null and silently does nothing, both for the auto-open below
  // and for the old "reopen" button's own window.open call. A real <a>
  // tag the user taps themselves is the one thing that reliably still
  // escapes the standalone shell (iOS kicks a genuine anchor tap out to
  // Safari; Android hands cross-origin anchor taps to the system browser),
  // so that's the primary path now — window.open is only attempted as a
  // convenience when we're in an ordinary browser tab, where it already works.
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    setStandalone(isStandalone());
  }, []);

  useEffect(() => {
    setIsVerifying(true);
    return () => setIsVerifying(false);
  }, [setIsVerifying]);

  // Auto-open the verification link in a new tab as soon as it's ready —
  // GoodDollar's flow (camera access, device checks) is unreliable inside an
  // iframe, so the tab is the primary path in a normal browser. Guarded by
  // link so it only fires once per generated fvLink, not on every
  // background status poll. Skipped entirely when standalone — see above.
  const autoOpenedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!fvLink || isVerified || standalone) return;
    if (autoOpenedForRef.current === fvLink) return;
    autoOpenedForRef.current = fvLink;
    window.open(fvLink, "_blank", "noopener,noreferrer");
  }, [fvLink, isVerified, standalone]);

  // Resending the same fvLink just resends whatever already failed/expired
  // on GoodDollar's side (e.g. FVFlowError) — generateLink() requests a
  // fresh one and updates fvLink itself, so the visible <a> below just
  // re-renders with the new href on its own.
  const handleRefreshLink = async () => {
    await generateLink();
  };

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
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-xl font-extrabold">Verify & claim free G$</h1>
        <p className="text-sm text-muted-foreground">
          Complete the GoodDollar check below. Once G$ arrives, we will take you back to create
          your goal.
        </p>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          {fvLink ? (
            <>
              <p className="text-sm font-semibold text-foreground">
                {standalone
                  ? "Tap below to verify"
                  : isLapsed
                    ? "Quick re-check opened in a new tab"
                    : "Verification opened in a new tab"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isLapsed
                  ? "Your last verification expired — this refreshes it, only takes a minute."
                  : "Finish it there, then come back here — we’ll pick it up automatically."}
              </p>
              <a
                href={fvLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Open verification
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for verification…
              </div>
              <button
                type="button"
                onClick={() => void handleRefreshLink()}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold"
              >
                Get a fresh link
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

