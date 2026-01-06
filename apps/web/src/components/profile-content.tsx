"use client";

import { useAccount } from "wagmi";
import { useUserStore } from "@/stores/useUserStore";
import { useDelulus } from "@/hooks/use-delulus";
import { isDeluluCreator } from "@/lib/delulu-utils";
import { ProfileDeluluItem } from "@/components/profile-delulu-item";
import { StakedDeluluItem } from "@/components/staked-delulu-item";
import { formatAddress } from "@/lib/utils";

export function ProfileContent() {
  const { isConnected, address } = useAccount();
  const { user, isLoading } = useUserStore();
  const { delulus, isLoading: isLoadingDelulus } = useDelulus();

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-8 text-center">
        <p className="text-white/50">
          Please connect your wallet to view your profile
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg md:max-w-4xl mx-auto">
      <div className="px-6 md:px-8 pt-4 md:pt-6 pb-3">
        <div className="flex items-center justify-center relative">
          <h2 className="text-sm md:text-base text-white/60">
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
        <div className="px-6 md:px-8 mb-6 pt-3">
          <h3 className="text-sm md:text-base font-bold text-white mb-3">Ending Soon</h3>
          {isLoadingDelulus ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-black rounded-2xl p-4 border border-white/10 animate-pulse">
                  <div className="h-4 bg-black/80 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-black/80 rounded w-1/2" />
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
        <div className="px-6 md:px-8 mb-6 pb-8">
          <h3 className="text-sm md:text-base font-bold text-white mb-3">My Delulus</h3>
          {isLoadingDelulus ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-black rounded-2xl p-4 border border-white/10 animate-pulse">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-4 bg-black/80 rounded w-1/2" />
                    <div className="h-6 w-6 rounded-full bg-black/80" />
                  </div>
                  <div className="h-3 bg-black/80 rounded w-3/4" />
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
  );
}

