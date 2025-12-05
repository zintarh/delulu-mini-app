"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAccount } from "wagmi";
import { type FormattedDelulu } from "@/hooks/use-delulus";
import { useStake } from "@/hooks/use-stake";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface DeluluDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delulu: FormattedDelulu | null;
}

function formatTimeRemaining(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(diff / (1000 * 60))}m`;
}

export function DeluluDetailsSheet({
  open,
  onOpenChange,
  delulu,
}: DeluluDetailsSheetProps) {
  const { isConnected, address } = useAccount();
  const { stake, isPending, isConfirming } = useStake();
  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    refetchAllowance,
  } = useTokenApproval();
  const [stakeAmount, setStakeAmount] = useState("1");
  const [pendingAction, setPendingAction] = useState<"believe" | "doubt" | null>(null);

  if (!delulu) return null;

  const total = delulu.totalBelieverStake + delulu.totalDoubterStake;
  const believerPercent =
    total > 0 ? Math.round((delulu.totalBelieverStake / total) * 100) : 0;

  // Auto-stake after approval succeeds
  useEffect(() => {
    if (isApprovalSuccess && pendingAction) {
      const amount = parseFloat(stakeAmount);
      if (pendingAction === "believe") {
        stake(delulu.id, amount, true);
      } else {
        stake(delulu.id, amount, false);
      }
      setPendingAction(null);
      refetchAllowance();
    }
  }, [isApprovalSuccess, pendingAction, stakeAmount, delulu.id, stake, refetchAllowance]);

  const handleBelieve = async () => {
    if (!isConnected || !address) return;
    const amount = parseFloat(stakeAmount);
    if (needsApproval(amount)) {
      setPendingAction("believe");
      await approve(amount);
      return;
    }
    try {
      await stake(delulu.id, amount, true);
    } catch (error) {
      console.error("Stake error:", error);
    }
  };

  const handleDoubt = async () => {
    if (!isConnected || !address) return;
    const amount = parseFloat(stakeAmount);
    if (needsApproval(amount)) {
      setPendingAction("doubt");
      await approve(amount);
      return;
    }
    try {
      await stake(delulu.id, amount, false);
    } catch (error) {
      console.error("Stake error:", error);
    }
  };

  const isStaking =
    isPending || isConfirming || isApproving || isApprovingConfirming;
  const canStake = !delulu.isResolved && new Date() < delulu.stakingDeadline;
  const amount = parseFloat(stakeAmount);
  const needsApprovalForAmount = needsApproval(amount);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-delulu-yellow border-t-2 border-delulu-dark/20 h-[85vh] max-h-[85vh] overflow-hidden p-0 rounded-t-3xl [&>button]:text-delulu-dark [&>button]:bg-delulu-dark/10 [&>button]:hover:bg-delulu-dark/20"
      >
        <div className="relative h-full flex flex-col overflow-y-auto pb-24">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-delulu-dark/10 flex items-center justify-center">
                <span className="text-sm font-bold text-delulu-dark">
                  {formatAddress(delulu.creator).slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-delulu-dark">
                  {formatAddress(delulu.creator)}
                </p>
                <p className="text-xs text-delulu-dark/50">
                  Created{" "}
                  {new Date(delulu.stakingDeadline).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="mb-6">
              <p className="text-2xl font-gloria text-delulu-dark leading-tight mb-4">
                &ldquo;{delulu.content || delulu.contentHash}&rdquo;
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-delulu-dark/5">
                <p className="text-xs text-delulu-dark/50 mb-1">Believers</p>
                <p className="text-xl font-black text-delulu-dark">
                  {delulu.totalBelieverStake > 0
                    ? delulu.totalBelieverStake < 0.01
                      ? delulu.totalBelieverStake.toFixed(4)
                      : delulu.totalBelieverStake.toFixed(2)
                    : "0.00"}{" "}
                  cUSD
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-delulu-dark/5">
                <p className="text-xs text-delulu-dark/50 mb-1">Doubters</p>
                <p className="text-xl font-black text-delulu-dark">
                  {delulu.totalDoubterStake > 0
                    ? delulu.totalDoubterStake < 0.01
                      ? delulu.totalDoubterStake.toFixed(4)
                      : delulu.totalDoubterStake.toFixed(2)
                    : "0.00"}{" "}
                  cUSD
                </p>
              </div>
            </div>

            {/* Progress Ring */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="rgba(10,10,10,0.2)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#0a0a0a"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={
                      2 * Math.PI * 40 -
                      (believerPercent / 100) * 2 * Math.PI * 40
                    }
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-delulu-dark">
                    {believerPercent}%
                  </span>
                  <span className="text-xs text-delulu-dark/50">Believe</span>
                </div>
              </div>
            </div>

            {/* Deadline */}
            <div className="p-4 rounded-2xl bg-delulu-dark/5 mb-6">
              <p className="text-xs text-delulu-dark/50 mb-1">
                Staking Deadline
              </p>
              <p className="text-lg font-black text-delulu-dark">
                {formatTimeRemaining(delulu.stakingDeadline)} remaining
              </p>
              <p className="text-xs text-delulu-dark/50 mt-1">
                {delulu.stakingDeadline.toLocaleDateString()} at{" "}
                {delulu.stakingDeadline.toLocaleTimeString()}
              </p>
            </div>

            {/* Stake Amount Input */}
            {canStake && isConnected && (
              <div className="mb-6">
                <label className="block text-sm font-bold text-delulu-dark mb-2">
                  Stake Amount (cUSD)
                </label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  min="0.001"
                  step="0.001"
                  className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-delulu-dark text-delulu-dark font-bold text-lg focus:outline-none focus:ring-2 focus:ring-delulu-dark"
                />
              </div>
            )}
          </div>
        </div>

        {/* Floating Action Buttons */}
        {canStake && isConnected && (
          <div className="sticky bottom-0 left-0 right-0 px-6 py-4 bg-delulu-yellow border-t border-delulu-dark/10 flex gap-4 z-50">
            <button
              onClick={handleBelieve}
              disabled={isStaking || !stakeAmount || amount <= 0}
              className={cn(
                "flex-1 px-6 py-4",
                "bg-white rounded-full",
                "text-delulu-dark font-black text-lg",
                "shadow-[0_4px_0_0_#0a0a0a]",
                "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
                "transition-all duration-150",
                "disabled:opacity-70 disabled:shadow-[0_2px_0_0_#0a0a0a] disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {isStaking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>
                    {isApproving || isApprovingConfirming
                      ? "Approving..."
                      : "Staking..."}
                  </span>
                </>
              ) : needsApprovalForAmount ? (
                <span>Approve & Believe</span>
              ) : (
                <span>Believe</span>
              )}
            </button>
            <button
              onClick={handleDoubt}
              disabled={isStaking || !stakeAmount || amount <= 0}
              className={cn(
                "flex-1 px-6 py-4",
                "bg-white rounded-full",
                "text-delulu-dark font-black text-lg",
                "shadow-[0_4px_0_0_#0a0a0a]",
                "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
                "transition-all duration-150",
                "disabled:opacity-70 disabled:shadow-[0_2px_0_0_#0a0a0a] disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {isStaking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>
                    {isApproving || isApprovingConfirming
                      ? "Approving..."
                      : "Staking..."}
                  </span>
                </>
              ) : needsApprovalForAmount ? (
                <span>Approve & Doubt</span>
              ) : (
                <span>Doubt</span>
              )}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
