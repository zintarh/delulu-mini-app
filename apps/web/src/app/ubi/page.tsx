"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { ArrowLeft, Wallet, Info, Loader2 } from "lucide-react";
import { formatUnits } from "viem";
import { cn } from "@/lib/utils";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useIdentity } from "@/hooks/identityHook";
import { IdentityModal } from "@/components/identity-modal";

export default function GoodDollarClaimPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const {
    isLoading,
    isClaiming,
    entitlement,
    hasClaimed,
    nextClaimTime,
    claim,
  } = useGoodDollarClaim();

  const {
    status: identityStatus,
    isVerified,
    fvLink,
    isVerifying,
    setIsVerifying,
    refresh,
    isLoading: isIdentityLoading,
  } = useIdentity();

  const [showLoginSheet, setShowLoginSheet] = useState(false);

  const handleConnectClick = () => {
    setShowLoginSheet(true);
  };

  const handleClaim = async () => {
    if (!isConnected) {
      setShowLoginSheet(true);
      return;
    }

    if (!isVerified) {
      setIsVerifying(true);
      return;
    }

    await claim();
  };

  // Format entitlement from BigInt (display only)
  const formattedEntitlement = useMemo(() => {
    if (entitlement === null) return null;
    return formatUnits(entitlement, 18);
  }, [entitlement]);

  return (
    <div className="h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={() => router.push("/profile")}
            onCreateClick={() => router.push("/board")}
          />
        </div>

        <main className="h-screen lg:border-x border-gray-200 overflow-y-auto scrollbar-hide">
          <div className="max-w-3xl mx-auto px-4 py-6 lg:py-10">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => router.back()}
                className={cn(
                  "inline-flex items-center gap-2 text-xs font-bold",
                  "px-3 py-1.5 rounded-full border-2 border-delulu-charcoal",
                  "bg-delulu-yellow-reserved shadow-[2px_2px_0px_0px_#1A1A1A]",
                  "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#1A1A1A]",
                  "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
                  "text-delulu-charcoal transition-all"
                )}
              >
                <ArrowLeft className="w-3 h-3" />
                Back
              </button>

              <span className="hidden sm:inline-flex items-center rounded-full border border-delulu-charcoal/20 bg-white/70 px-3 py-1 text-[11px] font-semibold text-delulu-charcoal/80">
                daily good vibes · powered by GoodDollar
              </span>
            </div>

            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-black text-delulu-charcoal tracking-tight mb-2">
                Claim your daily G$ UBI
              </h1>
              <p className="text-sm text-delulu-charcoal/80 max-w-md">
                Wake up, claim G$, and keep being deliciously delusional. Your
                basic income, straight from the Delulu island.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <section className="rounded-3xl border-2 border-delulu-charcoal bg-gradient-to-br from-delulu-yellow-reserved/80 via-white to-white p-4 lg:p-6 shadow-[4px_4px_0px_0px_#1A1A1A]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[11px] font-black text-delulu-charcoal/60 uppercase mb-1 tracking-[0.08em]">
                      Your GoodDollar wallet
                    </p>
                    <p className="text-sm font-semibold text-delulu-charcoal">
                      {isConnected && address
                        ? `${address.slice(0, 6)}...${address.slice(-4)}`
                        : "Not connected"}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-delulu-charcoal text-delulu-yellow-reserved flex items-center justify-center shadow-[3px_3px_0px_0px_#1A1A1A]">
                    <Wallet className="w-5 h-5" />
                  </div>
                </div>

                {!isConnected ? (
                  <button
                    onClick={handleConnectClick}
                    className={cn(
                      "w-full px-4 py-3 text-sm font-medium",
                      "bg-delulu-yellow-reserved text-delulu-charcoal",
                      "rounded-md border-2 border-delulu-charcoal",
                      "shadow-[3px_3px_0px_0px_#1A1A1A]",
                      "hover:bg-delulu-yellow-reserved/90 active:scale-[0.98] transition-all"
                    )}
                  >
                    Connect wallet to claim
                  </button>
                ) : (
                  <div className="space-y-4">
                    {/* Entitlement Card */}
                    {entitlement !== null && (
                      <div className="rounded-xl border border-gray-200 bg-white p-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black text-gray-500 uppercase mb-1">
                            {/* Entitlement from SDK is the *next* amount you can claim, not what you've already claimed */}
                            Entitlement
                          </p>
                          {isLoading ? (
                            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
                          ) : (
                            <p className="text-lg font-black text-delulu-charcoal">
                              {formattedEntitlement !== null
                                ? `${parseFloat(formattedEntitlement).toFixed(2)}`
                                : "--"}{" "}
                              <span className="text-xs text-gray-500">G$</span>
                            </p>
                          )}
                        </div>
                        {!hasClaimed && entitlement > 0n && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-green-600" />
                            Ready
                          </span>
                        )}
                      </div>
                    )}

                    {/* Loading State */}
                    {isLoading || isIdentityLoading ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center">
                        <p className="text-xs text-gray-500">
                          Initializing GoodDollar SDK...
                        </p>
                      </div>
                    ) : hasClaimed ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center space-y-1.5">
                        
                        {nextClaimTime && (
                          <p className="text-sm font-medium text-gray-600">
                            Next claim:&nbsp;
                            <span className="font-semibold text-gray-900">
                              {nextClaimTime.toLocaleString()}
                            </span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={handleClaim}
                        disabled={isClaiming || hasClaimed}
                        className={cn(
                          "w-full px-4 py-3 text-sm font-medium",
                          "bg-delulu-yellow-reserved text-delulu-charcoal",
                          "rounded-md border-2 border-delulu-charcoal",
                          "shadow-[3px_3px_0px_0px_#1A1A1A]",
                          "hover:bg-delulu-yellow-reserved/90 active:scale-[0.98] transition-all",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          "flex items-center justify-center gap-2"
                        )}
                      >
                        {isClaiming ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Claiming...
                          </>
                        ) : entitlement !== null && entitlement > 0n ? (
                          `Claim ${parseFloat(formattedEntitlement || "0.00").toFixed(2)} G$`
                        ) : (
                          "Claim G$"
                        )}
                      </button>
                    )}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-delulu-charcoal" />
                    <p className="text-xs font-black text-gray-500 uppercase">
                      What is G$ UBI?
                    </p>
                  </div>
                  <p className="text-xs text-gray-600">
                    Claim daily GoodDollar (G$) from a yield-backed pool. Claim
                    directly from Delulu without leaving the app.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </main>

        {/* Right sidebar (desktop) */}
        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>


      <IdentityModal
        isOpen={isVerifying}
        onClose={() => setIsVerifying(false)}
        fvLink={fvLink}
        status={identityStatus}
        onRefresh={refresh}
      />

      <ConnectorSelectionSheet
        open={showLoginSheet}
        onOpenChange={setShowLoginSheet}
      />
    </div>
  );
}
