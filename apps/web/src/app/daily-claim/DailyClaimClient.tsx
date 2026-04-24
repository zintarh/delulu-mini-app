"use client";

import { useEffect, useMemo, useState } from "react";
import { useBalance } from "wagmi";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Wallet, Loader2 } from "lucide-react";
import { formatUnits } from "viem";
import { cn, formatGAmount } from "@/lib/utils";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { Pill } from "@/components/ui/pill";

const FaucetModal = dynamic(
  () => import("@/components/faucet-modal").then((m) => m.FaucetModal),
  { ssr: false },
);
const IdentityFlow = dynamic(() => import("./IdentityFlow"), { ssr: false });

export default function DailyClaimClient() {
  const { address, authenticated, isReady } = useAuth();
  const router = useRouter();
  const {
    isLoading: isClaimDataLoading,
    isClaiming,
    isWhitelisted,
    entitlement,
    hasClaimed,
    nextClaimTime,
    claim,
    isInitialized,
  } = useGoodDollarClaim();

  const [showFaucet, setShowFaucet] = useState(false);
  const [showIdentityFlow, setShowIdentityFlow] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!authenticated) {
      router.replace("/sign-in");
    }
  }, [isReady, authenticated, router]);

  const handleProfileClick = () => {
    if (!authenticated) router.push("/sign-in");
    else router.push("/profile");
  };
  const handleCreateClick = () => {
    if (!authenticated) router.push("/sign-in");
    else router.push("/board");
  };

  const { formatted: gDollarBalance, isLoading: isGdLoading } = useTokenBalance(
    GOODDOLLAR_ADDRESSES.mainnet,
  );

  const { data: celoBalance, isLoading: isCeloLoading } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!address },
  });

  const handleConnectClick = () => {
    router.push("/sign-in");
  };

  const handleClaim = async () => {
    if (!authenticated) {
      router.push("/sign-in");
      return;
    }
    if (!address) return;

    if (!isWhitelisted) {
      setShowIdentityFlow(true);
      return;
    }

    await claim();
  };

  const formattedEntitlement = useMemo(() => {
    if (entitlement === null) return null;
    return formatUnits(entitlement, 18);
  }, [entitlement]);

  return (
    <div className="h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar onProfileClick={handleProfileClick} onCreateClick={handleCreateClick} />
        </div>

        <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background">
          <div className="max-w-3xl mx-auto px-4 py-6 lg:py-10 pb-24 lg:pb-10">
            <div className="flex items-center justify-between mb-6">
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

              <span className="hidden sm:inline-flex items-center rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                daily good vibes · powered by GoodDollar
              </span>
            </div>

            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight mb-2">
                Claim your daily G$ UBI
              </h1>
              <p className="text-sm text-muted-foreground max-w-md">
                Wake up, claim G$, and keep being deliciously delusional. Your
                basic income, straight from the Delulu island.
              </p>
            </div>

            <div className="space-y-4">
              <section className="rounded-3xl border-2 border-border bg-gradient-to-br from-delulu-yellow-reserved/80 via-card to-card p-4 mb-6 lg:p-6 shadow-[4px_4px_0px_0px_#1A1A1A]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[11px] font-black text-accent-foreground uppercase mb-1 tracking-[0.08em]">
                      Your GoodDollar wallet
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {authenticated && address
                        ? `${address.slice(0, 6)}...${address.slice(-4)}`
                        : "Not connected"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end justify-center h-full gap-2">
                    <Pill
                      variant="outline"
                      size="md"
                      className="inline-flex items-center gap-2 px-3 py-1.5"
                    >
                      <img
                        src="/gooddollar-logo.png"
                        alt="G$"
                        className="h-5 w-5 rounded-full"
                      />
                      <span className="text-sm font-semibold leading-tight">
                        {isGdLoading
                          ? "…"
                          : gDollarBalance && Number(gDollarBalance) > 0
                            ? formatGAmount(Number(gDollarBalance))
                            : "0"}
                      </span>
                    </Pill>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-background/60 border border-border">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {!authenticated ? (
                  <button
                    onClick={handleConnectClick}
                    className={cn(
                      "w-fit px-4 py-3 text-sm font-medium",
                      "bg-delulu-yellow-reserved text-delulu-charcoal",
                      "rounded-md border-2 border-border",
                      "shadow-[3px_3px_0px_0px_#1A1A1A]",
                      "hover:bg-delulu-yellow-reserved/90 active:scale-[0.98] transition-all",
                    )}
                  >
                    Connect wallet to claim
                  </button>
                ) : (
                  <div className="space-y-4">
                    {entitlement !== null && entitlement > 0n && (
                      <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black text-muted-foreground uppercase mb-1">
                            Entitlement
                          </p>
                          {isClaimDataLoading || !isInitialized ? (
                            <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                          ) : (
                            <p className="text-lg font-black text-foreground">
                              {formattedEntitlement !== null
                                ? `${parseFloat(formattedEntitlement).toFixed(2)}`
                                : "--"}{" "}
                              <span className="text-xs text-muted-foreground">
                                G$
                              </span>
                            </p>
                          )}
                        </div>
                        {!hasClaimed && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                            Daily claim available
                          </span>
                        )}
                      </div>
                    )}

                    {isClaimDataLoading || !isInitialized ? (
                      <div className="rounded-xl border border-border bg-muted p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Checking eligibility…</span>
                      </div>
                    ) : hasClaimed ? (
                      <div className="rounded-xl border border-border bg-muted p-4 text-center space-y-1.5">
                        {nextClaimTime && (
                          <p className="text-sm font-medium text-muted-foreground">
                            Next claim:&nbsp;
                            <span className="font-semibold text-foreground">
                              {nextClaimTime.toLocaleString()}
                            </span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={handleClaim}
                        disabled={isClaiming || hasClaimed || !address}
                        className={cn(
                          "w-fit px-4 py-3 text-sm font-medium",
                          "bg-delulu-yellow-reserved text-delulu-charcoal",
                          "rounded-md border-2 border-border",
                          "shadow-[3px_3px_0px_0px_#1A1A1A]",
                          "hover:bg-delulu-yellow-reserved/90 active:scale-[0.98] transition-all",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          "flex items-center justify-center gap-2",
                        )}
                      >
                        {isClaiming ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Claiming...
                          </>
                        ) : entitlement !== null && entitlement > 0n ? (
                          `Claim ${parseFloat(
                            formattedEntitlement || "0.00",
                          ).toFixed(2)} G$`
                        ) : (
                          "Claim G$"
                        )}
                      </button>
                    )}
                  </div>
                )}
              </section>

             
            </div>
          </div>
        </main>

        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>

      <BottomNav onProfileClick={handleProfileClick} onCreateClick={handleCreateClick} />

      <IdentityFlow
        open={showIdentityFlow}
        onOpenChange={setShowIdentityFlow}
        onVerified={() => {
          setShowIdentityFlow(false);
          claim();
        }}
      />

      <FaucetModal open={showFaucet} onOpenChange={setShowFaucet} />
    </div>
  );
}