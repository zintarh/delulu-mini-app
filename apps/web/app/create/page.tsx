"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { DollarSign, Flame, ShieldCheck } from "lucide-react"
import { useCreateDelusion } from "@/lib/hooks/use-delulu-contract"
import { useCheckAndApproveCUSD, parseCUSD, useCUSDBalance } from "@/lib/hooks/use-cusd-approval"
import { TransactionStatus, ApprovalFlow } from "@/components/transaction-status"

export default function CreatePage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const [stakeAmount, setStakeAmount] = useState([100])
  const [delusionText, setDelusionText] = useState("")
  const { balance, balanceFormatted } = useCUSDBalance()
  
  const getDefaultDeadline = () => {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return date.toISOString().slice(0, 16)
  }
  
  const getMinDeadline = () => {
    const date = new Date()
    date.setHours(date.getHours() + 24)
    return date.toISOString().slice(0, 16)
  }

  const [deadline, setDeadline] = useState(getDefaultDeadline())

  const stakeAmountBigInt = parseCUSD(stakeAmount[0].toString())
  
  const approval = useCheckAndApproveCUSD(stakeAmountBigInt)
  
  const creation = useCreateDelusion((hash) => {
    setTimeout(() => router.push("/"), 2000)
  })

  const handleCreate = () => {
    if (!delusionText.trim()) {
      alert("Please enter your delusion text")
      return
    }
    
    const deadlineTimestamp = BigInt(Math.floor(new Date(deadline).getTime() / 1000))
    
    creation.createDelusion(
      delusionText,
      deadlineTimestamp,
      stakeAmountBigInt,
      true 
    )
  }

  const hasInsufficientBalance = balance !== undefined && balance < stakeAmountBigInt
  const canCreate = !approval.needsApproval && !hasInsufficientBalance

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Create Delusion" />

      <div className="w-full max-w-5xl mx-auto px-6 space-y-6 mt-6">
        <Card className="p-6 bg-card border border-delulu-yellow/30">
          <Input
            placeholder="I will run 5k by Sunday..."
            value={delusionText}
            onChange={(e) => setDelusionText(e.target.value)}
            className="mb-6 h-14 text-lg bg-background border border-border rounded-2xl placeholder:text-muted-foreground/50 font-medium"
          />

          <div className="mb-6">
            <label className="block text-sm font-bold mb-3">Deadline</label>
            <Input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={getMinDeadline()}
              className="h-14 text-lg bg-background border border-border rounded-2xl font-medium"
            />
            <p className="text-xs text-muted-foreground mt-2 font-medium">
              Minimum: 24 hours from now
            </p>
          </div>

          <div className="mb-8 p-4 bg-delulu-yellow/5 border border-delulu-yellow/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-delulu-yellow/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-delulu-yellow" />
              </div>
              <div>
                <p className="font-bold text-sm">Your Position: BELIEVE</p>
                <p className="text-xs text-muted-foreground">As the creator, you believe in your delusion</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <label className="font-black text-sm">Stake Amount</label>
              <div className="flex items-center gap-2 bg-delulu-yellow/10 px-4 py-2 rounded-full border border-delulu-yellow/20">
                <DollarSign className="w-4 h-4 text-delulu-yellow" />
                <span className="font-black text-xl text-delulu-yellow">{stakeAmount[0]}</span>
                <span className="text-xs text-muted-foreground font-medium">cUSD</span>
              </div>
            </div>
            <Slider
              value={stakeAmount}
              onValueChange={setStakeAmount}
              min={5}
              max={500}
              step={5}
              className="delulu-slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2 font-medium">
              <span>$5</span>
              <span>$500</span>
            </div>
          </div>

          {/* cUSD Balance Display */}
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Your cUSD Balance:</span>
              <span className="font-bold">{balanceFormatted} cUSD</span>
            </div>
            {hasInsufficientBalance && (
              <p className="text-xs text-red-500 mt-1 font-medium">Insufficient balance!</p>
            )}
          </div>

          {/* Approval Flow */}
          {approval.needsApproval && (
            <div className="mb-4">
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
            </div>
          )}

          {/* Create Button */}
          <Button
            size="lg"
            className="w-full h-16 bg-delulu-yellow hover:bg-delulu-yellow/90 text-delulu-dark font-black text-xl rounded-2xl shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleCreate}
            disabled={!isConnected || !canCreate || creation.isPending || hasInsufficientBalance}
          >
            {creation.isPending ? (
              <>
                <Flame className="w-6 h-6 mr-2 animate-pulse" />
                CREATING...
              </>
            ) : (
              <>
                <Flame className="w-6 h-6 mr-2" />
                CREATE DELUSION
              </>
            )}
          </Button>

          {/* Transaction Status */}
          {(creation.isPending || creation.isConfirming || creation.isSuccess || creation.error) && (
            <div className="mt-4">
              <TransactionStatus
                isPending={creation.isPending && !creation.isConfirming}
                isConfirming={creation.isConfirming}
                isSuccess={creation.isSuccess}
                error={creation.error}
                hash={creation.hash}
                successMessage="Delusion created successfully! Redirecting..."
                errorMessage="Failed to create delusion"
              />
            </div>
          )}

          {!isConnected && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground font-medium">Please connect your wallet to create a delusion</p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Powered by</span>
            <span className="font-bold text-delulu-yellow">Celo</span>
            {approval.hasInfiniteApproval && (
              <Badge className="ml-2 bg-delulu-green/10 text-delulu-green border-delulu-green/20 text-[10px]">
                Approved ✓
              </Badge>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

