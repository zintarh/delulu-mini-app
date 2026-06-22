"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeDashboard } from "@/components/home-dashboard";
import { MainPage } from "@/components/main-app-header";
import { useAuth } from "@/hooks/use-auth";
import { useNavigateToCreate } from "@/hooks/use-navigate-to-create";
import { useUserStore } from "@/stores/useUserStore";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";

export default function HomePage() {
  const router = useRouter();
  const { address } = useAuth();
  const { navigateToCreate } = useNavigateToCreate();
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
    <MainPage>
      <div className="mx-auto w-full max-w-2xl xl:max-w-3xl lg:pt-6">
        <HomeDashboard onCreateClick={() => void navigateToCreate()} />
      </div>
    </MainPage>
  );
}
