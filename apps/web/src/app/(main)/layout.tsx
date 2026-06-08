"use client";
// minipay build

import dynamic from "next/dynamic";
import { ProfileLoader } from "@/components/profile-loader";
import { MiniPayConnect } from "@/components/minipay-connect";
import { RightPanelProvider } from "@/contexts/right-panel-context";
import { LogoutSheetProvider } from "@/contexts/logout-sheet-context";
import { prefetchCreateManifestStep, prefetchCreateDelusionContent } from "@/lib/prefetch-create-manifest";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

const LeftSidebar = dynamic(
  () => import("@/components/left-sidebar").then((m) => m.LeftSidebar),
  { ssr: false, loading: () => <div className="hidden lg:block fixed inset-y-0 left-0 z-30 w-24" /> },
);
const BottomNav = dynamic(
  () => import("@/components/bottom-nav").then((m) => m.BottomNav),
  { ssr: false },
);
const NotificationsPanel = dynamic(
  () =>
    import("@/components/notifications-panel").then(
      (m) => m.NotificationsPanel,
    ),
  { ssr: false },
);

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <RightPanelProvider>
      <MainLayoutShell>{children}</MainLayoutShell>
    </RightPanelProvider>
  );
}

function MainLayoutShell({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();
  const router = useRouter();

  const handleProfileClick = () => {
    if (!authenticated) router.push("/sign-in");
    else router.push("/profile");
  };

  const handleCreateClick = () => {
    if (!authenticated) {
      router.push("/sign-in?redirect=%2Fboard");
      return;
    }
    prefetchCreateDelusionContent();
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
          <MiniPayConnect />
          <ProfileLoader />
          {authenticated ? <NotificationsPanel /> : null}

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
