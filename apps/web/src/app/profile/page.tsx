"use client";

import { useAccount } from "wagmi";
import { Navbar } from "@/components/navbar";
import { ConnectedAccount } from "@/components/wallet";
import { useUserStore } from "@/stores/useUserStore";

export default function ProfilePage() {
  const { isConnected } = useAccount();
  const { user, isLoading } = useUserStore();

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-6 pt-8 text-center">
          <p className="text-white/50">
            Please connect your wallet to view your profile
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-6 pt-4 md:pt-8 pb-24">
        <div className="mb-6">
          <div className="bg-gray-900 rounded-3xl p-6 mb-4">
            {isLoading ? (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-24" />
                </div>
              </div>
            ) : user ? (
              <div className="flex items-center gap-4">
                {user.pfpUrl ? (
                  <img
                    src={user.pfpUrl}
                    alt={user.displayName || user.username || "Profile"}
                    className="w-16 h-16 rounded-full object-cover border-2 border-black"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center border-2 border-black">
                    <span className="text-2xl font-black text-delulu-dark">
                      {(user.displayName || user.username || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-black text-white">
                    {user.displayName || user.username || "Anonymous"}
                  </h2>
                  {user.username && (
                    <p className="text-sm text-white/60">@{user.username}</p>
                  )}
                  {user.fid && (
                    <p className="text-xs text-white/40 mt-1">
                      FID: {user.fid}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-white/50">
                  No Farcaster user data available
                </p>
              </div>
            )}
          </div>
          <ConnectedAccount />
        </div>
      </main>
    </div>
  );
}
