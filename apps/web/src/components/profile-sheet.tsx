"use client";

import { useAccount } from "wagmi";
import { useUserStore } from "@/stores/useUserStore";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDelulus } from "@/hooks/use-delulus";
import { isDeluluCreator } from "@/lib/delulu-utils";
import { ProfileDeluluItem } from "@/components/profile-delulu-item";
import { StakedDeluluItem } from "@/components/staked-delulu-item";
import { formatAddress } from "@/lib/utils";

interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
  const { isConnected, address } = useAccount();
  const { user, isLoading } = useUserStore();
  const { delulus, isLoading: isLoadingDelulus } = useDelulus();

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!isConnected) {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent 
          side="bottom" 
          className="bg-delulu-dark border-t-2 border-delulu-dark/20 h-screen max-h-screen overflow-hidden p-0 rounded-t-3xl"
        >
          <SheetTitle className="sr-only">Profile</SheetTitle>
          <div className="relative h-full flex flex-col items-center justify-center px-6">
            <p className="text-white/50">
              Please connect your wallet to view your profile
            </p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent 
        side="bottom" 
        className="bg-delulu-dark border-t-2 border-delulu-dark/20 h-screen max-h-screen overflow-hidden p-0 rounded-none"
      >
        <SheetTitle className="sr-only">Profile</SheetTitle>
        <div className="relative h-full flex flex-col overflow-y-auto">
          <div className="px-6 pt-4 pb-3">
            <div className="flex items-center justify-center relative">
              <h2 className="text-sm text-white/60">
                {isLoading ? (
                  <span className="text-white/50">Loading...</span>
                ) : user?.username ? (
                  `@${user.username}`
                ) : user?.displayName ? (
                  user.displayName
                ) : address ? (
                  formatAddress(address)
                ) : (
                  "User"
                )}
              </h2>
            </div>
          </div>
          
          {/* Divider - Full Width */}
          <div className="w-full border-t border-white/10" />
          
          {address && (
            <div className="px-6 mb-6 pt-3">
              <h3 className="text-sm font-bold text-white/90 mb-3">Ending Soon</h3>
              {isLoadingDelulus ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/10 animate-pulse">
                      <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-white/10 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                (() => {
                  const endingSoonDelulus = delulus.filter((d) => {
                    const now = new Date();
                    const deadline = d.stakingDeadline;
                    const diff = deadline.getTime() - now.getTime();
                    const hours = diff / (1000 * 60 * 60);
                    return hours > 0 && hours <= 24 && !isDeluluCreator(address, d);
                  }).sort((a, b) => Number(b.id) - Number(a.id));

                  if (endingSoonDelulus.length === 0) {
                    return (
                      <p className="text-xs text-white/50 text-center py-4">
                        No delulus ending soon
                      </p>
                    );
                  }

                  return endingSoonDelulus.map((delulu) => (
                    <StakedDeluluItem key={delulu.id} delulu={delulu} />
                  ));
                })()
              )}
            </div>
          )}

          {/* Delulus User Created */}
          {address && (
            <div className="px-6 mb-6 pb-8">
              <h3 className="text-sm font-bold text-white/90 mb-3">My Delulus</h3>
              {isLoadingDelulus ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/10 animate-pulse">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-4 bg-white/10 rounded w-1/2" />
                        <div className="h-6 w-6 rounded-full bg-white/10" />
                      </div>
                      <div className="h-3 bg-white/10 rounded w-3/4" />
                    </div>
                  ))}
                </div>
              ) : (
                (() => {
                  const myDelulus = delulus.filter((d) => isDeluluCreator(address, d)).sort((a, b) => Number(b.id) - Number(a.id));

                  if (myDelulus.length === 0) {
                    return (
                      <p className="text-xs text-white/50 text-center py-4">
                        You haven&apos;t created any delulus yet
                      </p>
                    );
                  }

                  return myDelulus.map((delulu) => (
                    <ProfileDeluluItem
                      key={delulu.id}
                      delulu={delulu}
                      isCreator={true}
                      onCancel={() => {
                        // TODO: Implement cancel delulu
                        console.log("Cancel delulu", delulu.id);
                      }}
                    />
                  ));
                })()
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

