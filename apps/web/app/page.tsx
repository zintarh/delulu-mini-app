"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DelusionCard } from "@/components/delusion-card"
import { UserHeader } from "@/components/user-header"
import {
  Plus,
  TrendingUp,
  Loader2,
} from "lucide-react"
import { farcasterUser } from "@/lib/mock-data"
import { useGetAllDelusions, useGetDelusion } from "@/lib/hooks/use-delulu-contract"
import { formatUnits } from "viem"

function DelusionItem({ delusionId, onClick }: { delusionId: bigint; onClick: () => void }) {
  const { delusion, isLoading, error } = useGetDelusion(delusionId);

  console.log("DelusionItem:", {
    delusionId: delusionId.toString(),
    isLoading,
    hasDelusion: !!delusion,
    delusion,
    error: error?.message,
  });

  if (isLoading) {
    console.log("Still loading delusion:", delusionId.toString());
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-20 bg-muted rounded" />
      </Card>
    );
  }

  if (error) {
    console.error("Error loading delusion:", delusionId.toString(), error);
    return (
      <Card className="p-4 border-red-500">
        <p className="text-red-500 text-sm">Failed to load delusion #{delusionId.toString()}</p>
      </Card>
    );
  }

  if (!delusion) {
    console.log("No delusion data for:", delusionId.toString());
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-20 bg-muted rounded" />
      </Card>
    );
  }

  // Calculate believers and haters (in cUSD)
  const believers = Number(formatUnits(delusion.believePool, 18));
  const haters = Number(formatUnits(delusion.doubtPool, 18));

  // Calculate time remaining
  const deadline = new Date(Number(delusion.deadline) * 1000);
  const now = new Date();
  const timeRemaining = deadline.getTime() - now.getTime();
  
  let timeLeft = "";
  if (timeRemaining <= 0) {
    timeLeft = "Expired";
  } else {
    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) {
      timeLeft = `${days}d ${hours}h`;
    } else {
      timeLeft = `${hours}h`;
    }
  }

  return (
    <DelusionCard
      id={delusionId.toString()}
      claim={delusion.description}
      believers={believers}
      haters={haters}
      timeLeft={timeLeft}
      creator={delusion.creator.slice(0, 6) + "..." + delusion.creator.slice(-4)}
      onClick={onClick}
    />
  );
}

export default function HomePage() {
  const router = useRouter()
  const [isVerified, setIsVerified] = useState(false)
  const [filterByUser, setFilterByUser] = useState<string | null>(null);
  const { delusionIds, totalDelusions, isLoadingCounter } = useGetAllDelusions();

  console.log("HomePage state:", {
    isLoadingCounter,
    totalDelusions,
    delusionIdsCount: delusionIds.length,
    delusionIds: delusionIds.map(id => id.toString()),
    filterByUser,
  });

  return (
    <div className="min-h-screen bg-background pb-8">
      <UserHeader 
        username={farcasterUser.username} 
        pfp={farcasterUser.pfp}
        address={farcasterUser.address}
      />

      <div className="w-full max-w-5xl mx-auto px-6 space-y-4 mt-6">
        <Button
          size="lg"
          className="w-full h-16 bg-delulu-yellow hover:bg-delulu-yellow/90 text-delulu-dark font-black text-lg rounded-2xl shadow-lg hover:scale-[1.02] transition-all"
          onClick={() => router.push("/create")}
        >
          <Plus className="w-6 h-6 mr-2" />
          CREATE DELUSION
        </Button>

        <div className="space-y-2.5 mt-8">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-delulu-yellow" />
            <h2 className="font-black text-lg">Active Delusions</h2>
            {totalDelusions > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {totalDelusions}
              </Badge>
            )}
          </div>

          {isLoadingCounter ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-delulu-yellow" />
            </div>
          ) : totalDelusions === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No delusions yet. Be the first to create one!
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {[...delusionIds].reverse().map((id) => (
                <DelusionItem
                  key={id.toString()}
                  delusionId={id}
                  onClick={() => router.push(`/delusion/${id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
