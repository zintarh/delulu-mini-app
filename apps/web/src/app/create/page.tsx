"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { LoginScreen } from "@/components/login-screen";
import { CreateDelusionSheet } from "@/components/create-delusion-sheet";
import { Navbar } from "@/components/navbar";
import { useResponsiveNavigation } from "@/hooks/use-responsive-navigation";
import { useEffect, useState } from "react";

export default function CreatePage() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { isMobile } = useResponsiveNavigation();
  const [isOpen, setIsOpen] = useState(true);

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
        onCreateClick={() => router.push("/create")}
      />
      <main className="max-w-lg md:max-w-5xl mx-auto pt-4 md:pt-8 pb-8">
        <div className="px-4 md:px-8">
          <CreateDelusionSheet 
            open={isOpen} 
            onOpenChange={(open) => {
              if (!open) {
                router.push("/");
              }
            }} 
          />
        </div>
      </main>
    </div>
  );
}

