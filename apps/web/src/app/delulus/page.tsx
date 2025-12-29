"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { LoginScreen } from "@/components/login-screen";
import { AllDelulusContent } from "@/components/all-delulus-content";
import { Navbar } from "@/components/navbar";
import { useDelulus } from "@/hooks/use-delulus";
import { useResponsiveNavigation } from "@/hooks/use-responsive-navigation";
import { useEffect } from "react";

export default function AllDelulusPage() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { isMobile } = useResponsiveNavigation();
  const { delulus, isLoading } = useDelulus();

  // On mobile, redirect to home where sheet will be used
  useEffect(() => {
    if (isMobile) {
      router.push("/");
    }
  }, [isMobile, router]);

  // Show login screen if not connected
  if (!isConnected) {
    return <LoginScreen />;
  }

  // On mobile, don't render (will redirect)
  if (isMobile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-home-gradient">
      <Navbar 
        onProfileClick={() => router.push("/profile")} 
        onLogoutClick={() => {}}
      />
      <main className="max-w-lg md:max-w-7xl mx-auto pt-4 md:pt-8 pb-8">
        <div className="px-4 md:px-8">
          <AllDelulusContent 
            delulus={delulus}
            isLoading={isLoading}
            onDeluluClick={(delulu) => router.push(`/delulu/${delulu.id}`)}
          />
        </div>
      </main>
    </div>
  );
}
