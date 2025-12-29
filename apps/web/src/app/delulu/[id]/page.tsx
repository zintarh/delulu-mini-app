"use client";

import { useAccount } from "wagmi";
import { useRouter, useParams } from "next/navigation";
import { LoginScreen } from "@/components/login-screen";
import { DeluluDetailsSheet } from "@/components/delulu-details-sheet";
import { Navbar } from "@/components/navbar";
import { useDelulus } from "@/hooks/use-delulus";
import { BelieveSheet } from "@/components/believe-sheet";
import { DoubtSheet } from "@/components/doubt-sheet";
import { useState, useEffect } from "react";
import { useResponsiveNavigation } from "@/hooks/use-responsive-navigation";

export default function DeluluDetailsPage() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const params = useParams();
  const { delulus } = useDelulus();
  const { isMobile } = useResponsiveNavigation();
  const [believeSheetOpen, setBelieveSheetOpen] = useState(false);
  const [doubtSheetOpen, setDoubtSheetOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const deluluId = params?.id ? Number(params.id) : null;
  const delulu = delulus.find((d) => d.id === deluluId) || null;

  // On mobile, redirect to home where sheet will be used
  useEffect(() => {
    if (isMobile && delulu) {
      router.push("/");
    }
  }, [isMobile, router, delulu]);

  // Show login screen if not connected
  if (!isConnected) {
    return <LoginScreen />;
  }

  // If delulu not found, redirect to home
  if (!delulu && deluluId) {
    router.push("/");
    return null;
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
      <main className="max-w-lg md:max-w-5xl mx-auto pt-4 md:pt-8 pb-8">
        <div className="px-4 md:px-8">
          {delulu && (
            <DeluluDetailsSheet
              open={isOpen}
              onOpenChange={(open) => {
                if (!open) {
                  router.push("/");
                }
              }}
              delulu={delulu}
              onBelieve={() => setBelieveSheetOpen(true)}
              onDoubt={() => setDoubtSheetOpen(true)}
            />
          )}
        </div>
      </main>

      <BelieveSheet
        open={believeSheetOpen}
        onOpenChange={setBelieveSheetOpen}
        delulu={delulu}
      />
      <DoubtSheet
        open={doubtSheetOpen}
        onOpenChange={setDoubtSheetOpen}
        delulu={delulu}
      />
    </div>
  );
}
