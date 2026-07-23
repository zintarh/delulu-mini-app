"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { Gift, Loader2 } from "lucide-react";
import { usePendingReward, useClaimReward } from "@/hooks/use-reward-vault";
import { GOODDOLLAR_ADDRESSES, CUSD_ADDRESSES, USDT_ADDRESSES, KNOWN_TOKEN_SYMBOLS } from "@/lib/constant";
import { getTokenDecimals } from "@/lib/token-amounts";
import { TokenBadge } from "@/components/token-badge";

function RewardRow({
  tokenAddress,
  pending,
  refetch,
}: {
  tokenAddress: `0x${string}`;
  pending: bigint;
  refetch: () => void;
}) {
  const { claimReward, isPending } = useClaimReward();
  const [error, setError] = useState<string | null>(null);

  const decimals = getTokenDecimals(tokenAddress);
  const amount = parseFloat(formatUnits(pending, decimals));
  const symbol = KNOWN_TOKEN_SYMBOLS[tokenAddress.toLowerCase()] ?? "";
  // Never show "0" for a genuinely nonzero pending amount — widen precision until it's visible.
  const displayAmount =
    amount > 0 && amount < 0.0001
      ? amount.toLocaleString(undefined, { maximumFractionDigits: 18 })
      : amount.toLocaleString(undefined, { maximumFractionDigits: 4 });

  const handleClaim = async () => {
    setError(null);
    try {
      await claimReward(tokenAddress);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <TokenBadge tokenAddress={tokenAddress} size="md" showText={false} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {displayAmount} {symbol}
        </p>
        <p className="text-xs text-muted-foreground">Sent to you by the team</p>
        {error ? <p className="mt-0.5 text-[11px] text-destructive">{error}</p> : null}
      </div>
      <button
        type="button"
        onClick={handleClaim}
        disabled={isPending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-delulu-blue px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-delulu-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
        Claim
      </button>
    </div>
  );
}

/** Renders nothing if the user has no admin-granted rewards waiting to be claimed. */
export function AppRewardsCard({ address }: { address: `0x${string}` | undefined }) {
  const gd = usePendingReward(address, GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`);
  const cusd = usePendingReward(address, CUSD_ADDRESSES.mainnet as `0x${string}`);
  const usdt = usePendingReward(address, USDT_ADDRESSES.mainnet as `0x${string}`);

  const rows = [
    { tokenAddress: GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`, ...gd },
    { tokenAddress: CUSD_ADDRESSES.mainnet as `0x${string}`, ...cusd },
    { tokenAddress: USDT_ADDRESSES.mainnet as `0x${string}`, ...usdt },
  ].filter((r) => r.pending > 0n);

  if (!address || rows.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2.5 text-sm font-semibold tracking-wide text-foreground">App rewards</h3>
      <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
        {rows.map((r) => (
          <RewardRow
            key={r.tokenAddress}
            tokenAddress={r.tokenAddress}
            pending={r.pending}
            refetch={r.refetch}
          />
        ))}
      </div>
    </section>
  );
}
