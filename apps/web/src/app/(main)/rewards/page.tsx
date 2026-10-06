"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBalance } from "wagmi";
import { ArrowDownLeft, ArrowUpRight, Check, Copy, Loader2, Lock } from "lucide-react";

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
import { WalletClaimsTab } from "@/components/wallet/wallet-claims-tab";
import { TransferSheet } from "@/components/transfer-sheet";
import { MainPage } from "@/components/main-app-header";
import { Bolt, Chest, Coin, CoinStack, GameButton, GameCard, ShieldBadge, Trophy, gameButtonClass } from "@/components/ds";
import { RewardsDailyCard } from "@/components/home/daily-money-card";
import { useClaimPanel, useFaceCheck } from "@/contexts/right-panel-context";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useUserTotalPoints } from "@/hooks/graph/useUserPoints";
import { formatCompact } from "@/lib/levels";
import {
  CELO_MAINNET_ID,
  CUSD_ADDRESSES,
  GOODDOLLAR_ADDRESSES,
  USDT_ADDRESSES,
  KNOWN_TOKEN_SYMBOLS,
  REWARD_CLAIM_ENABLED,
} from "@/lib/constant";
import { toUsdAmount, getTokenDecimals } from "@/lib/token-amounts";
import { cn, formatGAmount } from "@/lib/utils";

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

export default function RewardsPage() {
  const router = useRouter();
  const { address, isConnected, isReady } = useAuth();
  const [sendOpen, setSendOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { open: openClaimPanel } = useClaimPanel();
  const { start: openVerify } = useFaceCheck();
  const { isWhitelisted, isInitialized: claimReady } = useGoodDollarClaim();
  const { points } = useUserTotalPoints(address);
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

  const otherBalancesLine = (() => {
    const parts: string[] = [];
    if (usdtBalanceNum != null && usdtDisplay > 0) parts.push(`${usdtDisplay.toFixed(2)} USDT`);
    if (cusdBalanceNum != null && cusdDisplay > 0) parts.push(`${cusdDisplay.toFixed(2)} cUSD`);
    if (celoBalanceNum != null && celoDisplay > 0) parts.push(`${celoDisplay.toFixed(3)} CELO`);
    return parts.length > 0 ? `+ ${parts.join(" · ")}` : null;
  })();

  // Not face-verified and holding no G$: show points and what verifying unlocks.
  const showUnverified = claimReady && !isWhitelisted && !isGdLoading && gdDisplay <= 0;

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
        <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pb-10 pt-2.5 lg:pt-6">
          <h1 className="m-0 animate-rise text-2xl font-bold leading-[1.2] tracking-[-0.02em]">Rewards</h1>

          {showUnverified ? (
            <>
              {/* Not verified yet (design: RewardsNew.dc.html) */}
              <GameCard className="flex animate-rise items-center gap-3.5 p-4">
                <span className="animate-bounce-in">
                  <Bolt size={52} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[40px] font-extrabold uppercase leading-none tabular-nums">
                    {formatCompact(points ?? 0)} pts
                  </div>
                  <div className="label-mono mt-1 text-[10px] text-muted-foreground">Total points</div>
                </div>
              </GameCard>

              <div className="relative flex animate-rise items-center gap-3 rounded-[20px] border-2 border-blue-line bg-blue-soft py-3 pl-3.5 pr-3 shadow-edge-blue-line">
                <ShieldBadge size={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">Unlock free money</div>
                  <div className="label-mono mt-[3px] text-[10px] text-blue">One quick face check</div>
                </div>
                <GameButton variant="blue" size="sm" onClick={openVerify}>
                  Verify
                </GameButton>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <span className="label-mono text-muted-foreground">Unlocks with verification</span>
                {[
                  { art: <Chest size={44} grey />, title: "Daily G$", sub: "Free every day" },
                  { art: <Coin size={40} />, title: "Stake money", sub: "Put G$ on your contracts" },
                  { art: <Trophy size={42} />, title: "Campaign prizes", sub: "Join pools with real G$" },
                ].map((row) => (
                  <button
                    key={row.title}
                    type="button"
                    onClick={openVerify}
                    className="flex animate-rise items-center gap-3 rounded-[20px] border-2 border-line bg-white px-3.5 py-3 text-left shadow-edge"
                  >
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                      {row.art}
                      <span className="absolute -bottom-1 -right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-ink text-white">
                        <Lock className="h-3 w-3" strokeWidth={2.6} />
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{row.title}</div>
                      <div className="label-mono mt-0.5 text-[10px] text-muted-foreground">{row.sub}</div>
                    </div>
                    <span className={gameButtonClass({ variant: "blue", size: "sm" })}>Verify</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Balance */}
              <GameCard className="animate-rise p-4">
                <div className="flex items-center gap-3.5">
                  <span className="animate-bounce-in">
                    <Coin size={52} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-display text-[40px] font-extrabold uppercase leading-none tabular-nums">
                      {isGdLoading || gdError ? "—" : `${gdDisplay.toLocaleString("en-US", { maximumFractionDigits: 0 })} G$`}
                    </div>
                    <div className="label-mono mt-1 truncate text-[10px] text-muted-foreground">
                      {otherBalancesLine ?? (hasAnyUsdValue && balancesLoaded ? `≈ $${totalUsd.toFixed(2)}` : "\u00a0")}
                    </div>
                    {gdError ? (
                      <p className="mt-1 text-[11px] font-semibold text-orange">Couldn&apos;t load your balance. Try again.</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <GameButton
                    variant="line"
                    size="sm"
                    disabled={balancesLoaded && !hasSendableBalance}
                    onClick={() => setSendOpen(true)}
                  >
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                    Send
                  </GameButton>
                  <GameButton variant="line" size="sm" onClick={openClaimPanel}>
                    <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />
                    Get
                  </GameButton>
                  <GameButton
                    variant="line"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(address).then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                      });
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Copy className="h-4 w-4" strokeWidth={2} />}
                    {copied ? "Copied" : "Copy"}
                  </GameButton>
                </div>
              </GameCard>

              {/* Free daily money (GoodDollar UBI) */}
              <RewardsDailyCard />

              {/* Rewards ready to claim */}
              <GameCard className="flex animate-rise items-center gap-3 px-3.5 py-3">
                <CoinStack className="h-10 w-11" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {primaryPending
                      ? `${primaryPending.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${primaryPending.symbol} reward`
                      : "Proof rewards"}
                  </div>
                  <div className="label-mono mt-0.5 truncate text-[10px] text-muted-foreground">
                    {isLoadingAdminRewards
                      ? "Checking…"
                      : primaryPending
                        ? secondaryPending.length > 0
                          ? `+ ${secondaryPending.map((r) => r.display).join(" + ")}`
                          : "Ready to claim"
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
              {adminClaimError ? <p className="-mt-2 text-[11px] font-semibold text-orange">{adminClaimError}</p> : null}

            </>
          )}

          {/* Campaign prizes, stake reclaims, friend rewards: only when something is claimable */}
          <WalletClaimsTab address={address} onlyWhenClaimable />

          {/* Ledger */}
          <section className="pt-2">
            <span className="label-mono text-muted-foreground">Ledger</span>
            {isLoadingActivity && activityItems.length === 0 ? (
              <div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3.5 border-b border-dashed border-line py-3">
                    <div className="h-6 w-5 shrink-0 animate-pulse rounded bg-line" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-3.5 w-28 animate-pulse rounded bg-line" />
                      <div className="h-2.5 w-20 animate-pulse rounded bg-line" />
                    </div>
                    <div className="h-3.5 w-14 animate-pulse rounded bg-line" />
                  </div>
                ))}
              </div>
            ) : activityError && activityItems.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Couldn&apos;t load your ledger. Check your connection and try again.</p>
            ) : activityItems.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Stakes returned, forfeits and rewards will show up here.</p>
            ) : (
              <div>
                {activityItems.map((item) => (
                  <LedgerRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
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

function LedgerRow({ item }: { item: ActivityItem }) {
  const out = item.kind === "forfeit_sent";
  const date = new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const amount = item.amountLabel.replace(/^-/, "−").replace(/ G\$$/, "");
  return (
    <a
      href={`https://celoscan.io/tx/${item.txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex animate-rise items-center gap-3.5 border-b border-dashed border-line py-3 text-ink no-underline"
    >
      <span className={cn("w-5 font-display text-[28px] font-extrabold leading-none", out ? "text-orange" : "text-green-edge")}>
        {out ? "−" : "+"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{item.title}</div>
        <div className="label-mono mt-[3px] truncate text-[10px] text-muted-foreground">
          {[item.description, date].filter(Boolean).join(" · ")}
        </div>
      </div>
      <span className={cn("label-mono shrink-0 text-[13px] font-semibold tracking-[0.06em]", out ? "text-orange" : "text-green-edge")}>
        {amount}
      </span>
    </a>
  );
}
