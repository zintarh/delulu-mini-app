"use client";

import dynamic from "next/dynamic";
import { ProfileLoader } from "@/components/profile-loader";
import { RightPanelProvider } from "@/contexts/right-panel-context";
import { LogoutSheetProvider } from "@/contexts/logout-sheet-context";
import { useAuth } from "@/hooks/use-auth";
import { useNavigateToCreate } from "@/hooks/use-navigate-to-create";
import { useRouter } from "next/navigation";
import { preloadAuthProviders } from "@/lib/auth-session-hint";

const LeftSidebar = dynamic(
  () => import("@/components/left-sidebar").then((m) => m.LeftSidebar),
  { ssr: false, loading: () => <div className="hidden lg:block fixed inset-y-0 left-0 z-30 w-24" /> },
);
const BottomNav = dynamic(
  () => import("@/components/bottom-nav").then((m) => m.BottomNav),
  { ssr: false, loading: () => <div className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-border bg-background/95 lg:hidden" /> },
);
const ClaimPanel = dynamic(
  () => import("@/components/claim-panel").then((m) => m.ClaimPanel),
  { ssr: false },
);
const WhitelistRedirectToast = dynamic(
  () =>
    import("@/components/whitelist-redirect-toast").then(
      (m) => m.WhitelistRedirectToast,
    ),
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
  const { navigateToCreate } = useNavigateToCreate();
  const router = useRouter();

  const handleProfileClick = () => {
    if (!authenticated) {
      preloadAuthProviders();
      router.push("/sign-in");
    }
    else router.push("/profile");
  };

  return (
      <LogoutSheetProvider>
      <div className="h-screen overflow-hidden">
        <div className="hidden lg:block fixed inset-y-0 left-0 z-30 w-24">
          <LeftSidebar onCreateClick={navigateToCreate} />
        </div>

        <div className="flex h-screen lg:pl-24">
          <ProfileLoader />
          <NotificationsPanel />
          <ClaimPanel />
          <WhitelistRedirectToast />

          <div className="flex-1 min-w-0 h-full overflow-hidden transition-[flex] duration-300 ease-out">
            {children}
          </div>
        </div>

        <BottomNav
          onProfileClick={handleProfileClick}
          onCreateClick={navigateToCreate}
        />
      </div>
      </LogoutSheetProvider>
  );
}
