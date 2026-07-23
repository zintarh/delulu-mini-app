"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBalance } from "wagmi";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownToLine,
  Award,
  ExternalLink,
  Gift,
  Send as SendIcon,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { useCeloPrice } from "@/hooks/use-celo-price";
import { useGraphUserStats } from "@/hooks/graph/useGraphUserStats";
import { useGraphUserClaims, type GraphClaim } from "@/hooks/graph/useGraphUserClaims";
import { useClaimPanel } from "@/contexts/right-panel-context";
import { TokenBadge } from "@/components/token-badge";
import { TransferSheet } from "@/components/transfer-sheet";
import { MainPage } from "@/components/main-app-header";
import {
  CELO_MAINNET_ID,
  CUSD_ADDRESSES,
  GOODDOLLAR_ADDRESSES,
  USDT_ADDRESSES,
} from "@/lib/constant";
import { toUsdAmount } from "@/lib/token-amounts";
import { cn, formatGAmount, formatTimeAgo } from "@/lib/utils";

const CLASH_DISPLAY = { fontFamily: '"Clash Display", sans-serif' } as const;
const MANROPE = { fontFamily: "var(--font-manrope)" } as const;

type WalletTab = "tokens" | "activity";

const WALLET_TABS: { id: WalletTab; label: string }[] = [
  { id: "tokens", label: "Tokens" },
  { id: "activity", label: "Activity" },
];

export default function WalletPage() {
  const router = useRouter();
  const { address, isConnected, isReady } = useAuth();
  const claimPanel = useClaimPanel();
  const [sendOpen, setSendOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WalletTab>("tokens");
  const sessionHint = hasStoredAuthSession();
  const [restoreTimedOut, setRestoreTimedOut] = useState(false);

  const {
    totalClaimed,
    isLoading: isLoadingStats,
    error: statsError,
  } = useGraphUserStats(address);
  const { claims, isLoading: isLoadingClaims, error: claimsError } = useGraphUserClaims(address);

  const {
    formatted: gDollarBalance,
    isLoading: isGdLoading,
    error: gdError,
  } = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const {
    formatted: cusdBalance,
    isLoading: isCusdLoading,
    error: cusdError,
  } = useTokenBalance(CUSD_ADDRESSES.mainnet);
  const {
    formatted: usdtBalance,
    isLoading: isUsdtLoading,
    error: usdtError,
  } = useTokenBalance(USDT_ADDRESSES.mainnet);
  const {
    data: celoBalance,
    isLoading: isCeloLoading,
    error: celoError,
  } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!address },
  });

  const { usd: gdPrice } = useGoodDollarPrice();
  const { usd: celoPrice } = useCeloPrice();

  const gdBalanceNum = !isGdLoading && !gdError ? parseFloat(gDollarBalance) || 0 : null;
  const cusdBalanceNum = !isCusdLoading && !cusdError ? parseFloat(cusdBalance) || 0 : null;
  const usdtBalanceNum = !isUsdtLoading && !usdtError ? parseFloat(usdtBalance) || 0 : null;
  const celoBalanceNum =
    !isCeloLoading && !celoError && celoBalance ? parseFloat(celoBalance.formatted) || 0 : null;

  const gdUsd = gdBalanceNum != null ? toUsdAmount(gdBalanceNum, GOODDOLLAR_ADDRESSES.mainnet, gdPrice) : null;
  const cusdUsd = cusdBalanceNum != null ? toUsdAmount(cusdBalanceNum, CUSD_ADDRESSES.mainnet, null) : null;
  const usdtUsd = usdtBalanceNum != null ? toUsdAmount(usdtBalanceNum, USDT_ADDRESSES.mainnet, null) : null;
  const celoUsd = celoBalanceNum != null && celoPrice != null ? celoBalanceNum * celoPrice : null;

  const usdLegs = [gdUsd, cusdUsd, usdtUsd, celoUsd];
  const knownUsdLegs = usdLegs.filter((v): v is number => v != null);
  const totalUsd = knownUsdLegs.reduce((sum, v) => sum + v, 0);
  const hasAnyUsdValue = knownUsdLegs.length > 0;
  const isTotalPartial = usdLegs.some((v) => v == null);

  useEffect(() => {
    if (!sessionHint || isConnected) {
      setRestoreTimedOut(false);
      return;
    }
    const id = window.setTimeout(() => setRestoreTimedOut(true), 3_000);
    return () => window.clearTimeout(id);
  }, [sessionHint, isConnected]);

  // Wait for whichever auth SDK actually restores this session before deciding the
  // user is signed out — `isReady` flips true as soon as EITHER SDK initializes,
  // which can race ahead of the one the current user's session actually lives in.
  const awaitingAuth = !restoreTimedOut && (!isReady || (!isConnected && sessionHint));

  useEffect(() => {
    if (!awaitingAuth && !isConnected) router.replace("/sign-in");
  }, [awaitingAuth, isConnected, router]);

  if (awaitingAuth || !isConnected || !address) {
    return (
      <MainPage>
        <div className="mx-auto w-full max-w-6xl">
          <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted/60" />
            <div className="h-5 w-20 animate-pulse rounded-md bg-muted/60" />
          </div>
          <div className="px-4 pt-5 space-y-6">
            <div className="h-48 w-full animate-pulse rounded-3xl bg-muted/40" />
            <div className="h-24 w-full animate-pulse rounded-2xl bg-muted/40" />
            <div className="h-40 w-full animate-pulse rounded-2xl bg-muted/40" />
          </div>
        </div>
      </MainPage>
    );
  }

  return (
    <>
      <MainPage>
        <div className="mx-auto w-full max-w-6xl">
        <div className="px-4 pt-5 pb-10 lg:pb-10 space-y-8">
          {/* Hero balance card */}
          <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-delulu-yellow-reserved/25 via-background to-background px-5 py-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(246,195,36,0.3),transparent_55%)] pointer-events-none" />
            <div className="relative">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                style={MANROPE}
              >
                Available balance
              </p>
              <div className="mt-2 flex items-end gap-2">
                <TokenBadge tokenAddress={GOODDOLLAR_ADDRESSES.mainnet} size="lg" showText={false} />
                <span
                  className="text-4xl font-black tabular-nums leading-none text-foreground"
                  style={CLASH_DISPLAY}
                >
                  {isGdLoading || gdError
                    ? "—"
                    : formatGAmount(parseFloat(gDollarBalance) || 0)}
                </span>
                <span className="pb-1 text-sm font-bold text-muted-foreground">G$</span>
              </div>
              {gdError ? (
                <p className="mt-1 text-[11px] font-medium text-destructive">
                  Couldn&apos;t load your balance — check your connection and try again.
                </p>
              ) : null}

              <p className="mt-1 text-xs font-semibold text-muted-foreground" style={MANROPE}>
                {hasAnyUsdValue ? (
                  <>
                    {isTotalPartial ? "≈ " : ""}${totalUsd.toFixed(2)} total across all assets
                  </>
                ) : (
                  "Total across all assets unavailable"
                )}
              </p>

              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5">
                <Award className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-600">
                  {isLoadingStats || statsError ? "—" : formatGAmount(totalClaimed)} G$ earned
                  all-time
                </span>
              </div>

              <div className="mt-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSendOpen(false);
                    claimPanel.open();
                  }}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-delulu-blue text-sm font-black text-white transition-all active:scale-[0.98] hover:opacity-90"
                >
                  <Gift className="h-4 w-4" />
                  Claim G$
                </button>
                <button
                  type="button"
                  onClick={() => {
                    claimPanel.close();
                    setSendOpen(true);
                  }}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background text-sm font-black text-foreground transition-all active:scale-[0.98] hover:bg-muted"
                >
                  <SendIcon className="h-4 w-4" />
                  Send
                </button>
              </div>
            </div>
          </section>

          {/* Tokens / Activity tabs */}
          <div className="flex items-center gap-4">
            {WALLET_TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "border-b pb-1 text-sm font-semibold tracking-wide transition-colors",
                  activeTab === id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                style={MANROPE}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "tokens" ? (
            <section>
              <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
                <div className="divide-y divide-border/40">
                  <TokenListRow
                    tokenAddress={GOODDOLLAR_ADDRESSES.mainnet}
                    label="GoodDollar"
                    symbol="G$"
                    value={
                      isGdLoading || gdError
                        ? "—"
                        : formatGAmount(parseFloat(gDollarBalance) || 0)
                    }
                    usdValue={gdUsd != null ? `≈ $${gdUsd.toFixed(2)}` : null}
                  />
                  <TokenListRow
                    logo="/celo.png"
                    label="Celo"
                    symbol="CELO"
                    value={celoBalanceNum != null ? celoBalanceNum.toFixed(3) : "—"}
                    usdValue={celoUsd != null ? `≈ $${celoUsd.toFixed(2)}` : null}
                  />
                  <TokenListRow
                    tokenAddress={CUSD_ADDRESSES.mainnet}
                    label="cUSD"
                    symbol="cUSD"
                    value={cusdBalanceNum != null ? cusdBalanceNum.toFixed(2) : "—"}
                    usdValue={cusdUsd != null ? `≈ $${cusdUsd.toFixed(2)}` : null}
                  />
                  <TokenListRow
                    tokenAddress={USDT_ADDRESSES.mainnet}
                    label="Tether"
                    symbol="USDT"
                    value={usdtBalanceNum != null ? usdtBalanceNum.toFixed(2) : "—"}
                    usdValue={usdtUsd != null ? `≈ $${usdtUsd.toFixed(2)}` : null}
                  />
                </div>
              </div>
            </section>
          ) : (
            <section>
              <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
                {isLoadingClaims ? (
                  <div className="divide-y divide-border/40">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted/60" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="h-3.5 w-28 animate-pulse rounded bg-muted/60" />
                          <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
                        </div>
                        <div className="h-4 w-14 animate-pulse rounded bg-muted/60" />
                      </div>
                    ))}
                  </div>
                ) : claimsError && claims.length === 0 ? (
                  <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">Couldn&apos;t load activity</p>
                    <p className="text-xs text-muted-foreground">
                      Check your connection and try again.
                    </p>
                  </div>
                ) : claims.length === 0 ? (
                  <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/60">
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">No transactions yet</p>
                    <p className="text-xs text-muted-foreground">
                      Rewards you claim will show up here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {claims.map((claim) => (
                      <TransactionRow key={claim.id} claim={claim} />
                    ))}
                    {claimsError ? (
                      <p className="px-4 py-2.5 text-center text-[11px] text-muted-foreground">
                        Couldn&apos;t refresh — showing your last loaded activity.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
        </div>
      </MainPage>

      <TransferSheet open={sendOpen} onOpenChange={setSendOpen} />
    </>
  );
}

function TokenListRow({
  logo,
  tokenAddress,
  label,
  symbol,
  value,
  usdValue,
}: {
  logo?: string;
  tokenAddress?: string;
  label: string;
  symbol: string;
  value: string;
  usdValue?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {logo ? (
        <img src={logo} alt="" className="h-10 w-10 shrink-0 rounded-full" />
      ) : tokenAddress ? (
        <TokenBadge tokenAddress={tokenAddress} size="md" showText={false} />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground" style={MANROPE}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground" style={MANROPE}>
          {symbol}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
        {usdValue ? (
          <p className="text-[11px] tabular-nums text-muted-foreground">{usdValue}</p>
        ) : null}
      </div>
    </div>
  );
}

function TransactionRow({ claim }: { claim: GraphClaim }) {
  return (
    <a
      href={`https://celoscan.io/tx/${claim.txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
        <ArrowDownToLine className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground" style={MANROPE}>
          Reward claimed
        </p>
        <p className="text-xs text-muted-foreground" style={MANROPE}>
          {formatTimeAgo(new Date(claim.createdAt))}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-sm font-bold tabular-nums text-emerald-600">
          +{formatGAmount(claim.amount)} G$
        </span>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
    </a>
  );
}
