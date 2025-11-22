"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { ChickenOutModal } from "@/components/chicken-out-modal";
import { TransactionStatus, ApprovalFlow } from "@/components/transaction-status";
import { 
  Timer, Heart, Flame, AlertTriangle, TrendingUp, TrendingDown, 
  RefreshCw, CheckCircle, Trophy, Shield 
} from "lucide-react";
import {
  useGetDelusion,
  useGetUserStake,
  useStakeBelieve,
  useStakeDoubt,
  useSwitchToBelieve,
  useSwitchToDoubt,
  useWithdrawStake,
  useFinalizeDelusionSuccess,
  useFinalizeDelusionFail,
  useClaimReward,
} from "@/lib/hooks/use-delulu-contract";
import { 
  useCheckAndApproveCUSD, 
  useCUSDBalance, 
  parseCUSD, 
  formatCUSD 
} from "@/lib/hooks/use-cusd-approval";
import { DelusionStatus, StakePosition } from "@/lib/contracts/config";
import { notFound } from "next/navigation";

export default function DelusionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { address: userAddress, isConnected } = useAccount();
  const { id } = use(params);
  const delusionId = BigInt(id);

  // State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("10");
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Fetch delusion data
  const { delusion, isLoading: loadingDelusion, refetch: refetchDelusion } = useGetDelusion(delusionId);
  const { userStake, refetch: refetchUserStake } = useGetUserStake(delusionId, userAddress);
  const { balance, balanceFormatted } = useCUSDBalance();

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!delusion) return "Loading...";
    const now = Math.floor(Date.now() / 1000);
    const deadline = Number(delusion.deadline);
    const remaining = deadline - now;
    
    if (remaining <= 0) return "Expired";
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Check if user is creator
  const isCreator = userAddress && delusion && delusion.creator.toLowerCase() === userAddress.toLowerCase();
  const isActive = delusion && delusion.status === DelusionStatus.Active;
  const isFinalized = delusion && (delusion.status === DelusionStatus.SuccessFinalized || delusion.status === DelusionStatus.FailedFinalized);
  const hasStake = userStake && userStake.amount > 0n;
  const userPosition = userStake?.position || StakePosition.None;

  // Check if user won
  const isWinner = delusion && userStake && (
    (delusion.status === DelusionStatus.SuccessFinalized && userStake.position === StakePosition.Believe) ||
    (delusion.status === DelusionStatus.FailedFinalized && userStake.position === StakePosition.Doubt)
  );

  // Approve and stake
  const stakeAmountBigInt = parseCUSD(stakeAmount);
  const approval = useCheckAndApproveCUSD(stakeAmountBigInt);
  const hasInsufficientBalance = balance !== undefined && balance < stakeAmountBigInt;

  // Contract interactions
  const stakeBelieve = useStakeBelieve(() => {
    refetchDelusion();
    refetchUserStake();
    setActiveAction(null);
    setStakeAmount("10");
  });

  const stakeDoubt = useStakeDoubt(() => {
    refetchDelusion();
    refetchUserStake();
    setActiveAction(null);
    setStakeAmount("10");
  });

  const switchToBelieve = useSwitchToBelieve(() => {
    refetchDelusion();
    refetchUserStake();
    setActiveAction(null);
  });

  const switchToDoubt = useSwitchToDoubt(() => {
    refetchDelusion();
    refetchUserStake();
    setActiveAction(null);
  });

  const withdrawStake = useWithdrawStake(() => {
    refetchDelusion();
    refetchUserStake();
    setShowWithdrawModal(false);
    setActiveAction(null);
  });

  const finalizeSuccess = useFinalizeDelusionSuccess(() => {
    refetchDelusion();
    setShowFinalizeModal(false);
    setActiveAction(null);
  });

  const finalizeFail = useFinalizeDelusionFail(() => {
    refetchDelusion();
    setShowFinalizeModal(false);
    setActiveAction(null);
  });

  const claimReward = useClaimReward(() => {
    refetchUserStake();
    setActiveAction(null);
  });

  if (loadingDelusion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Flame className="w-12 h-12 text-delulu-yellow animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading delusion...</p>
        </div>
      </div>
    );
  }

  if (!delusion) {
    notFound();
  }

  const total = delusion.believePool + delusion.doubtPool;
  const believersPercent = total > 0n ? Number((delusion.believePool * 100n) / total) : 50;

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title={delusion.delulu} />

      <div className="w-full max-w-5xl mx-auto px-6 space-y-6 mt-6">
        {/* Status Card */}
        <Card className="p-6 bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-xl">Delusion Status</h2>
            <div className="flex gap-2">
              <Badge variant="outline" className="font-bold border-border">
                <Timer className="w-3 h-3 mr-1" />
                {getTimeRemaining()}
              </Badge>
              {delusion.status === DelusionStatus.Active && (
                <Badge className="bg-delulu-green/10 text-delulu-green border-delulu-green/20">
                  Active
                </Badge>
              )}
              {delusion.status === DelusionStatus.SuccessFinalized && (
                <Badge className="bg-delulu-green/10 text-delulu-green border-delulu-green/20">
                  Success
                </Badge>
              )}
              {delusion.status === DelusionStatus.FailedFinalized && (
                <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                  Failed
                </Badge>
              )}
            </div>
          </div>

          {/* Pool Distribution */}
          <div className="mb-6">
            <div className="h-3 bg-muted/50 rounded-full overflow-hidden mb-4">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: "100%",
                  background: `linear-gradient(to right, var(--delulu-yellow) 0%, var(--delulu-yellow) ${believersPercent}%, var(--delulu-purple) ${believersPercent}%, var(--delulu-purple) 100%)`,
                }}
              />
            </div>
            <div className="flex justify-between items-center">
              <div className="text-left">
                <p className="text-xs text-muted-foreground font-medium">Believers</p>
                <p className="font-black text-xl text-delulu-yellow">
                  {formatCUSD(delusion.believePool)} cUSD
                </p>
                <p className="text-xs text-muted-foreground">{delusion.believerCount.toString()} people</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-delulu-yellow/10 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-delulu-yellow" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium">Doubters</p>
                <p className="font-black text-xl text-delulu-purple">
                  {formatCUSD(delusion.doubtPool)} cUSD
                </p>
                <p className="text-xs text-muted-foreground">{delusion.doubterCount.toString()} people</p>
              </div>
            </div>
          </div>

          {/* User's Current Stake */}
          {hasStake && (
            <Card className="p-4 bg-muted/30 border border-delulu-yellow/30 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Your Position</p>
                  <div className="flex items-center gap-2 mt-1">
                    {userPosition === StakePosition.Believe ? (
                      <Badge className="bg-delulu-yellow/10 text-delulu-yellow border-delulu-yellow/20">
                        <Heart className="w-3 h-3 mr-1" />
                        Believing
                      </Badge>
                    ) : (
                      <Badge className="bg-delulu-purple/10 text-delulu-purple border-delulu-purple/20">
                        <Shield className="w-3 h-3 mr-1" />
                        Doubting
                      </Badge>
                    )}
                    <span className="font-black text-lg">{formatCUSD(userStake.amount)} cUSD</span>
                  </div>
                </div>
                {isFinalized && isWinner && !userStake.hasClaimed && (
                  <Badge className="bg-delulu-green/10 text-delulu-green border-delulu-green/20">
                    <Trophy className="w-3 h-3 mr-1" />
                    Winner!
                  </Badge>
                )}
              </div>
            </Card>
          )}

          {/* Action Buttons - Active Delusion */}
          {isActive && isConnected && (
            <div className="space-y-4">
              {/* Stake More */}
              {(userPosition === StakePosition.None || activeAction === "stake") && (
                <div className="space-y-3">
                  <label className="text-sm font-bold">Stake Amount (cUSD)</label>
                  <Input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="h-12 text-lg"
                    placeholder="10"
                    min="0.1"
                    step="0.1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Balance: {balanceFormatted} cUSD
                    {hasInsufficientBalance && <span className="text-red-500 ml-2">Insufficient balance!</span>}
                  </p>

                  {approval.needsApproval && (
                    <ApprovalFlow
                      needsApproval={approval.needsApproval}
                      hasInfiniteApproval={approval.hasInfiniteApproval}
                      isPending={approval.isPending}
                      isConfirming={approval.isConfirming}
                      isSuccess={approval.isSuccess}
                      error={approval.error}
                      hash={approval.hash}
                      onApprove={() => approval.approve(stakeAmountBigInt)}
                      onApproveMax={approval.approveMax}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      size="lg"
                      className="h-14 bg-delulu-yellow hover:bg-delulu-yellow/90 text-delulu-dark font-black text-base rounded-xl disabled:opacity-50"
                      onClick={() => {
                        setActiveAction("stake-believe");
                        stakeBelieve.stakeBelieve(delusionId, stakeAmountBigInt);
                      }}
                      disabled={approval.needsApproval || hasInsufficientBalance || stakeBelieve.isPending || Number(stakeAmount) <= 0}
                    >
                      <Heart className="w-5 h-5 mr-2" />
                      {userPosition === StakePosition.Believe ? "STAKE MORE" : "BELIEVE"}
                    </Button>
                    <Button
                      size="lg"
                      className="h-14 bg-delulu-purple hover:bg-delulu-purple/90 text-white font-black text-base rounded-xl disabled:opacity-50"
                      onClick={() => {
                        setActiveAction("stake-doubt");
                        stakeDoubt.stakeDoubt(delusionId, stakeAmountBigInt);
                      }}
                      disabled={approval.needsApproval || hasInsufficientBalance || stakeDoubt.isPending || Number(stakeAmount) <= 0}
                    >
                      <Flame className="w-5 h-5 mr-2" />
                      {userPosition === StakePosition.Doubt ? "STAKE MORE" : "DOUBT"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Switch Position */}
              {hasStake && userPosition !== StakePosition.None && (
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                  {userPosition === StakePosition.Doubt && (
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 border-delulu-yellow text-delulu-yellow hover:bg-delulu-yellow/10 font-bold rounded-xl"
                      onClick={() => {
                        setActiveAction("switch-believe");
                        switchToBelieve.switchToBelieve(delusionId);
                      }}
                      disabled={switchToBelieve.isPending}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Switch to Believe
                    </Button>
                  )}
                  {userPosition === StakePosition.Believe && (
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 border-delulu-purple text-delulu-purple hover:bg-delulu-purple/10 font-bold rounded-xl"
                      onClick={() => {
                        setActiveAction("switch-doubt");
                        switchToDoubt.switchToDoubt(delusionId);
                      }}
                      disabled={switchToDoubt.isPending}
                    >
                      <TrendingDown className="w-4 h-4 mr-2" />
                      Switch to Doubt
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 border-destructive/30 text-destructive hover:bg-destructive/5 font-bold rounded-xl"
                    onClick={() => setShowWithdrawModal(true)}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Withdraw (5% penalty)
                  </Button>
                </div>
              )}

              {/* Transaction Status */}
              {(stakeBelieve.isPending || stakeBelieve.isConfirming || stakeBelieve.isSuccess || stakeBelieve.error) && activeAction === "stake-believe" && (
                <TransactionStatus
                  isPending={stakeBelieve.isPending && !stakeBelieve.isConfirming}
                  isConfirming={stakeBelieve.isConfirming}
                  isSuccess={stakeBelieve.isSuccess}
                  error={stakeBelieve.error}
                  hash={stakeBelieve.hash}
                  successMessage="Successfully staked on Believe!"
                />
              )}
              {(stakeDoubt.isPending || stakeDoubt.isConfirming || stakeDoubt.isSuccess || stakeDoubt.error) && activeAction === "stake-doubt" && (
                <TransactionStatus
                  isPending={stakeDoubt.isPending && !stakeDoubt.isConfirming}
                  isConfirming={stakeDoubt.isConfirming}
                  isSuccess={stakeDoubt.isSuccess}
                  error={stakeDoubt.error}
                  hash={stakeDoubt.hash}
                  successMessage="Successfully staked on Doubt!"
                />
              )}
              {(switchToBelieve.isPending || switchToBelieve.isConfirming || switchToBelieve.isSuccess || switchToBelieve.error) && activeAction === "switch-believe" && (
                <TransactionStatus
                  isPending={switchToBelieve.isPending && !switchToBelieve.isConfirming}
                  isConfirming={switchToBelieve.isConfirming}
                  isSuccess={switchToBelieve.isSuccess}
                  error={switchToBelieve.error}
                  hash={switchToBelieve.hash}
                  successMessage="Successfully switched to Believe!"
                />
              )}
              {(switchToDoubt.isPending || switchToDoubt.isConfirming || switchToDoubt.isSuccess || switchToDoubt.error) && activeAction === "switch-doubt" && (
                <TransactionStatus
                  isPending={switchToDoubt.isPending && !switchToDoubt.isConfirming}
                  isConfirming={switchToDoubt.isConfirming}
                  isSuccess={switchToDoubt.isSuccess}
                  error={switchToDoubt.error}
                  hash={switchToDoubt.hash}
                  successMessage="Successfully switched to Doubt!"
                />
              )}
            </div>
          )}

          {/* Finalize - Creator Only, After Deadline */}
          {isActive && isCreator && getTimeRemaining() === "Expired" && (
            <div className="space-y-3 pt-4 border-t border-border">
              <p className="text-sm font-bold text-center">Deadline reached! Finalize the outcome:</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="lg"
                  className="h-14 bg-delulu-green hover:bg-delulu-green/90 text-white font-black rounded-xl"
                  onClick={() => {
                    setActiveAction("finalize-success");
                    finalizeSuccess.finalizeSuccess(delusionId);
                  }}
                  disabled={finalizeSuccess.isPending}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Made It!
                </Button>
                <Button
                  size="lg"
                  className="h-14 bg-red-500 hover:bg-red-500/90 text-white font-black rounded-xl"
                  onClick={() => {
                    setActiveAction("finalize-fail");
                    finalizeFail.finalizeFail(delusionId);
                  }}
                  disabled={finalizeFail.isPending}
                >
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Failed
                </Button>
              </div>
              {(finalizeSuccess.isPending || finalizeSuccess.isConfirming || finalizeSuccess.isSuccess || finalizeSuccess.error) && activeAction === "finalize-success" && (
                <TransactionStatus
                  isPending={finalizeSuccess.isPending && !finalizeSuccess.isConfirming}
                  isConfirming={finalizeSuccess.isConfirming}
                  isSuccess={finalizeSuccess.isSuccess}
                  error={finalizeSuccess.error}
                  hash={finalizeSuccess.hash}
                  successMessage="Delusion finalized as Success!"
                />
              )}
              {(finalizeFail.isPending || finalizeFail.isConfirming || finalizeFail.isSuccess || finalizeFail.error) && activeAction === "finalize-fail" && (
                <TransactionStatus
                  isPending={finalizeFail.isPending && !finalizeFail.isConfirming}
                  isConfirming={finalizeFail.isConfirming}
                  isSuccess={finalizeFail.isSuccess}
                  error={finalizeFail.error}
                  hash={finalizeFail.hash}
                  successMessage="Delusion finalized as Failed!"
                />
              )}
            </div>
          )}

          {/* Claim Rewards */}
          {isFinalized && hasStake && isWinner && !userStake.hasClaimed && (
            <div className="space-y-3 pt-4 border-t border-border">
              <Card className="p-4 bg-delulu-green/5 border border-delulu-green/30">
                <div className="text-center">
                  <Trophy className="w-12 h-12 text-delulu-green mx-auto mb-2" />
                  <p className="font-black text-xl text-delulu-green mb-2">You Won!</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Claim your rewards now
                  </p>
                  <Button
                    size="lg"
                    className="w-full h-14 bg-delulu-green hover:bg-delulu-green/90 text-white font-black text-xl rounded-xl"
                    onClick={() => {
                      setActiveAction("claim");
                      claimReward.claim(delusionId);
                    }}
                    disabled={claimReward.isPending}
                  >
                    <Trophy className="w-5 h-5 mr-2" />
                    CLAIM REWARDS
                  </Button>
                </div>
              </Card>
              {(claimReward.isPending || claimReward.isConfirming || claimReward.isSuccess || claimReward.error) && activeAction === "claim" && (
                <TransactionStatus
                  isPending={claimReward.isPending && !claimReward.isConfirming}
                  isConfirming={claimReward.isConfirming}
                  isSuccess={claimReward.isSuccess}
                  error={claimReward.error}
                  hash={claimReward.hash}
                  successMessage="Rewards claimed successfully!"
                />
              )}
            </div>
          )}

          {isFinalized && hasStake && userStake.hasClaimed && (
            <div className="text-center py-4 text-muted-foreground">
              <CheckCircle className="w-8 h-8 text-delulu-green mx-auto mb-2" />
              <p className="font-bold">Rewards Claimed</p>
            </div>
          )}

          {!isConnected && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Connect your wallet to participate</p>
            </div>
          )}
        </Card>

        {/* Creator Info */}
        <Card className="p-4 bg-muted/30 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Created by</p>
              <p className="font-mono text-sm">{delusion.creator.slice(0, 6)}...{delusion.creator.slice(-4)}</p>
            </div>
            {isCreator && (
              <Badge className="bg-delulu-yellow/10 text-delulu-yellow border-delulu-yellow/20">
                You
              </Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Withdraw Modal */}
      <ChickenOutModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onConfirm={() => {
          setActiveAction("withdraw");
          withdrawStake.withdrawStake(delusionId);
        }}
      />
    </div>
  );
}
