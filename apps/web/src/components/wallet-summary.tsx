"use client";

import { useAccount } from "wagmi";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useSupportedTokens } from "@/hooks/use-supported-tokens";
import { TokenBadge } from "@/components/token-badge";
import { cn } from "@/lib/utils";

interface WalletSummaryProps {
  className?: string;
}

export function WalletSummary({ className = "" }: WalletSummaryProps) {
  const { isConnected } = useAccount();
  const tokens = useSupportedTokens();

  if (!isConnected) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-gray-50/80 p-3",
        className
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">
        Wallet Summary
      </p>
      <div className="flex flex-wrap gap-3">
        {tokens.map((t) => (
          <WalletTokenRow key={t.address} tokenAddress={t.address} />
        ))}
      </div>
    </div>
  );
}

function WalletTokenRow({ tokenAddress }: { tokenAddress: string }) {
  const { balance, isLoading } = useTokenBalance(tokenAddress);
  return (
    <div className="flex items-center gap-2">
      <TokenBadge tokenAddress={tokenAddress} size="sm" />
      {isLoading ? (
        <span className="h-4 w-12 animate-pulse rounded bg-gray-200" />
      ) : (
        <span className="text-sm font-bold text-delulu-charcoal">
          {parseFloat(balance?.formatted ?? "0").toFixed(2)}
        </span>
      )}
    </div>
  );
}
