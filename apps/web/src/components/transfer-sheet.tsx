"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { parseEther, parseUnits, isAddress } from "viem";
import { useBalance, usePublicClient } from "wagmi";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
  XCircle,
} from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { TokenBadge } from "@/components/token-badge";
import { useUnifiedWalletClient } from "@/hooks/use-unified-wallet-client";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useAuth } from "@/hooks/use-auth";
import {
  CELO_MAINNET_ID,
  CUSD_ADDRESSES,
  GOODDOLLAR_ADDRESSES,
  USDT_ADDRESSES,
} from "@/lib/constant";
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

type TokenId = "gdollar" | "celo" | "cusd" | "usdt";

const TRANSFER_TOKENS: {
  id: TokenId;
  symbol: string;
  name: string;
  address?: `0x${string}`;
  logo?: string;
}[] = [
  {
    id: "gdollar",
    symbol: "G$",
    name: "GoodDollar",
    address: GOODDOLLAR_ADDRESSES.mainnet,
  },
  {
    id: "celo",
    symbol: "CELO",
    name: "Celo",
    logo: "/celo.png",
  },
  {
    id: "cusd",
    symbol: "cUSD",
    name: "Celo Dollar",
    address: CUSD_ADDRESSES.mainnet,
  },
  {
    id: "usdt",
    symbol: "USDT",
    name: "Tether",
    address: USDT_ADDRESSES.mainnet,
  },
];

interface TransferSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired as soon as the tx is broadcast — use to drop UI balances immediately. */
  onTransferBroadcast?: (info: { tokenId: TokenId; amount: number }) => void;
  /** Fired after a transfer is mined and balances have been refetched. */
  onTransferSuccess?: () => void;
  /** Fired if a broadcast transfer fails confirmation — reverse optimistic spend. */
  onTransferFailed?: (info: { tokenId: TokenId; amount: number }) => void;
}

function formatBalance(value: string | number | undefined, digits: number) {
  if (value === undefined || value === null) return "0";
  const n = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(n)) return "0";
  return n.toFixed(digits);
}

export function TransferSheet({
  open,
  onOpenChange,
  onTransferBroadcast,
  onTransferSuccess,
  onTransferFailed,
}: TransferSheetProps) {
  const { address } = useAuth();
  const walletClient = useUnifiedWalletClient();
  const publicClient = usePublicClient({ chainId: CELO_MAINNET_ID });
  const { writeContractAsync } = useUnifiedWriteContract();

  const {
    data: celoBalance,
    isLoading: isCeloLoading,
    refetch: refetchCelo,
  } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!address },
  });

  const gDollar = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const cusd = useTokenBalance(CUSD_ADDRESSES.mainnet);
  const usdt = useTokenBalance(USDT_ADDRESSES.mainnet);

  const [tokenId, setTokenId] = useState<TokenId>("gdollar");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  /** Human-unit amounts already spent until chain refetch catches up. */
  const [spentByToken, setSpentByToken] = useState<Partial<Record<TokenId, number>>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedToken =
    TRANSFER_TOKENS.find((t) => t.id === tokenId) ?? TRANSFER_TOKENS[0];

  useEffect(() => {
    if (!dropdownOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [dropdownOpen]);

  const rawBalances: Record<TokenId, { raw: number; decimals: number; isLoading: boolean }> = {
    gdollar: {
      raw: parseFloat(gDollar.formatted) || 0,
      decimals: gDollar.balance?.decimals ?? 18,
      isLoading: gDollar.isLoading,
    },
    celo: {
      raw: parseFloat(celoBalance?.formatted ?? "0") || 0,
      decimals: celoBalance?.decimals ?? 18,
      isLoading: isCeloLoading,
    },
    cusd: {
      raw: parseFloat(cusd.formatted) || 0,
      decimals: cusd.balance?.decimals ?? 18,
      isLoading: cusd.isLoading,
    },
    usdt: {
      raw: parseFloat(usdt.formatted) || 0,
      decimals: usdt.balance?.decimals ?? 6,
      isLoading: usdt.isLoading,
    },
  };

  const displayBalance = (id: TokenId) =>
    Math.max(0, rawBalances[id].raw - (spentByToken[id] ?? 0));

  // Once the RPC balance has dropped to cover the optimistic spend, clear it.
  useEffect(() => {
    setSpentByToken((prev) => {
      const entries = Object.entries(prev) as [TokenId, number][];
      if (entries.length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const [id, spent] of entries) {
        if (rawBalances[id].raw <= spent + 1e-9) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // rawBalances is derived each render from these deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gDollar.formatted, cusd.formatted, usdt.formatted, celoBalance?.formatted]);

  const selectedBalanceRaw = rawBalances[tokenId];
  const selectedAvailable = displayBalance(tokenId);
  const maxDigits = tokenId === "celo" ? 4 : 2;
  const maxBalance = formatBalance(selectedAvailable, maxDigits);
  const hasTokenBalance = selectedAvailable > 0;

  const recipientValid = recipient.length === 0 || isAddress(recipient);
  const amountNum = parseFloat(amount);
  const amountValid =
    amount.length === 0 ||
    (!isNaN(amountNum) && amountNum > 0 && amountNum <= selectedAvailable + 1e-12);

  const canSubmit =
    isAddress(recipient) &&
    !isNaN(amountNum) &&
    amountNum > 0 &&
    amountNum <= selectedAvailable + 1e-12 &&
    hasTokenBalance &&
    !isPending &&
    !isConfirming &&
    !isSuccess &&
    !!walletClient;

  const refetchAllBalances = useCallback(async () => {
    await Promise.all([
      gDollar.refetch(),
      cusd.refetch(),
      usdt.refetch(),
      refetchCelo(),
    ]);
  }, [gDollar.refetch, cusd.refetch, usdt.refetch, refetchCelo]);

  const rollbackSpend = useCallback((id: TokenId, spendAmount: number) => {
    setSpentByToken((prev) => {
      const next = { ...prev };
      const left = (next[id] ?? 0) - spendAmount;
      if (left <= 1e-12) delete next[id];
      else next[id] = left;
      return next;
    });
  }, []);

  const handleTransfer = useCallback(async () => {
    if (!canSubmit || !address) return;
    setTxError(null);
    setTxHash(undefined);
    setIsSuccess(false);
    setIsPending(true);

    const spendAmount = amountNum;
    const spendToken = tokenId;
    let appliedOptimistic = false;

    try {
      let hash: `0x${string}`;

      if (spendToken === "celo") {
        hash = await (walletClient as any).sendTransaction({
          account: address,
          to: recipient as `0x${string}`,
          value: parseEther(amount),
          chain: undefined,
        });
      } else {
        const token = TRANSFER_TOKENS.find((t) => t.id === spendToken);
        if (!token?.address) throw new Error("Unknown token");
        const decimals = selectedBalanceRaw.decimals;
        hash = await writeContractAsync({
          address: token.address,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [recipient as `0x${string}`, parseUnits(amount, decimals)],
        });
      }

      // Reflect the spend immediately so UI can't look flush after broadcast.
      setSpentByToken((prev) => ({
        ...prev,
        [spendToken]: (prev[spendToken] ?? 0) + spendAmount,
      }));
      appliedOptimistic = true;
      onTransferBroadcast?.({ tokenId: spendToken, amount: spendAmount });
      setTxHash(hash);
      setIsPending(false);
      setIsConfirming(true);

      if (!publicClient) {
        throw new Error("No RPC client available to confirm the transfer");
      }

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 120_000,
        pollingInterval: 1_500,
      });
      if (receipt.status !== "success") {
        throw new Error("Transfer failed on-chain");
      }

      await refetchAllBalances();
      setIsSuccess(true);
      onTransferSuccess?.();
    } catch (err: unknown) {
      if (appliedOptimistic) {
        rollbackSpend(spendToken, spendAmount);
        onTransferFailed?.({ tokenId: spendToken, amount: spendAmount });
      }
      const anyErr = err as { shortMessage?: string; message?: string };
      setTxError(anyErr?.shortMessage ?? anyErr?.message ?? "Transaction failed");
    } finally {
      setIsPending(false);
      setIsConfirming(false);
    }
  }, [
    canSubmit,
    address,
    tokenId,
    recipient,
    amount,
    amountNum,
    walletClient,
    selectedBalanceRaw.decimals,
    writeContractAsync,
    publicClient,
    refetchAllBalances,
    onTransferBroadcast,
    onTransferSuccess,
    onTransferFailed,
    rollbackSpend,
  ]);

  const handleClose = () => {
    if (isPending || isConfirming) return;
    onOpenChange(false);
    setDropdownOpen(false);
    setTimeout(() => {
      setTokenId("gdollar");
      setRecipient("");
      setAmount("");
      setTxHash(undefined);
      setTxError(null);
      setIsSuccess(false);
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
      <div className="mx-auto max-w-lg space-y-5 px-4 pb-10 pt-4 lg:px-0 lg:pt-2">
        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Token
          </label>
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border bg-secondary px-4 py-3 text-left transition-colors",
                dropdownOpen
                  ? "border-[#35d07f]/60 ring-1 ring-[#35d07f]/40"
                  : "border-border/40 hover:border-border",
              )}
            >
              <TokenIcon token={selectedToken} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {selectedToken.symbol}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedBalanceRaw.isLoading
                    ? "…"
                    : `Balance ${formatBalance(
                        displayBalance(tokenId),
                        tokenId === "celo" ? 3 : 2,
                      )}`}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  dropdownOpen && "rotate-180",
                )}
              />
            </button>

            {dropdownOpen ? (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border/50 bg-background shadow-lg">
                {TRANSFER_TOKENS.map((t) => {
                  const bal = rawBalances[t.id];
                  const available = displayBalance(t.id);
                  const isSelected = t.id === tokenId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTokenId(t.id);
                        setAmount("");
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                        isSelected ? "bg-foreground/5" : "hover:bg-muted/50",
                      )}
                    >
                      <TokenIcon token={t} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {t.symbol}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.name}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                        {bal.isLoading
                          ? "…"
                          : formatBalance(available, t.id === "celo" ? 3 : 2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recipient address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.trim())}
            placeholder="0x..."
            disabled={isSuccess}
            className={cn(
              "w-full rounded-xl border bg-secondary px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus:outline-none focus:ring-1",
              !recipientValid
                ? "border-rose-500/60 focus:ring-rose-500/40"
                : "border-border/40 focus:border-[#35d07f]/60 focus:ring-[#35d07f]/40",
            )}
          />
          {!recipientValid && (
            <p className="mt-1 text-[11px] text-rose-500">Invalid address</p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Amount
            </label>
            <button
              type="button"
              onClick={() => setAmount(maxBalance)}
              disabled={!hasTokenBalance || isSuccess}
              className="text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
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
            disabled={isSuccess || !hasTokenBalance}
            className={cn(
              "w-full rounded-xl border bg-secondary px-4 py-3 text-sm font-bold text-foreground placeholder:text-muted-foreground/50 transition-colors focus:outline-none focus:ring-1",
              !amountValid
                ? "border-rose-500/60 focus:ring-rose-500/40"
                : "border-border/40 focus:border-[#35d07f]/60 focus:ring-[#35d07f]/40",
            )}
          />
          {!hasTokenBalance && !selectedBalanceRaw.isLoading ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              No {selectedToken.symbol} balance to send
            </p>
          ) : null}
          {!amountValid && amount.length > 0 && (
            <p className="mt-1 text-[11px] text-rose-500">
              {amountNum <= 0
                ? "Amount must be greater than 0"
                : "Insufficient balance"}
            </p>
          )}
        </div>

        {isSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-600">
                Transfer sent!
              </p>
              {txHash && (
                <a
                  href={`https://celoscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-mono text-[11px] text-muted-foreground hover:underline"
                >
                  {txHash.slice(0, 18)}…
                </a>
              )}
            </div>
          </div>
        )}

        {txError && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <p className="text-[12px] leading-snug text-rose-600">{txError}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleTransfer()}
          disabled={!canSubmit}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all",
            canSubmit
              ? "bg-[#35d07f] text-white shadow-sm hover:brightness-105 active:scale-[0.99]"
              : "cursor-not-allowed bg-secondary text-muted-foreground",
          )}
        >
          {isPending || isConfirming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isPending ? "Confirm in wallet…" : "Confirming…"}
            </>
          ) : isSuccess ? (
            <>
              Sent
              <CheckCircle2 className="h-4 w-4" />
            </>
          ) : (
            <>
              Transfer {selectedToken.symbol}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </ResponsiveSheet>
  );
}

function TokenIcon({
  token,
}: {
  token: (typeof TRANSFER_TOKENS)[number];
}) {
  if (token.logo) {
    return (
      <img
        src={token.logo}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full"
      />
    );
  }
  if (token.address) {
    return (
      <TokenBadge tokenAddress={token.address} size="md" showText={false} />
    );
  }
  return null;
}
