"use client";

import {
  Modal,
  ModalContent,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { getTipQuickAmounts } from "@/lib/token-amounts";

export function DeluluTipModal({
  open,
  onOpenChange,
  tokenSymbol,
  tipAmountInput,
  onTipAmountChange,
  walletBalanceNum,
  walletBalanceLabel,
  isLoadingBalance,
  toUsd,
  marketToken,
  tipError,
  isTipping,
  isConfirming,
  onMax,
  onQuickTip,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenSymbol: string;
  tipAmountInput: string;
  onTipAmountChange: (value: string) => void;
  walletBalanceNum: number;
  walletBalanceLabel: string;
  isLoadingBalance: boolean;
  toUsd: (amount: number | null | undefined) => string | null;
  marketToken?: string;
  tipError: string | null;
  isTipping: boolean;
  isConfirming: boolean;
  onMax: () => void;
  onQuickTip: (amount: number) => void;
  onSubmit: () => void;
}) {
  const tipNum = Number(tipAmountInput);
  const isOver =
    Number.isFinite(tipNum) && tipNum > 0 && tipNum > walletBalanceNum;
  const submitDisabled =
    isTipping ||
    isConfirming ||
    !Number.isFinite(tipNum) ||
    tipNum <= 0 ||
    tipNum > walletBalanceNum;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <ModalContent className="max-w-sm p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-5 space-y-5">
          <div>
            <h2 className="text-xl font-black tracking-tight text-foreground">
              Support this goal
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Send a tip to help bring this dream to life.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Amount
              </span>
              <button
                type="button"
                onClick={onMax}
                className="h-6 px-2.5 rounded-full text-[11px] font-semibold bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                Max
              </button>
            </div>
            <div className="relative rounded-2xl border border-border bg-secondary/40 focus-within:border-foreground/30 transition-colors">
              <input
                type="text"
                inputMode="decimal"
                value={tipAmountInput}
                onChange={(e) =>
                  onTipAmountChange(e.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="0"
                className="w-full h-16 rounded-2xl bg-transparent pl-5 pr-20 text-4xl font-black text-foreground tracking-tight focus:outline-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                {tokenSymbol}
              </span>
            </div>
            <div className="flex items-center justify-between px-1 text-xs">
              {isOver ? (
                <span className="font-semibold text-destructive">
                  Insufficient balance
                </span>
              ) : (
                <span className="text-muted-foreground">Available</span>
              )}
              <span className="font-semibold text-muted-foreground">
                {isLoadingBalance ? (
                  "…"
                ) : (
                  <>
                    {walletBalanceLabel} {tokenSymbol}
                    {toUsd(walletBalanceNum) && (
                      <span className="ml-1 font-normal opacity-70">
                        (≈ ${toUsd(walletBalanceNum)})
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {getTipQuickAmounts(marketToken).map(
              (v) => {
                const isSelected = Number(tipAmountInput) === v;
                const isAffordable = v <= walletBalanceNum;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onQuickTip(v)}
                    disabled={!isAffordable}
                    className={cn(
                      "h-11 rounded-xl text-sm font-bold transition-all",
                      isSelected
                        ? "bg-foreground text-background"
                        : isAffordable
                          ? "bg-secondary text-foreground hover:bg-secondary/80"
                          : "bg-secondary/40 text-muted-foreground/40 cursor-not-allowed",
                    )}
                  >
                    {v}
                  </button>
                );
              },
            )}
          </div>

          {tipError ? (
            <div
              role="alert"
              className="rounded-xl bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive"
            >
              {tipError}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className={cn(
              "w-full h-13 rounded-full py-3.5 text-sm font-black text-white transition-all",
              "bg-delulu-charcoal hover:bg-delulu-charcoal/90 active:scale-[0.98]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {isTipping
              ? "Confirm in wallet…"
              : isConfirming
                ? "Sending…"
                : "Send tip"}
          </button>
        </div>
      </ModalContent>
    </Modal>
  );
}
