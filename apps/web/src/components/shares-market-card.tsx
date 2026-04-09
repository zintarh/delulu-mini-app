"use client";

import { useMemo } from "react";
import { KNOWN_TOKEN_SYMBOLS } from "@/lib/constant";
import { TrendingUp, TrendingDown, Users, BarChart2 } from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

interface ShareTrade {
  id: string;
  isBuy: boolean;
  amount: number;
  curveAmount: number;
  createdAt: Date;
  userAddress: string;
}

interface ShareHolding {
  userAddress: string;
  username: string | null;
  balance: number;
}

const SHARE_PRICE_SCALE = 1e18;
const SHARE_PRICE_FACTOR = 16000;

function priceAtSupply(supply: number): number {
  // price of the next share = supply^2 * SCALE / FACTOR / 1e18
  return (supply * supply) / SHARE_PRICE_FACTOR;
}

export function SharesMarketCard({
  shareTrades,
  shareHoldings,
  myShareBalance,
  marketToken,
  onBuy,
  onSell,
  ownsAnyShares,
  canBuy,
  noBalance = false,
}: {
  shareTrades: ShareTrade[];
  shareHoldings: ShareHolding[];
  myShareBalance: bigint | undefined;
  marketToken: string | undefined;
  onBuy: () => void;
  onSell: () => void;
  ownsAnyShares: boolean;
  canBuy: boolean;
  noBalance?: boolean;
}) {
  const tokenSymbol = marketToken
    ? (KNOWN_TOKEN_SYMBOLS[marketToken.toLowerCase()] ?? "tokens")
    : "tokens";

  const myShares = Number(myShareBalance ?? 0n);

  // Build running supply + price series from trades
  const chartData = useMemo(() => {
    if (!shareTrades || shareTrades.length === 0) return [];
    let supply = 0; // v3: supply starts at 0; creator's first SharesBought trade accounts for all initial shares
    return shareTrades.map((t) => {
      if (t.isBuy) supply += t.amount;
      else supply -= t.amount;
      const price = priceAtSupply(Math.max(1, supply));
      return {
        time: t.createdAt.getTime(),
        price,
        supply,
        isBuy: t.isBuy,
      };
    });
  }, [shareTrades]);

  const totalSupply = chartData.length > 0 ? chartData[chartData.length - 1].supply : 0;
  const currentPrice = priceAtSupply(Math.max(1, totalSupply));
  const firstPrice = chartData.length > 0 ? chartData[0].price : currentPrice;
  const priceChange = chartData.length > 1 ? currentPrice - firstPrice : 0;
  const priceChangePct = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;
  const isUp = priceChangePct >= 0;

  const totalBuys = shareTrades.filter((t) => t.isBuy).length;
  const totalSells = shareTrades.filter((t) => !t.isBuy).length;
  const buyVolume = shareTrades
    .filter((t) => t.isBuy)
    .reduce((sum, t) => sum + t.amount, 0);
  const sellVolume = shareTrades
    .filter((t) => !t.isBuy)
    .reduce((sum, t) => sum + t.amount, 0);

  // Top holders (sort by balance desc, show top 3)
  const topHolders = [...(shareHoldings ?? [])]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 3);

  const hasChart = chartData.length >= 2;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-black text-foreground">Shares market</span>
          {marketToken && (
            <span className="text-[11px] font-semibold text-muted-foreground uppercase ml-1">
              · {tokenSymbol}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {(canBuy || ownsAnyShares) && (
            <>
              {canBuy && (
                <div className="flex flex-col items-end gap-0.5">
                  <button
                    type="button"
                    onClick={noBalance ? undefined : onBuy}
                    disabled={noBalance}
                    className={noBalance
                      ? "px-3 py-1.5 text-xs font-black rounded-lg border border-border text-muted-foreground cursor-not-allowed opacity-50"
                      : "px-3 py-1.5 text-xs font-black rounded-lg border-2 border-delulu-charcoal bg-delulu-yellow-reserved text-delulu-charcoal shadow-[1px_1px_0px_0px_#1A1A1A] hover:opacity-90 transition-opacity"}
                  >
                    Buy
                  </button>
                  {noBalance && (
                    <span className="text-[10px] font-semibold text-rose-500 whitespace-nowrap">
                      Insufficient G$
                    </span>
                  )}
                </div>
              )}
              {ownsAnyShares && (
                <button
                  type="button"
                  onClick={onSell}
                  className="px-3 py-1.5 text-xs font-black rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Sell
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Price + stats row */}
      <div className="grid grid-cols-3 gap-0 border-y border-border">
        <div className="px-5 py-3 space-y-0.5">
          <p className="text-[11px] text-muted-foreground font-medium">Price</p>
          <p className="text-xl font-black text-foreground tabular-nums">
            {currentPrice < 0.001
              ? currentPrice.toFixed(6)
              : currentPrice < 1
              ? currentPrice.toFixed(4)
              : currentPrice.toFixed(2)}
          </p>
          <div className={cn(
            "flex items-center gap-1 text-[11px] font-semibold",
            isUp ? "text-emerald-500" : "text-rose-500"
          )}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {priceChangePct > 0 ? "+" : ""}{priceChangePct.toFixed(1)}%
          </div>
        </div>

        <div className="px-5 py-3 border-x border-border space-y-0.5">
          <p className="text-[11px] text-muted-foreground font-medium">Supply</p>
          <p className="text-xl font-black text-foreground tabular-nums">{totalSupply}</p>
          <p className="text-[11px] text-muted-foreground">
            {totalBuys}B · {totalSells}S
          </p>
        </div>

        <div className="px-5 py-3 space-y-0.5">
          <p className="text-[11px] text-muted-foreground font-medium">You hold</p>
          <p className="text-xl font-black text-foreground tabular-nums">{myShares}</p>
          {totalSupply > 0 && myShares > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {((myShares / totalSupply) * 100).toFixed(1)}% of supply
            </p>
          )}
        </div>
      </div>

      {/* Chart */}
      {hasChart ? (
        <div className="h-28 w-full px-1 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isUp ? "#10b981" : "#f43f5e"} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={isUp ? "#10b981" : "#f43f5e"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm">
                      <p className="font-black text-foreground">
                        {d.price < 0.001 ? d.price.toFixed(6) : d.price.toFixed(4)} {tokenSymbol}
                      </p>
                      <p className="text-muted-foreground">Supply: {d.supply}</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isUp ? "#10b981" : "#f43f5e"}
                strokeWidth={2}
                fill="url(#priceGrad)"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-16 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">No activity yet — be the first to buy shares</p>
        </div>
      )}

      {/* Bottom: holders + support */}
      <div className="grid grid-cols-2 gap-0 border-t border-border">
        {/* Top holders */}
        <div className="px-5 py-3 border-r border-border">
          <p className="text-[11px] text-muted-foreground font-medium mb-2 flex items-center gap-1">
            <Users className="w-3 h-3" /> Share holders
          </p>
          {topHolders.length > 0 ? (
            <div className="space-y-1">
              {topHolders.map((h, i) => (
                <div key={h.userAddress} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {h.username ?? `${h.userAddress.slice(0, 6)}…${h.userAddress.slice(-4)}`}
                  </span>
                  <span className="text-xs font-black text-foreground tabular-nums shrink-0">
                    {h.balance}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">None yet</p>
          )}
        </div>

        {/* Trades */}
        <div className="px-5 py-3">
          <p className="text-[11px] text-muted-foreground font-medium mb-2">
            Trades
          </p>
          <div className="space-y-1">
            <p className="text-xs text-emerald-500 font-semibold">
              Buys: <span className="font-black tabular-nums">{totalBuys}</span>
              <span className="text-muted-foreground font-medium"> ({buyVolume} shares)</span>
            </p>
            <p className="text-xs text-rose-500 font-semibold">
              Sells: <span className="font-black tabular-nums">{totalSells}</span>
              <span className="text-muted-foreground font-medium"> ({sellVolume} shares)</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
