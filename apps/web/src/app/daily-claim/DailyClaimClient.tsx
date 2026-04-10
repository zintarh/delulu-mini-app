"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { usePrivy } from "@privy-io/react-auth";
import { useIdentity } from "@/hooks/identityHook";

export default function DailyClaimClient() {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const { fvLink, isGeneratingLink, setIsVerifying } = useIdentity();
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Start the verification/claim flow as soon as the page mounts
  useEffect(() => {
    setIsVerifying(true);
    return () => setIsVerifying(false);
  }, [setIsVerifying]);

  const handleProfileClick = () => {
    if (!authenticated) router.push("/sign-in");
    else router.push("/profile");
  };
  const handleCreateClick = () => {
    if (!authenticated) router.push("/sign-in");
    else router.push("/board");
  };

  return (
    <div className="h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar onProfileClick={handleProfileClick} onCreateClick={handleCreateClick} />
        </div>

        <main className="h-screen lg:border-x border-border flex flex-col bg-background overflow-hidden pb-[calc(100px+max(env(safe-area-inset-bottom),8px))] lg:pb-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <button
              onClick={() => router.back()}
              className={cn(
                "inline-flex items-center gap-2 text-xs font-bold",
                "px-3 py-1.5 rounded-full border-2 border-border",
                "bg-delulu-yellow-reserved shadow-[2px_2px_0px_0px_#1A1A1A]",
                "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#1A1A1A]",
                "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
                "text-delulu-charcoal transition-all",
              )}
            >
              <ArrowLeft className="w-3 h-3" />
              Back
            </button>

            {fvLink && (
              <button
                type="button"
                onClick={() => window.open(fvLink, "_blank", "noopener,noreferrer")}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Open in new tab
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Device warning banner — always shown */}
          {fvLink && (
            <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="flex-1 text-xs text-amber-700 dark:text-amber-400 leading-snug">
                If you see a <span className="font-semibold">new device</span> or <span className="font-semibold">device change</span> error, open in a new tab to complete verification.
              </p>
              <button
                type="button"
                onClick={() => window.open(fvLink, "_blank", "noopener,noreferrer")}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
              >
                Open
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* iFrame */}
          <div className="relative flex-1 overflow-hidden">
            {(!fvLink || isGeneratingLink) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background z-10">
                <img
                  src="/gooddollar-logo.png"
                  alt="GoodDollar"
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing your claim…
                </div>
              </div>
            )}

            {fvLink && (
              <>
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background z-10">
                    <img
                      src="/gooddollar-logo.png"
                      alt="GoodDollar"
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading…
                    </div>
                  </div>
                )}
                <iframe
                  src={fvLink}
                  title="GoodDollar claim"
                  className="w-full h-full border-0"
                  allow="camera; microphone; clipboard-write"
                  onLoad={() => setIframeLoaded(true)}
                />
              </>
            )}
          </div>
        </main>

        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>

      <BottomNav onProfileClick={handleProfileClick} onCreateClick={handleCreateClick} />
    </div>
  );
}
