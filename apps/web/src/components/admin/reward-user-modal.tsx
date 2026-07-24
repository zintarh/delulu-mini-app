"use client";

import { useState } from "react";
import { Loader2, X, Gift, AlertTriangle } from "lucide-react";
import { formatAddress, cn } from "@/lib/utils";
import { useDepositReward, useRewardVaultRoles } from "@/hooks/use-reward-vault";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useAuth } from "@/hooks/use-auth";
import { GOODDOLLAR_ADDRESSES, CUSD_ADDRESSES, USDT_ADDRESSES } from "@/lib/constant";
import { getTokenDecimals } from "@/lib/token-amounts";

const REWARD_TOKENS = [
  { address: GOODDOLLAR_ADDRESSES.mainnet, symbol: "G$" },
  { address: CUSD_ADDRESSES.mainnet, symbol: "USDm" },
  { address: USDT_ADDRESSES.mainnet, symbol: "USDT" },
] as const;

const REASON_SUGGESTIONS = [
  "Leaderboard",
  "Onboarding",
  "Campaign win",
  "Community contribution",
  "Thank you",
] as const;

function formatBalanceDisplay(formatted: string, symbol: string) {
  const n = parseFloat(formatted);
  if (!Number.isFinite(n)) return `— ${symbol}`;
  const display =
    n >= 1000
      ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return `${display} ${symbol}`;
}

export function RewardUserModal({
  userAddress,
  username,
  onClose,
  onSuccess,
}: {
  userAddress: string;
  username?: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [tokenAddress, setTokenAddress] = useState<string>(GOODDOLLAR_ADDRESSES.mainnet);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { depositReward, step, isPending, error } = useDepositReward();
  const { address: connectedAddress } = useAuth();
  const { owner: vaultOwner, rewarder: vaultRewarder } = useRewardVaultRoles();
  const {
    formatted: balanceFormatted,
    isLoading: isBalanceLoading,
    error: balanceError,
  } = useTokenBalance(tokenAddress);

  const selectedSymbol =
    REWARD_TOKENS.find((t) => t.address === tokenAddress)?.symbol ?? "";

  const isAuthorizedSigner =
    !connectedAddress ||
    !vaultOwner ||
    !vaultRewarder ||
    connectedAddress.toLowerCase() === vaultOwner.toLowerCase() ||
    connectedAddress.toLowerCase() === vaultRewarder.toLowerCase();

  const parsedAmount = Number(amount);
  const balanceNum =
    !isBalanceLoading && !balanceError ? parseFloat(balanceFormatted) || 0 : null;
  const exceedsBalance =
    balanceNum != null &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount > balanceNum;

  const canSubmit =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    !isPending &&
    isAuthorizedSigner &&
    !exceedsBalance &&
    !isBalanceLoading;

  const handleSubmit = async () => {
    setLocalError(null);
    if (exceedsBalance) {
      setLocalError(`Not enough ${selectedSymbol} in your wallet.`);
      return;
    }
    try {
      const deposit = await depositReward({
        userAddress: userAddress as `0x${string}`,
        tokenAddress: tokenAddress as `0x${string}`,
        amount: parsedAmount,
        decimals: getTokenDecimals(tokenAddress),
      });

      // Await audit record so we don't lose the trail if the tab closes early.
      // Email is best-effort on the server; a record failure shouldn't undo the
      // on-chain send, but we surface it so ops know to check Celoscan.
      try {
        const res = await fetch("/api/dashboard/rewards/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: userAddress,
            amount: deposit.amount,
            amountWei: deposit.amountWei,
            tokenAddress: deposit.tokenAddress,
            tokenSymbol: selectedSymbol,
            reason: reason.trim() || undefined,
            txHash: deposit.txHash,
            rewardId: deposit.rewardId,
            vaultAddress: deposit.vaultAddress,
            senderAddress: deposit.senderAddress,
          }),
        });
        if (!res.ok) {
          console.error("[reward-user-modal] audit/notify failed:", await res.text());
        }
      } catch (notifyErr) {
        console.error("[reward-user-modal] audit/notify request error:", notifyErr);
      }

      onSuccess(
        `Sent ${parsedAmount} ${selectedSymbol} to ${formatAddress(userAddress as `0x${string}`)} for claim`,
      );
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to deposit reward");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Reward user</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isAuthorizedSigner ? (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed text-amber-700">
              Your connected wallet isn&apos;t the vault&apos;s rewarder or owner — this would fail
              on-chain. Connect the rewarder wallet to send.
            </p>
          </div>
        ) : null}

        <p className="mb-3 text-xs text-muted-foreground">
          {username ? (
            <span className="font-semibold text-foreground">@{username}</span>
          ) : null}
          {username ? " · " : null}
          <span className="font-mono">{formatAddress(userAddress as `0x${string}`)}</span>
        </p>

        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Token</label>
        <div className="mb-3 flex gap-1.5">
          {REWARD_TOKENS.map((t) => (
            <button
              key={t.address}
              type="button"
              onClick={() => {
                setTokenAddress(t.address);
                setLocalError(null);
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                tokenAddress === t.address
                  ? "border-delulu-blue bg-delulu-blue-light text-delulu-blue"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {t.symbol}
            </button>
          ))}
        </div>

        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-muted-foreground">Amount</label>
          <p
            className={cn(
              "text-[11px] tabular-nums",
              exceedsBalance ? "font-semibold text-destructive" : "text-muted-foreground",
            )}
          >
            {isBalanceLoading
              ? `Balance: … ${selectedSymbol}`
              : balanceError
                ? "Balance unavailable"
                : `Balance: ${formatBalanceDisplay(balanceFormatted, selectedSymbol)}`}
          </p>
        </div>
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className={cn(
            "mb-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
            exceedsBalance ? "border-destructive" : "border-border",
          )}
        />
        {exceedsBalance ? (
          <p className="mb-3 text-[11px] font-medium text-destructive">
            Amount exceeds your {selectedSymbol} balance.
          </p>
        ) : (
          <p className="mb-3 text-[11px] text-muted-foreground">
            Sent now from your connected wallet — the user claims it from Rewards.
          </p>
        )}

        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
          What for <span className="font-normal">(optional)</span>
        </label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {REASON_SUGGESTIONS.map((suggestion) => {
            const selected = reason.trim().toLowerCase() === suggestion.toLowerCase();
            return (
              <button
                key={suggestion}
                type="button"
                onClick={() => setReason(selected ? "" : suggestion)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  selected
                    ? "border-delulu-blue bg-delulu-blue-light text-delulu-blue"
                    : "border-border text-muted-foreground hover:bg-muted/40",
                )}
              >
                {suggestion}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 120))}
          placeholder="e.g. Top 10 this month, completed onboarding…"
          maxLength={120}
          className="mb-4 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
        />

        {(localError || error) && (
          <p className="mb-3 text-xs text-destructive">
            {localError || error?.message || "Something went wrong"}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-delulu-blue px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-delulu-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {step === "approving" ? "Approving…" : "Sending…"}
            </>
          ) : (
            <>
              <Gift className="h-4 w-4" />
              Send reward
            </>
          )}
        </button>
      </div>
    </div>
  );
}
