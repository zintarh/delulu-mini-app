"use client";

import React, { useState, useCallback } from "react";
import { parseEther, parseUnits, isAddress } from "viem";
import { useBalance, useWaitForTransactionReceipt } from "wagmi";
import { ArrowRight, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { TokenBadge } from "@/components/token-badge";
import { useUnifiedWalletClient } from "@/hooks/use-unified-wallet-client";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useAuth } from "@/hooks/use-auth";
import { CELO_MAINNET_ID, USDT_ADDRESSES } from "@/lib/constant";
import { cn } from "@/lib/utils";

const ERC20_TRANSFER_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

type Token = "celo" | "usdt";

interface TransferSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferSheet({ open, onOpenChange }: TransferSheetProps) {
  const { address } = useAuth();
  const walletClient = useUnifiedWalletClient();
  const { writeContractAsync } = useUnifiedWriteContract();

  const { data: celoBalance, isLoading: isCeloLoading } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!address },
  });

  const { balance: usdtBalance, isLoading: isUsdtLoading } =
    useTokenBalance(USDT_ADDRESSES.mainnet);

  const [token, setToken] = useState<Token>("usdt");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: CELO_MAINNET_ID,
  });

  const maxBalance =
    token === "celo"
      ? celoBalance ? parseFloat(celoBalance.formatted).toFixed(4) : "0"
      : usdtBalance ? parseFloat(usdtBalance.formatted).toFixed(4) : "0";

  const recipientValid = recipient.length === 0 || isAddress(recipient);
  const amountNum = parseFloat(amount);
  const amountValid =
    amount.length === 0 ||
    (!isNaN(amountNum) && amountNum > 0 && amountNum <= parseFloat(maxBalance));

  const canSubmit =
    isAddress(recipient) &&
    !isNaN(amountNum) &&
    amountNum > 0 &&
    amountNum <= parseFloat(maxBalance) &&
    !isPending &&
    !isConfirming &&
    !!walletClient;

  const handleTransfer = useCallback(async () => {
    if (!canSubmit || !address) return;
    setTxError(null);
    setTxHash(undefined);
    setIsPending(true);

    try {
      let hash: `0x${string}`;

      if (token === "celo") {
        hash = await (walletClient as any).sendTransaction({
          account: address,
          to: recipient as `0x${string}`,
          value: parseEther(amount),
          chain: undefined,
        });
      } else {
        const decimals = usdtBalance?.decimals ?? 6;
        hash = await writeContractAsync({
          address: USDT_ADDRESSES.mainnet,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [recipient as `0x${string}`, parseUnits(amount, decimals)],
        });
      }

      setTxHash(hash);
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? "Transaction failed";
      setTxError(msg);
    } finally {
      setIsPending(false);
    }
  }, [canSubmit, address, token, recipient, amount, walletClient, usdtBalance, writeContractAsync]);

  const handleClose = () => {
    if (isPending || isConfirming) return;
    onOpenChange(false);
    setTimeout(() => {
      setToken("usdt");
      setRecipient("");
      setAmount("");
      setTxHash(undefined);
      setTxError(null);
    }, 300);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={handleClose}
      title="Transfer out"
      sheetClassName="border-t border-border/20 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
      modalClassName="max-w-lg"
    >
      <div className="max-w-lg mx-auto px-4 lg:px-0 pt-4 lg:pt-2 pb-10 space-y-5">

        {/* Token selector with balance */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">
            Token
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["usdt", "celo"] as Token[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setToken(t); setAmount(""); }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                  token === t
                    ? "bg-foreground/10 border-foreground/20 text-foreground shadow-sm"
                    : "bg-transparent border-border/40 text-muted-foreground hover:bg-foreground/5"
                )}
              >
                {t === "celo" ? (
                  <img src="/celo.png" alt="" className="w-6 h-6 rounded-full shrink-0" />
                ) : (
                  <TokenBadge tokenAddress={USDT_ADDRESSES.mainnet} size="lg" showText={false} />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    {t === "celo" ? "CELO" : "USDT"}
                  </p>
                  <p className="text-sm font-bold tabular-nums text-foreground truncate">
                    {t === "celo"
                      ? isCeloLoading ? "—" : celoBalance ? parseFloat(celoBalance.formatted).toFixed(3) : "0"
                      : isUsdtLoading ? "—" : usdtBalance ? parseFloat(usdtBalance.formatted).toFixed(2) : "0"
                    }
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recipient */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">
            Recipient address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.trim())}
            placeholder="0x..."
            className={cn(
              "w-full px-4 py-3 rounded-xl bg-secondary border text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition-colors",
              !recipientValid
                ? "border-rose-500/60 focus:ring-rose-500/40"
                : "border-border/40 focus:ring-[#35d07f]/40 focus:border-[#35d07f]/60"
            )}
          />
          {!recipientValid && (
            <p className="mt-1 text-[11px] text-rose-500">Invalid address</p>
          )}
        </div>

        {/* Amount */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Amount
            </label>
            <button
              type="button"
              onClick={() => setAmount(maxBalance)}
              className="text-[11px] text-muted-foreground font-semibold hover:text-foreground transition-colors"
            >
              Max
            </button>
          </div>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={cn(
              "w-full px-4 py-3 rounded-xl bg-secondary border text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition-colors",
              !amountValid
                ? "border-rose-500/60 focus:ring-rose-500/40"
                : "border-border/40 focus:ring-[#35d07f]/40 focus:border-[#35d07f]/60"
            )}
          />
          {!amountValid && amount.length > 0 && (
            <p className="mt-1 text-[11px] text-rose-500">
              {amountNum <= 0 ? "Amount must be greater than 0" : "Insufficient balance"}
            </p>
          )}
        </div>

        {/* Status */}
        {isSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-600">Transfer sent!</p>
              {txHash && (
                <a
                  href={`https://celoscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-muted-foreground hover:underline font-mono truncate block"
                >
                  {txHash.slice(0, 18)}…
                </a>
              )}
            </div>
          </div>
        )}

        {txError && (
          <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3">
            <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-rose-600 leading-snug">{txError}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleTransfer}
          disabled={!canSubmit}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all",
            canSubmit
              ? "bg-[#35d07f] text-white hover:brightness-105 active:scale-[0.99] shadow-sm"
              : "bg-secondary text-muted-foreground cursor-not-allowed"
          )}
        >
          {isPending || isConfirming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isPending ? "Confirm in wallet…" : "Confirming…"}
            </>
          ) : (
            <>
              Transfer {token === "celo" ? "CELO" : "USDT"}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </ResponsiveSheet>
  );
}
