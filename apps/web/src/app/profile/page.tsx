"use client";
import React, { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/useUserStore";
import { useDelulus, type FormattedDelulu } from "@/hooks/use-delulus";
import { isDeluluCreator } from "@/lib/delulu-utils";
import { StakingSheet } from "@/components/staking-sheet";
import { LogoutSheet } from "@/components/logout-sheet";
import { formatAddress } from "@/lib/utils";
import { ArrowLeft, LogOut } from "lucide-react";
import { ProfileDeluluCard } from "@/components/profile-delulu-card";

export default function ProfilePage() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { user, isLoading } = useUserStore();
  const { delulus, isLoading: isLoadingDelulus } = useDelulus();
  const router = useRouter();
  const [selectedDelulu, setSelectedDelulu] = useState<FormattedDelulu | null>(null);
  const [stakingSheetOpen, setStakingSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);

  if (!isConnected) {
    return (
      <div className="border-t-2 border-gray-200 h-screen p-0 rounded-t-3xl bg-white max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="relative h-full flex flex-col items-center justify-center px-6 lg:h-auto lg:min-h-[200px]">
          <p className="text-gray-500">
            Please connect your wallet to view your profile
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto overflow-hidden">
        <div className="relative h-full flex flex-col overflow-y-auto">
          <div className="px-6 pt-4 pb-3 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="rounded-full w-12 h-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-delulu-charcoal transition-colors"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft className="h-7 w-7" />
            </button>
            <div className="flex items-center justify-center flex-1">
              <h2 className="text-sm text-gray-500">
                {isLoading ? (
                  <span className="text-gray-400">Loading...</span>
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
            <button
              onClick={() => setLogoutSheetOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
              title="Disconnect"
              aria-label="Disconnect"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>

        <div className="w-full border-t border-gray-200" />

        {address && (
          <div className="px-6 mb-6 pb-8 pt-3">
            {isLoadingDelulus ? (
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-full aspect-[4/5] bg-gray-100 rounded-xl border border-gray-200 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              (() => {
                const myDelulus = delulus.filter((d) =>
                  isDeluluCreator(address, d)
                );

                if (myDelulus.length === 0) {
                  return (
                    <p className="text-xs text-gray-400 text-center py-4">
                      You haven&apos;t created any delulus yet
                    </p>
                  );
                }

                return (
                  <div className="grid grid-cols-2 gap-2">
                    {myDelulus.map((delulu) => (
                      <ProfileDeluluCard
                        key={delulu.id}
                        delusion={delulu}
                        onClick={() => {
                          router.push(`/delulu/${delulu.id}`);
                        }}
                        onStake={() => {
                          setSelectedDelulu(delulu);
                          setStakingSheetOpen(true);
                        }}
                      />
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        )}
        </div>
      </div>

      <StakingSheet
        open={stakingSheetOpen}
        onOpenChange={setStakingSheetOpen}
        delulu={selectedDelulu}
      />

      <LogoutSheet
        open={logoutSheetOpen}
        onOpenChange={setLogoutSheetOpen}
        onLogout={() => {
          disconnect();
          useUserStore.getState().logout();
          setLogoutSheetOpen(false);
        }}
      />
    </div>
  );
}
