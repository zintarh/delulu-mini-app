"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { ArrowLeft, Wallet, Info, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { LoginScreen } from "@/components/login-screen";
import { useGoodDollarSDK } from "@/hooks/useGoodDollarSDK";
import { FeedbackModal } from "@/components/feedback-modal";

export default function GoodDollarClaimPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const {
    entitlement,
    nextClaimDate,
    canClaim,
    claim,
    isLoading,
    isClaiming,
    error,
    isReady,
  } = useGoodDollarSDK();

  const handleConnectClick = () => {
    router.push("/");
  };

  const handleClaim = async () => {
    try {
      await claim();
      setShowSuccessModal(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to claim G$";
      setErrorMessage(message);
      setShowErrorModal(true);
    }
  };

  // Format next claim time
  const nextClaimTimeText = nextClaimDate
    ? new Date(nextClaimDate).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  if (!isConnected) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={() => router.push("/profile")}
            onCreateClick={() => router.push("/board")}
          />
        </div>

        <main className="h-screen lg:border-x border-gray-200 overflow-y-auto scrollbar-hide">
          <div className="max-w-3xl mx-auto px-4 py-6 lg:py-10">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-delulu-charcoal mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="mb-6">
              <h1 className="text-2xl font-black text-delulu-charcoal">
                Claim your G$ UBI
              </h1>
            </div>

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <section className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-black text-gray-500 uppercase mb-1">
                  Your GoodDollar wallet
                </p>
                <p className="text-sm font-medium text-delulu-charcoal">
                  {isConnected && address
                    ? `${address.slice(0, 6)}...${address.slice(-4)}`
                    : "Not connected"}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-delulu-charcoal" />
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
                <div className="rounded-xl border border-gray-200 bg-white p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-gray-500 uppercase mb-1">
                      Today&apos;s entitlement
                    </p>
                    {isLoading ? (
                      <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
                    ) : error ? (
                      <p className="text-sm text-red-600">Error loading</p>
                    ) : (
                      <p className="text-lg font-black text-delulu-charcoal">
                        {entitlement !== null
                          ? `${parseFloat(entitlement).toFixed(2)}`
                          : "--"}{" "}
                        <span className="text-xs text-gray-500">G$</span>
                      </p>
                    )}
                  </div>
                  {canClaim && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-green-600" />
                      Ready
                    </span>
                  )}
                </div>

                {/* Claim Button */}
                {error && !isReady ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                    <p className="text-xs text-red-600">
                      {error.message || "GoodDollar SDK not available"}
                    </p>
                  </div>
                ) : !isReady ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center">
                    <p className="text-xs text-gray-500">
                      Initializing GoodDollar SDK...
                    </p>
                  </div>
                ) : canClaim ? (
                  <button
                    onClick={handleClaim}
                    disabled={isClaiming}
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
                    ) : (
                      `Claim ${entitlement ? parseFloat(entitlement).toFixed(2) : "0.00"} G$`
                    )}
                  </button>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs text-gray-600 text-center">
                      {nextClaimTimeText
                        ? `Next claim available: ${nextClaimTimeText}`
                        : "No entitlement available at this time"}
                    </p>
                  </div>
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

      {/* Success Modal */}
      <FeedbackModal
        isOpen={showSuccessModal}
        type="success"
        title="G$ Claimed Successfully! 🎉"
        message="Your GoodDollar UBI has been claimed and added to your wallet."
        onClose={() => setShowSuccessModal(false)}
        actionText="Done"
      />

      {/* Error Modal */}
      <FeedbackModal
        isOpen={showErrorModal}
        type="error"
        title="Claim Failed"
        message={errorMessage || "Failed to claim G$. Please try again."}
        onClose={() => setShowErrorModal(false)}
        actionText="Try Again"
      />
    </div>
  );
}
