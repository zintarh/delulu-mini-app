"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";
import { HomeDashboard } from "@/components/home-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { useUserStore } from "@/stores/useUserStore";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";

export default function HomePage() {
  const router = useRouter();
  const { address } = useAuth();
  const { updateUsername, updateAddress, user } = useUserStore();

  const { username: onChainUsername } = useUsernameByAddress(
    address as `0x${string}` | undefined,
  );

  useEffect(() => {
    if (address && onChainUsername && onChainUsername !== user?.username) {
      updateUsername(onChainUsername, user?.email);
    }
    if (address && address !== user?.address) {
      updateAddress(address);
    }
  }, [
    address,
    onChainUsername,
    user?.username,
    user?.email,
    user?.address,
    updateUsername,
    updateAddress,
  ]);

  return (
    <main className="h-screen overflow-y-auto scrollbar-hide bg-background">
      <div className="lg:hidden">
        <Navbar />
      </div>

      <div className="hidden lg:block sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-6 py-4">
          <p
            className="text-lg font-black text-foreground"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            Home
          </p>
          <NavbarProfileMenu />
        </div>
      </div>

      <div className="mx-auto w-full pb-24 pt-[4.5rem] lg:max-w-lg lg:pb-12 lg:pt-8">
        <HomeDashboard
          onCreateClick={() => router.push("/board")}
        />
      </div>
    </main>
  );
}
