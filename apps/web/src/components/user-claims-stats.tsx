"use client";

import { useUserClaims } from "@/hooks/use-user-claims";
import { Trophy, Sparkles } from "lucide-react";

interface UserClaimsStatsProps {
  address: string | undefined;
}

export function UserClaimsStats({ address }: UserClaimsStatsProps) {
  const { totalClaimed, isLoading } = useUserClaims(address);

  if (!address) return null;

  return (
    <div className="px-6 py-6 border-b border-gray-200">
      <div className="rounded-xl border-2 border-delulu-charcoal bg-gradient-to-br from-delulu-yellow-reserved/20 via-delulu-yellow-reserved/10 to-white p-5 shadow-[2px_2px_0px_0px_#1A1A1A]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-delulu-yellow-reserved border-2 border-delulu-charcoal flex items-center justify-center shadow-[2px_2px_0px_0px_#1A1A1A]">
                <Trophy className="w-8 h-8 text-delulu-charcoal" />
              </div>
              
            </div>
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                Total Claimed
              </p>
              {isLoading ? (
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-delulu-charcoal leading-none">
                    {totalClaimed > 0
                      ? totalClaimed < 0.01
                        ? totalClaimed.toFixed(4)
                        : totalClaimed.toFixed(2)
                      : "0.00"}
                  </p>
                  <span className="text-sm font-bold text-gray-600">cUSD</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

