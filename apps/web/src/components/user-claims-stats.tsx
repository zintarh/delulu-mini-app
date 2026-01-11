"use client";

import { useUserClaims } from "@/hooks/use-user-claims";
import { Trophy } from "lucide-react";

interface UserClaimsStatsProps {
  address: string | undefined;
}

export function UserClaimsStats({ address }: UserClaimsStatsProps) {
  const { totalClaimed, isLoading } = useUserClaims(address);

  if (!address) return null;

  return (
    <div className="px-6 py-4 bg-gradient-to-r from-delulu-green/10 to-delulu-green/5 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-delulu-green/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-delulu-green" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Total Claimed
            </p>
            {isLoading ? (
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-black text-delulu-charcoal leading-none mt-1">
                {totalClaimed > 0
                  ? totalClaimed < 0.01
                    ? totalClaimed.toFixed(4)
                    : totalClaimed.toFixed(2)
                  : "0.00"}{" "}
                <span className="text-sm text-gray-500 font-normal">cUSD</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

