"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn, formatGAmount } from "@/lib/utils";
import { TokenBadge } from "@/components/token-badge";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { DELULU_ABI } from "@/lib/abi";
import { getDeluluContractAddress } from "@/lib/constant";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { formatUnits } from "viem";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";

type Mode = "buy" | "sell";

export function SharesSheet({
  open,
  onOpenChange,
  deluluId,
  tokenAddress,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deluluId: bigint;
  tokenAddress: `0x${string}`;
  mode: Mode;
}) {
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddress = getDeluluContractAddress(chainId);

  const [amountStr, setAmountStr] = useState("1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setAmountStr("1");
    }
  }, [open]);

  const amount = useMemo(() => {
    const n = Number(amountStr);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    return BigInt(Math.floor(n));
  }, [amountStr]);

  const quickAmounts = mode === "buy" ? [1, 2, 5, 10] : [1, 2, 5];

  const { data: supply } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "shareSupply",
    args: [deluluId],
    query: { enabled: open },
  });

  const { data: myShares } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "shareBalance",
    args: address ? [deluluId, address] : undefined,
    query: { enabled: open && !!address },
  });

  const { data: curveAmount } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: mode === "buy" ? "getShareBuyPrice" : "getShareSellProceeds",
    args: amount > 0n ? [deluluId, amount] : undefined,
    query: { enabled: open && amount > 0n },
  });

  const curve = (curveAmount as bigint | undefined) ?? 0n;
  // Protocol fee 1% + creator fee 1%
  const protocolFee = curve / 100n;
  const creatorFee = curve / 100n;
  const totalCost = curve + protocolFee + creatorFee;
  const netProceeds = curve > 0n ? curve - protocolFee - creatorFee : 0n;

  const totalCostNum = Number(formatUnits(totalCost, 18));
  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    refetchAllowance,
  } = useTokenApproval(tokenAddress);

  const approvalNeeded = useMemo(() => {
    if (mode !== "buy") return false;
    if (!curve || curve === 0n) return false;
    if (!Number.isFinite(totalCostNum) || totalCostNum <= 0) return false;
    return needsApproval(totalCostNum);
  }, [mode, curve, totalCostNum, needsApproval]);

  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (writeError) {
      setError(
        (writeError as any)?.shortMessage ??
          (writeError as any)?.message ??
          "Transaction failed",
      );
    }
  }, [writeError]);

  useEffect(() => {
    if (isApprovalSuccess) {
      refetchAllowance();
    }
  }, [isApprovalSuccess, refetchAllowance]);

  const handleAction = async () => {
    if (!amount || amount <= 0n) {
      setError("Enter a valid amount.");
      return;
    }
    setError(null);

    if (mode === "buy") {
      writeContract({
        address: contractAddress,
        abi: DELULU_ABI,
        functionName: "buyShares",
        args: [deluluId, amount, totalCost],
      });
    } else {
      writeContract({
        address: contractAddress,
        abi: DELULU_ABI,
        functionName: "sellShares",
        args: [deluluId, amount, netProceeds],
      });
    }
  };

  const handleApprove = async () => {
    setError(null);
    if (!Number.isFinite(totalCostNum) || totalCostNum <= 0) {
      setError("Unable to estimate cost.");
      return;
    }
    await approve(totalCostNum);
  };

  const supplyNum = Number((supply as bigint | undefined) ?? 0n);
  const mySharesNum = Number((myShares as bigint | undefined) ?? 0n);
  const ownershipPct =
    supplyNum > 0 ? Math.min(100, (mySharesNum / supplyNum) * 100) : 0;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title=""
      sheetClassName={cn(
        "border-t border-border max-h-[88vh] overflow-hidden p-0 rounded-t-3xl",
        "bg-secondary/95 backdrop-blur-xl",
      )}
      modalClassName="max-w-xl"
    >
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              {mode === "buy" ? "Buy" : "Sell"} Shares
            </p>
           
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">You own</p>
            <p className="text-sm font-black text-foreground">
              {mySharesNum}{" "}
              <span className="text-[11px] text-muted-foreground">
                ({ownershipPct.toFixed(1)}%)
              </span>
            </p>
          </div>
        </div>

        {/* Uniswap-style amount input */}
        <div className="mt-4 rounded-3xl border border-border bg-card p-4 shadow-neo-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">
              {mode === "buy" ? "You pay" : "You sell"}
            </p>
            {mode === "sell" ? (
              <button
                type="button"
                onClick={() => setAmountStr(String(mySharesNum || 0))}
                className="text-[11px] font-black text-muted-foreground hover:text-foreground"
              >
                Max
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex items-stretch justify-between gap-3">
            <input
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              inputMode="numeric"
              placeholder="0"
              className={cn(
                "min-w-0 flex-1 bg-transparent text-4xl font-black tabular-nums tracking-tight text-foreground outline-none",
                "placeholder:text-muted-foreground/40",
              )}
            />
            <div className="shrink-0">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-muted/70 px-3 py-2">
                <TokenBadge tokenAddress={tokenAddress} size="sm" />
                <span className="text-sm font-black text-foreground">
                  {mode === "buy" ? "Token" : "Shares"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmountStr(String(n))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-black transition-colors",
                    "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground">
              {mode === "sell" ? `Balance: ${mySharesNum} shares` : " "}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            {mode === "buy" ? (
              <>
                <div className="flex items-center justify-between">
                  <span>Curve cost</span>
                  <span className="font-semibold text-foreground">
                    {formatGAmount(Number(formatUnits(curve, 18)))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fees (1% protocol + 1% creator)</span>
                  <span className="font-semibold text-foreground">
                    {formatGAmount(
                      Number(formatUnits(protocolFee + creatorFee, 18)),
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total (incl. fees)</span>
                  <span className="font-semibold text-foreground">
                    {formatGAmount(Number(formatUnits(totalCost, 18)))}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span>Curve proceeds</span>
                  <span className="font-semibold text-foreground">
                    {formatGAmount(Number(formatUnits(curve, 18)))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fees (1% protocol + 1% creator)</span>
                  <span className="font-semibold text-foreground">
                    {formatGAmount(
                      Number(formatUnits(protocolFee + creatorFee, 18)),
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>You receive (net)</span>
                  <span className="font-semibold text-foreground">
                    {formatGAmount(Number(formatUnits(netProceeds, 18)))}
                  </span>
                </div>
              </>
            )}
          </div>

          {error ? (
            <p className="text-[11px] text-destructive">{error}</p>
          ) : null}

      <div className="flex items-center justify-center mt-4">
      {mode === "buy" && approvalNeeded ? (
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving || isApprovingConfirming}
              className={cn(
                "w-fit inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-border px-4 py-3.5 text-sm font-black",
                "bg-foreground text-background shadow-neo",
                "hover:opacity-95 active:translate-y-px active:shadow-neo-sm transition-all",
                "disabled:opacity-60 disabled:cursor-not-allowed",
              )}
            >
              {(isApproving || isApprovingConfirming) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Approve
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAction}
              disabled={isPending || isConfirming}
              className={cn(
                "w-fit inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-border px-4 py-3.5 text-sm font-black",
                "bg-foreground text-background shadow-neo",
                "hover:opacity-95 active:translate-y-px active:shadow-neo-sm transition-all",
                "disabled:opacity-60 disabled:cursor-not-allowed",
              )}
            >
              {(isPending || isConfirming) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {mode === "buy" ? (
                <>
                  <ArrowUpRight className="h-4 w-4" />
                  Buy shares
                </>
              ) : (
                <>
                  <ArrowDownLeft className="h-4 w-4" />
                  Sell shares
                </>
              )}
            </button>
          )}
      </div>

          {isSuccess ? (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
              Success. Close and reopen to refresh.
            </p>
          ) : null}
        </div>
      </div>
    </ResponsiveSheet>
  );
}
