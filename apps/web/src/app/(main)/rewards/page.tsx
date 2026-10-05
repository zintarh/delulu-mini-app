"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBalance } from "wagmi";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ExternalLink,
  Gift,
  Loader2,
  Send as SendIcon,
  Sparkles,
  Wallet,
} from "lucide-react";

import { formatUnits } from "viem";
import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { useCeloPrice } from "@/hooks/use-celo-price";
import { useGraphUserClaims } from "@/hooks/graph/useGraphUserClaims";
import { useGraphUserForfeitActivity } from "@/hooks/graph/useGraphUserForfeitActivity";
import { useAdminRewardGrants } from "@/hooks/use-admin-reward-grants";
import { useClaimAllAdminRewards } from "@/hooks/use-claim-all-admin-rewards";
import { ForfeitDestinationType } from "@/hooks/use-create-forfeit-commitment";
import { TokenBadge } from "@/components/token-badge";
import { WalletClaimsTab } from "@/components/wallet/wallet-claims-tab";
import { TransferSheet } from "@/components/transfer-sheet";
import { MainPage } from "@/components/main-app-header";
import { Chest, Coin, GameButton, GameCard, Segmented } from "@/components/ds";
import { DailyMoneyCard } from "@/components/home/daily-money-card";
import {
  CELO_MAINNET_ID,
  CUSD_ADDRESSES,
  GOODDOLLAR_ADDRESSES,
  USDT_ADDRESSES,
  KNOWN_TOKEN_SYMBOLS,
  REWARD_CLAIM_ENABLED,
} from "@/lib/constant";
import { toUsdAmount, getTokenDecimals } from "@/lib/token-amounts";
import { cn, formatGAmount, formatTimeAgo } from "@/lib/utils";

type ActivityItem = {
  id: string;
  kind: "team_reward" | "delulu_claim" | "forfeit_success" | "forfeit_sent";
  title: string;
  description: string | null;
  amountLabel: string;
  txHash: string;
  createdAt: string;
};

function forfeitDestinationLabel(type: number | null): string {
  switch (type) {
    case ForfeitDestinationType.Charity:
      return "charity";
    case ForfeitDestinationType.Friend:
      return "a friend";
    case ForfeitDestinationType.CommunityPool:
      return "Delulu";
    default:
      return "its destination";
  }
}

const MANROPE = { fontFamily: "var(--font-body)" } as const;

type WalletTab = "tokens" | "claims" | "activity";

const WALLET_TABS: { id: WalletTab; label: string }[] = [
  { id: "claims", label: "Claims" },
  { id: "tokens", label: "Tokens" },
  { id: "activity", label: "Activity" },
];

export default function RewardsPage() {
  const router = useRouter();
  const { address, isConnected, isReady } = useAuth();
  const [sendOpen, setSendOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WalletTab>("claims");
  const [optimisticSpend, setOptimisticSpend] = useState({
    gdollar: 0,
    celo: 0,
    cusd: 0,
    usdt: 0,
  });
  const sessionHint = hasStoredAuthSession();
  const [restoreTimedOut, setRestoreTimedOut] = useState(false);
  const {
    hasPending: hasAdminPending,
    isLoading: isLoadingAdminRewards,
    isClaiming: isClaimingAdmin,
    error: adminClaimError,
    claimAll: claimAllAdminRewards,
    pendingByToken: adminPendingByToken,
  } = useClaimAllAdminRewards(address);

  const adminPendingRows = adminPendingByToken
    .filter((t) => t.pending > 0n)
    .map((t) => {
      const decimals = getTokenDecimals(t.token);
      const amount = parseFloat(formatUnits(t.pending, decimals));
      const symbol = KNOWN_TOKEN_SYMBOLS[t.token.toLowerCase()] ?? "";
      return {
        token: t.token,
        amount,
        symbol,
        display: `${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`,
      };
    });
  const primaryPending =
    adminPendingRows.find((r) => r.token.toLowerCase() === GOODDOLLAR_ADDRESSES.mainnet.toLowerCase()) ??
    adminPendingRows[0] ??
    null;
  const secondaryPending = adminPendingRows.filter((r) => r !== primaryPending);
  const { claims, isLoading: isLoadingClaims, error: claimsError } = useGraphUserClaims(address);
  const {
    grants: teamGrants,
    isLoading: isLoadingGrants,
    error: grantsError,
  } = useAdminRewardGrants(address);
  const {
    activity: forfeitActivity,
    isLoading: isLoadingForfeitActivity,
    error: forfeitActivityError,
  } = useGraphUserForfeitActivity(address);

  const activityItems = useMemo((): ActivityItem[] => {
    const fromClaims: ActivityItem[] = claims.map((claim) => ({
      id: `claim-${claim.id}`,
      kind: "delulu_claim",
      title: "Reward claimed",
      description: null,
      amountLabel: `+${formatGAmount(claim.amount)} G$`,
      txHash: claim.txHash,
      createdAt: claim.createdAt,
    }));

    const fromGrants: ActivityItem[] = teamGrants.map((grant) => {
      const symbol = grant.tokenSymbol || "token";
      const amountStr =
        symbol === "G$"
          ? formatGAmount(grant.amount)
          : grant.amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
      return {
        id: `grant-${grant.id}`,
        kind: "team_reward",
        title: "Reward received",
        description: grant.reason?.trim() || null,
        amountLabel: `+${amountStr} ${symbol}`,
        txHash: grant.txHash,
        createdAt: grant.createdAt,
      };
    });

    const fromForfeits: ActivityItem[] = forfeitActivity.map((item) => {
      const amountStr = item.amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
      if (item.outcome === "forfeited") {
        return {
          id: `forfeit-${item.id}`,
          kind: "forfeit_sent",
          title: `Sent to ${forfeitDestinationLabel(item.destinationType)}`,
          description: null,
          amountLabel: `-${amountStr} ${item.tokenSymbol}`,
          txHash: item.txHash,
          createdAt: item.createdAt,
        };
      }
      return {
        id: `forfeit-${item.id}`,
        kind: "forfeit_success",
        title: "Stake returned",
        description: null,
        amountLabel: `+${amountStr} ${item.tokenSymbol}`,
        txHash: item.txHash,
        createdAt: item.createdAt,
      };
    });

    return [...fromClaims, ...fromGrants, ...fromForfeits].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [claims, teamGrants, forfeitActivity]);

  const isLoadingActivity = isLoadingClaims || isLoadingGrants || isLoadingForfeitActivity;
  const activityError = claimsError || grantsError || forfeitActivityError;

  const {
    formatted: gDollarBalance,
    isLoading: isGdLoading,
    error: gdError,
    refetch: refetchGd,
  } = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const {
    formatted: cusdBalance,
    isLoading: isCusdLoading,
    error: cusdError,
    refetch: refetchCusd,
  } = useTokenBalance(CUSD_ADDRESSES.mainnet);
  const {
    formatted: usdtBalance,
    isLoading: isUsdtLoading,
    error: usdtError,
    refetch: refetchUsdt,
  } = useTokenBalance(USDT_ADDRESSES.mainnet);
  const {
    data: celoBalance,
    isLoading: isCeloLoading,
    error: celoError,
    refetch: refetchCelo,
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

  const gdDisplay = Math.max(0, (gdBalanceNum ?? 0) - optimisticSpend.gdollar);
  const cusdDisplay = Math.max(0, (cusdBalanceNum ?? 0) - optimisticSpend.cusd);
  const usdtDisplay = Math.max(0, (usdtBalanceNum ?? 0) - optimisticSpend.usdt);
  const celoDisplay = Math.max(0, (celoBalanceNum ?? 0) - optimisticSpend.celo);

  const gdUsd = gdBalanceNum != null ? toUsdAmount(gdDisplay, GOODDOLLAR_ADDRESSES.mainnet, gdPrice) : null;
  const cusdUsd = cusdBalanceNum != null ? toUsdAmount(cusdDisplay, CUSD_ADDRESSES.mainnet, null) : null;
  const usdtUsd = usdtBalanceNum != null ? toUsdAmount(usdtDisplay, USDT_ADDRESSES.mainnet, null) : null;
  const celoUsd = celoBalanceNum != null && celoPrice != null ? celoDisplay * celoPrice : null;

  const usdLegs = [gdUsd, cusdUsd, usdtUsd, celoUsd];
  const knownUsdLegs = usdLegs.filter((v): v is number => v != null);
  const totalUsd = knownUsdLegs.reduce((sum, v) => sum + v, 0);
  const hasAnyUsdValue = knownUsdLegs.length > 0;
  const isTotalPartial = usdLegs.some((v) => v == null);

  const balancesLoaded = !isGdLoading && !isCusdLoading && !isUsdtLoading && !isCeloLoading;
  const hasSendableBalance =
    gdDisplay > 0 || cusdDisplay > 0 || usdtDisplay > 0 || celoDisplay > 0;

  // Drop optimistic spends once RPC balances have caught up (full drain),
  // or when the raw balance alone already reflects the spend.
  useEffect(() => {
    setOptimisticSpend((prev) => {
      if (
        prev.gdollar === 0 &&
        prev.cusd === 0 &&
        prev.usdt === 0 &&
        prev.celo === 0
      ) {
        return prev;
      }
      const next = { ...prev };
      let changed = false;
      // If chain balance is already at/under the optimistic remainder (≈0 after full send), clear.
      if (prev.gdollar > 0 && gdBalanceNum != null && gdBalanceNum <= 1e-9) {
        next.gdollar = 0;
        changed = true;
      }
      if (prev.cusd > 0 && cusdBalanceNum != null && cusdBalanceNum <= 1e-9) {
        next.cusd = 0;
        changed = true;
      }
      if (prev.usdt > 0 && usdtBalanceNum != null && usdtBalanceNum <= 1e-9) {
        next.usdt = 0;
        changed = true;
      }
      if (prev.celo > 0 && celoBalanceNum != null && celoBalanceNum <= 1e-9) {
        next.celo = 0;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [gdBalanceNum, cusdBalanceNum, usdtBalanceNum, celoBalanceNum]);

  useEffect(() => {
    if (!sessionHint || isConnected) {
      setRestoreTimedOut(false);
      return;
    }
    const id = window.setTimeout(() => setRestoreTimedOut(true), 3_000);
    return () => window.clearTimeout(id);
  }, [sessionHint, isConnected]);


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
        <div className="mx-auto w-full">
        <div className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-10 pt-2 lg:pt-6">
          <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Rewards</h1>

          {/* Balance */}
          <GameCard className="p-4">
            <div className="flex items-center gap-3.5">
              <span className="animate-bounce-in">
                <Coin size={52} />
              </span>
              <div className="min-w-0">
                <div className="label-mono text-[10px] text-muted-foreground">Total balance</div>
                <div
                  className={cn(
                    "font-display text-[40px] font-extrabold leading-none tabular-nums",
                    !hasAnyUsdValue && "text-muted-foreground",
                  )}
                >
                  {!balancesLoaded
                    ? "—"
                    : `${isTotalPartial ? "≈ " : ""}$${totalUsd.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </div>
                {gdError ? (
                  <p className="mt-1 text-[11px] font-semibold text-orange">Couldn&apos;t load your balance. Try again.</p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <GameButton
                variant="line"
                size="sm"
                disabled={balancesLoaded && !hasSendableBalance}
                onClick={() => setSendOpen(true)}
              >
                <SendIcon className="h-4 w-4" strokeWidth={2.4} />
                Send
              </GameButton>
              <GameButton variant="line" size="sm" onClick={() => setActiveTab("tokens")}>
                <Wallet className="h-4 w-4" strokeWidth={2.4} />
                Tokens
              </GameButton>
            </div>
          </GameCard>

          {/* Free daily money (GoodDollar UBI) */}
          <DailyMoneyCard />

          {/* Team rewards ready to claim */}
          <GameCard tone={hasAdminPending ? "green" : "default"} className="flex items-center gap-3 px-3.5 py-3">
            <span className={cn("inline-block", hasAdminPending && "animate-wiggle")}>
              <Chest size={44} grey={!hasAdminPending} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold">Rewards to claim</div>
              <div className="label-mono mt-0.5 truncate text-[10px] text-muted-foreground">
                {isLoadingAdminRewards
                  ? "Checking…"
                  : primaryPending
                    ? `${primaryPending.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${primaryPending.symbol}${
                        secondaryPending.length > 0 ? ` + ${secondaryPending.map((r) => r.display).join(" + ")}` : ""
                      }`
                    : "Nothing yet"}
              </div>
            </div>
            <GameButton
              variant="green"
              size="sm"
              disabled={!REWARD_CLAIM_ENABLED || !hasAdminPending || isClaimingAdmin}
              onClick={() => {
                setSendOpen(false);
                // Confetti fires inside claimAll on the first mined success.
                void claimAllAdminRewards();
              }}
            >
              {isClaimingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Claim
            </GameButton>
          </GameCard>
          {adminClaimError ? <p className="-mt-4 text-[11px] font-semibold text-orange">{adminClaimError}</p> : null}

          <Segmented<WalletTab>
            ariaLabel="Wallet sections"
            value={activeTab}
            onChange={setActiveTab}
            options={WALLET_TABS.map(({ id, label }) => ({ value: id, label }))}
          />

          {activeTab === "tokens" ? (
            <section>
              <div className="overflow-hidden rounded-[20px] border-2 border-line bg-white shadow-edge">
                <div className="divide-y divide-border/40">
                  <TokenListRow
                    tokenAddress={GOODDOLLAR_ADDRESSES.mainnet}
                    label="GoodDollar"
                    symbol="G$"
                    value={
                      isGdLoading || gdError
                        ? "—"
                        : formatGAmount(gdDisplay)
                    }
                    usdValue={gdUsd != null ? `≈ $${gdUsd.toFixed(2)}` : null}
                  />
                  <TokenListRow
                    logo="/celo.png"
                    label="Celo"
                    symbol="CELO"
                    value={celoBalanceNum != null ? celoDisplay.toFixed(3) : "—"}
                    usdValue={celoUsd != null ? `≈ $${celoUsd.toFixed(2)}` : null}
                  />
                  <TokenListRow
                    tokenAddress={CUSD_ADDRESSES.mainnet}
                    label="cUSD"
                    symbol="cUSD"
                    value={cusdBalanceNum != null ? cusdDisplay.toFixed(2) : "—"}
                    usdValue={cusdUsd != null ? `≈ $${cusdUsd.toFixed(2)}` : null}
                  />
                  <TokenListRow
                    tokenAddress={USDT_ADDRESSES.mainnet}
                    label="Tether"
                    symbol="USDT"
                    value={usdtBalanceNum != null ? usdtDisplay.toFixed(2) : "—"}
                    usdValue={usdtUsd != null ? `≈ $${usdtUsd.toFixed(2)}` : null}
                  />
                </div>
              </div>
            </section>
          ) : activeTab === "claims" ? (
            <section>
              <WalletClaimsTab address={address} />
            </section>
          ) : (
            <section>
              <div className="overflow-hidden rounded-[20px] border-2 border-line bg-white shadow-edge">
                {isLoadingActivity && activityItems.length === 0 ? (
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
                ) : activityError && activityItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">Couldn&apos;t load activity</p>
                    <p className="text-xs text-muted-foreground">
                      Check your connection and try again.
                    </p>
                  </div>
                ) : activityItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/60">
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">No transactions yet</p>
                    <p className="text-xs text-muted-foreground">
                      Rewards you receive or claim will show up here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {activityItems.map((item) => (
                      <ActivityRow key={item.id} item={item} />
                    ))}
                    {activityError ? (
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

      <TransferSheet
        open={sendOpen}
        onOpenChange={setSendOpen}
        onTransferBroadcast={({ tokenId, amount }) => {
          setOptimisticSpend((prev) => ({
            ...prev,
            [tokenId]: prev[tokenId] + amount,
          }));
        }}
        onTransferFailed={({ tokenId, amount }) => {
          setOptimisticSpend((prev) => ({
            ...prev,
            [tokenId]: Math.max(0, prev[tokenId] - amount),
          }));
        }}
        onTransferSuccess={() => {
          // Sheet already refetched shared wagmi balances; clear deltas before a
          // parent re-render can double-subtract against the new raw values.
          setOptimisticSpend({ gdollar: 0, celo: 0, cusd: 0, usdt: 0 });
          void Promise.all([refetchGd(), refetchCusd(), refetchUsdt(), refetchCelo()]);
        }}
      />
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

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <a
      href={`https://celoscan.io/tx/${item.txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          item.kind === "team_reward"
            ? "bg-yellow-soft text-ink"
            : item.kind === "forfeit_sent"
              ? "bg-orange-soft text-orange"
              : "bg-green-soft text-green-edge",
        )}
      >
        {item.kind === "team_reward" ? (
          <Gift className="h-4 w-4" />
        ) : item.kind === "forfeit_sent" ? (
          <ArrowUpFromLine className="h-4 w-4" />
        ) : (
          <ArrowDownToLine className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground" style={MANROPE}>
          {item.title}
        </p>
        {item.description ? (
          <p className="truncate text-xs text-muted-foreground" style={MANROPE}>
            {item.description}
          </p>
        ) : null}
        <p className="text-[11px] text-muted-foreground/80" style={MANROPE}>
          {formatTimeAgo(new Date(item.createdAt))}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            item.kind === "forfeit_sent" ? "text-orange" : "text-green-edge",
          )}
        >
          {item.amountLabel}
        </span>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
    </a>
  );
}
