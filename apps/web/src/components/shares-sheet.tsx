"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn, formatGAmount } from "@/lib/utils";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { DELULU_ABI } from "@/lib/abi";
import { getDeluluContractAddress, KNOWN_TOKEN_SYMBOLS } from "@/lib/constant";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { formatUnits } from "viem";
import { Loader2, TrendingUp, TrendingDown, CheckCircle2, XCircle } from "lucide-react";

type Mode = "buy" | "sell";

export function SharesSheet({
  open,
  onOpenChange,
  deluluId,
  tokenAddress,
  mode,
  isCreator = false,
  isEnded = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deluluId: bigint;
  tokenAddress: `0x${string}`;
  mode: Mode;
  isCreator?: boolean;
  isEnded?: boolean;
}) {
  const { authenticated } = usePrivy();
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddress = getDeluluContractAddress(chainId);

  const [amountStr, setAmountStr] = useState("1");
  const [error, setError] = useState<string | null>(null);

  // Creator cannot sell while the delulu is still active
  const creatorSellBlocked = isCreator && mode === "sell" && !isEnded;

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
    query: { enabled: open && amount > 0n && !creatorSellBlocked },
  });

  const curve = (curveAmount as bigint | undefined) ?? 0n;
  const protocolFee = curve / 100n;
  const creatorFee = curve / 100n;
  const totalCost = curve + protocolFee + creatorFee;
  // Add 5% slippage buffer so minor supply changes between quote and tx don't revert
  const maxCostWithSlippage = totalCost > 0n ? (totalCost * 105n) / 100n : 0n;
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

  const isBuy = mode === "buy";

  const maxCostWithSlippageNum = Number(formatUnits(maxCostWithSlippage, 18));

  const approvalNeeded = useMemo(() => {
    if (mode !== "buy") return false;
    if (!curve || curve === 0n) return false;
    if (!Number.isFinite(maxCostWithSlippageNum) || maxCostWithSlippageNum <= 0) return false;
    return needsApproval(maxCostWithSlippageNum);
  }, [mode, curve, maxCostWithSlippageNum, needsApproval]);

  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

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
    if (isApprovalSuccess) refetchAllowance();
  }, [isApprovalSuccess, refetchAllowance]);

  useEffect(() => {
    if (!isSuccess) return;
    // Refetch allowance after any successful share tx so approval state is fresh
    refetchAllowance();
  }, [isSuccess, refetchAllowance]);

  useEffect(() => {
    if (!isSuccess || !isBuy) return;
    import("canvas-confetti").then((mod) => {
      const confetti = (mod as any).default ?? mod;
      if (typeof confetti === "function") {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["#FCD34D", "#1A1A1A", "#ffffff"] });
      }
    }).catch(() => {});
  }, [isSuccess, isBuy]);

  const handleAction = () => {
    if (!amount || amount <= 0n) { setError("Enter a valid amount."); return; }
    setError(null);
    if (mode === "buy") {
      writeContract({ address: contractAddress, abi: DELULU_ABI, functionName: "buyShares", chainId, args: [deluluId, amount, maxCostWithSlippage] });
    } else {
      writeContract({ address: contractAddress, abi: DELULU_ABI, functionName: "sellShares", chainId, args: [deluluId, amount, netProceeds] });
    }
  };

  const handleApprove = () => {
    setError(null);
    if (!Number.isFinite(maxCostWithSlippageNum) || maxCostWithSlippageNum <= 0) { setError("Unable to estimate cost."); return; }
    approve(maxCostWithSlippageNum);
  };

  const tokenSymbol = KNOWN_TOKEN_SYMBOLS[tokenAddress.toLowerCase()] ?? "tokens";
  const supplyNum = Number((supply as bigint | undefined) ?? 0n);
  const mySharesNum = Number((myShares as bigint | undefined) ?? 0n);
  const ownershipPct = supplyNum > 0 ? Math.min(100, (mySharesNum / supplyNum) * 100) : 0;

  const displayAmount = isBuy
    ? formatGAmount(Number(formatUnits(totalCost, 18)))
    : formatGAmount(Number(formatUnits(netProceeds, 18)));
  const fees = formatGAmount(Number(formatUnits(protocolFee + creatorFee, 18)));
  const isPriceLoading = amount > 0n && curve === 0n;
  const isLoading = isPending || isConfirming;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title=""
      sheetClassName="border-t border-border max-h-[85vh] overflow-hidden p-0 rounded-t-3xl bg-background"
      modalClassName="max-w-sm"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className={cn(
          "flex items-center gap-3 px-5 pt-5 pb-4",
          isBuy ? "border-b border-border" : "border-b border-border"
        )}>
          <div className={cn(
            "w-9 h-9 rounded-2xl flex items-center justify-center shrink-0",
            isBuy ? "bg-delulu-yellow-reserved/30 dark:bg-delulu-yellow-reserved/20" : "bg-rose-100 dark:bg-rose-900/40"
          )}>
            {isBuy
              ? <TrendingUp className="w-4 h-4 text-delulu-charcoal dark:text-delulu-yellow-reserved" />
              : <TrendingDown className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground">
              {isBuy ? "Buy shares" : "Sell shares"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isBuy ? "Price rises with each buy" : "Price drops with each sell"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">You hold</p>
            <p className="text-sm font-black text-foreground">
              {mySharesNum}
              {supplyNum > 0 && (
                <span className="text-xs font-medium text-muted-foreground ml-1">
                  / {supplyNum}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Creator sell blocked */}
        {creatorSellBlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-black text-foreground">Can't sell yet</p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              As the creator, your shares are locked until the delulu ends. This keeps your skin in the game.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Amount input */}
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {isBuy ? "Shares to buy" : "Shares to sell"}
                </span>
                {!isBuy && (
                  <button
                    type="button"
                    onClick={() => setAmountStr(String(mySharesNum || 0))}
                    className="text-[11px] font-black text-primary hover:opacity-80"
                  >
                    Sell all ({mySharesNum})
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className="flex-1 min-w-0 bg-transparent text-5xl font-black tabular-nums text-foreground outline-none placeholder:text-muted-foreground/30"
                />
                <div className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/60 px-2.5 py-1.5">
                  <span className="text-xs font-black text-foreground">shares</span>
                </div>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2 mt-3">
                {(isBuy ? [1, 2, 5, 10] : [1, 2, 5]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAmountStr(String(n))}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-black rounded-lg border transition-colors",
                      amountStr === String(n)
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Price summary */}
            {amount > 0n && curve > 0n && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {isBuy ? `You pay (${tokenSymbol})` : `You receive (${tokenSymbol})`}
                  </span>
                  <span className="text-base font-black text-foreground">
                    {displayAmount}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Fees (2%)</span>
                  <span className="text-[11px] text-muted-foreground">{fees}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Total supply after</span>
                  <span className="text-[11px] text-muted-foreground">
                    {isBuy ? supplyNum + Number(amount) : supplyNum - Number(amount)} shares
                  </span>
                </div>
              </div>
            )}

            {/* Success banner */}
            {isSuccess && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                    {isBuy ? "Shares purchased!" : "Shares sold!"}
                  </p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                    {isBuy ? "You now hold more of this delulu." : "Proceeds sent to your wallet."}
                  </p>
                </div>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                <XCircle className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-xs text-destructive font-medium">{error}</p>
              </div>
            )}

            {/* CTA */}
            <div className="pb-2">
              {mode === "buy" && approvalNeeded ? (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving || isApprovingConfirming}
                  className={cn(
                    "w-full py-3.5 rounded-2xl border-2 border-foreground text-sm font-black",
                    "bg-foreground text-background shadow-neo",
                    "hover:opacity-90 active:translate-y-px transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-2",
                  )}
                >
                  {(isApproving || isApprovingConfirming) && <Loader2 className="w-4 h-4 animate-spin" />}
                  Approve spending
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={isLoading || isPriceLoading || !amount || amount <= 0n}
                  className={cn(
                    "w-full py-3.5 rounded-2xl border-2 text-sm font-black",
                    "flex items-center justify-center gap-2",
                    "active:translate-y-px transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isBuy
                      ? "border-delulu-charcoal bg-delulu-yellow-reserved text-delulu-charcoal hover:opacity-90 shadow-[2px_2px_0px_0px_#1A1A1A]"
                      : "border-rose-600 bg-rose-500 text-white hover:bg-rose-600 shadow-[2px_2px_0px_0px_#e11d48]",
                  )}
                >
                  {(isLoading || isPriceLoading) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isPriceLoading ? "Fetching price..." : isBuy ? "Buy shares" : "Sell shares"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
}
