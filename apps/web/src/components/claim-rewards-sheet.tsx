"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
  const { totalEarnings, isLoading: isLoadingStats } = useUserStats();

  const displayName = user?.username 
    ? `@${user.username}` 
    : user?.displayName 
    ? user.displayName 
    : address 
    ? formatAddress(address)
    : "User";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-delulu-dark border-t border-white/10 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
      >
        <SheetTitle className="sr-only">Claim Rewards</SheetTitle>
        <div className="max-w-lg mx-auto pt-8 px-6">
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
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <p className="text-xs text-white/60 mb-2 text-center">Total Rewards</p>
              <p className="text-3xl font-black text-white/90 text-center">
                {isLoadingStats ? "..." : `$${totalEarnings.toFixed(2)}`}
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
            className="w-full py-3 font-bold text-sm bg-white text-delulu-dark btn-game"
          >
            Claim Rewards
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

