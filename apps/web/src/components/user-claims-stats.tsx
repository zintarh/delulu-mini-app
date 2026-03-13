"use client";

import { useGraphUserClaims } from "@/hooks/graph";
import { Trophy } from "lucide-react";

interface UserClaimsStatsProps {
  address: string | undefined;
}

export function UserClaimsStats({ address }: UserClaimsStatsProps) {
  const { totalClaimed, isLoading } = useGraphUserClaims(address);

  if (!address) return null;

  return (
    <div className="flex items-center gap-1">
      <Trophy className="w-3.5 h-3.5 text-delulu-yellow-reserved" />
              {isLoading ? (
        <span className="text-sm text-muted-foreground">...</span>
              ) : (
        <span className="text-sm font-semibold text-foreground">
                    {totalClaimed > 0
                      ? totalClaimed < 0.01
                        ? totalClaimed.toFixed(4)
                        : totalClaimed.toFixed(2)
            : "0.00"}{" "}
          <span className="text-muted-foreground font-normal">claimed</span>
        </span>
              )}
    </div>
  );
}

