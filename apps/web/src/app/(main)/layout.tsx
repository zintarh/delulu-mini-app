"use client";

import { LeftSidebar } from "@/components/left-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { NotificationsPanel } from "@/components/notifications-panel";
import { ClaimPanel } from "@/components/claim-panel";
import { WhitelistRedirectToast } from "@/components/whitelist-redirect-toast";
import { RightPanelProvider } from "@/contexts/right-panel-context";
import { LogoutSheetProvider } from "@/contexts/logout-sheet-context";
import { prefetchCreateManifestStep } from "@/components/create-delusion-content";
import { useAuth } from "@/hooks/use-auth";
import { useRequireGoodDollarWhitelist } from "@/hooks/use-require-gooddollar-whitelist";
import { useRouter } from "next/navigation";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <RightPanelProvider>
      <MainLayoutShell>{children}</MainLayoutShell>
    </RightPanelProvider>
  );
}

function MainLayoutShell({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();
  const { ensureWhitelisted } = useRequireGoodDollarWhitelist();
  const router = useRouter();

  const handleProfileClick = () => {
    if (!authenticated) router.push("/sign-in");
    else router.push("/profile");
  };

  const handleCreateClick = async () => {
    if (!authenticated) {
      router.push("/sign-in?redirect=%2Fboard");
      return;
    }
    const allowed = await ensureWhitelisted("create");
    if (!allowed) return;
    void import("@/components/create-delusion-content");
    prefetchCreateManifestStep();
    router.push("/board");
  };

  return (
      <LogoutSheetProvider>
      <div className="h-screen overflow-hidden">
        <div className="hidden lg:block fixed inset-y-0 left-0 z-30 w-24">
          <LeftSidebar />
        </div>

        <div className="flex h-screen lg:pl-24">
          <NotificationsPanel />
          <ClaimPanel />
          <WhitelistRedirectToast />

          <div className="flex-1 min-w-0 h-full overflow-hidden transition-[flex] duration-300 ease-out">
            {children}
          </div>
        </div>

        <BottomNav
          onProfileClick={handleProfileClick}
          onCreateClick={handleCreateClick}
        />
      </div>
      </LogoutSheetProvider>
  );
}
