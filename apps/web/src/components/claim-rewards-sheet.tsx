"use client";

import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { useUserStore } from "@/stores/useUserStore";
import { useAccount } from "wagmi";
import { formatAddress } from "@/lib/utils";
import { useUserStats } from "@/hooks/use-user-stats";

interface ClaimRewardsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClaimRewardsSheet({ open, onOpenChange }: ClaimRewardsSheetProps) {
  const { user } = useUserStore();
  const { address } = useAccount();
  const { totalClaimed, isLoading: isLoadingStats } = useUserStats();

  const displayName = user?.username 
    ? `@${user.username}` 
    : user?.displayName 
    ? user.displayName 
    : address 
    ? formatAddress(address)
    : "User";

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Claim Rewards"
      sheetClassName="border-t border-white/10 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl bg-black"
      modalClassName="max-w-lg"
    >
      <div className="max-w-lg mx-auto pt-8 px-6 lg:pt-6">
          {/* Username/Address */}
          <div className="text-center mb-4">
            <h2 className="text-sm text-white/60">
              {displayName}
            </h2>
          </div>
        </div>
        
        {/* Divider - Full Width */}
        <div className="w-full border-t border-white/10 my-6" />
        
        <div className="max-w-lg mx-auto px-6 pb-8">
          {/* Rewards Amount */}
          <div className="mb-6">
            <div className="bg-black rounded-2xl p-6 border border-white/10">
              <p className="text-xs text-white/60 mb-2 text-center">Total Rewards</p>
              <p className="text-3xl font-black text-white text-center">
                {isLoadingStats ? "..." : `$${(totalClaimed ?? 0).toFixed(2)}`}
              </p>
              <p className="text-xs text-white/40 mt-2 text-center">Available to claim</p>
            </div>
          </div>

          {/* Claim Button */}
          <button
            onClick={() => {
              // TODO: Implement claim rewards functionality
              console.log("Claim rewards");
            }}
            className="w-full py-3 font-bold text-sm rounded-md border-2 border-black shadow-[3px_3px_0px_0px_#000000] bg-black text-delulu-dark"
          >
            Claim Rewards
          </button>
      </div>
    </ResponsiveSheet>
  );
}

