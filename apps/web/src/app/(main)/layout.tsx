"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ProfileLoader } from "@/components/profile-loader";
import {
  MainAppContent,
  MainAppHeader,
  MobileBottomNavSpacer,
} from "@/components/main-app-header";
import { RightPanelProvider } from "@/contexts/right-panel-context";
import { LogoutSheetProvider } from "@/contexts/logout-sheet-context";
import { OnboardingGiftProvider } from "@/contexts/onboarding-gift-context";
import { useAuth } from "@/hooks/use-auth";
import { useIdentity } from "@/hooks/identityHook";
import { useRouter } from "next/navigation";
import { preloadAuthProviders } from "@/lib/auth-session-hint";

const LeftSidebar = dynamic(
  () => import("@/components/left-sidebar").then((m) => m.LeftSidebar),
  { ssr: false, loading: () => <div className="hidden lg:block fixed inset-y-0 left-0 z-30 w-24" /> },
);
const BottomNav = dynamic(
  () => import("@/components/bottom-nav").then((m) => m.BottomNav),
  {
    ssr: false,
    loading: () => (
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 shadow-[0_-6px_20px_rgba(26,26,25,0.06)] lg:hidden"
        style={{ height: "var(--mobile-bottom-nav-bar)" }}
        aria-hidden
      />
    ),
  },
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
const AppToast = dynamic(
  () => import("@/components/app-toast").then((m) => m.AppToast),
  { ssr: false },
);
const NoGasBanner = dynamic(
  () => import("@/components/no-gas-banner").then((m) => m.NoGasBanner),
  { ssr: false },
);
const EnableNotificationsBanner = dynamic(
  () =>
    import("@/components/enable-notifications-banner").then(
      (m) => m.EnableNotificationsBanner,
    ),
  { ssr: false },
);
const RewardsClaimBanner = dynamic(
  () =>
    import("@/components/rewards-claim-banner").then(
      (m) => m.RewardsClaimBanner,
    ),
  { ssr: false },
);
const OnboardingGiftModal = dynamic(
  () =>
    import("@/components/onboarding-gift-modal").then(
      (m) => m.OnboardingGiftModal,
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
    <OnboardingGiftProvider>
      <RightPanelProvider>
        <OnboardingGate>
          <MainLayoutShell>{children}</MainLayoutShell>
        </OnboardingGate>
      </RightPanelProvider>
    </OnboardingGiftProvider>
  );
}

/**
 * Blocks the entire main app behind full onboarding — an authenticated
 * wallet address alone isn't enough. usePostAuthRoute only decides where a
 * *fresh* sign-in lands; nothing stopped an authenticated-but-incomplete
 * session from reaching any (main) page directly (deep link, stale
 * bookmark, back button). Sends anyone who isn't fully set up back to
 * /sign-in, which re-runs that same routing logic (verify → welcome) to
 * finish the job. Unauthenticated visitors pass through untouched — this
 * only gates people who are logged in but incomplete.
 *
 * Deliberately checks "has this wallet ever verified" (identityState !==
 * "none"), not useGoodDollarClaim's isWhitelisted — that one is strict and
 * current-window-only (correct for gating the UBI claim button itself), but
 * would force a "lapsed" wallet (verified before, GoodDollar's 3/180-day
 * window just expired — see lib/identity/status.ts) out of the entire app
 * back to /sign-in on every load. A lapsed re-verify only takes a minute and
 * is prompted right in the claim flow where it's actually needed; it
 * shouldn't block someone from viewing their own dashboard in the meantime.
 */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { authenticated, address, isReady } = useAuth();
  const router = useRouter();
  const { identityState, isLoading: isGoodDollarLoading } = useIdentity();
  const isGoodDollarInitialized = !isGoodDollarLoading;
  const hasEverVerified = identityState.state !== "none";

  const [onboardedChecked, setOnboardedChecked] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!authenticated || !address) {
      setOnboardedChecked(true);
      return;
    }
    let cancelled = false;
    setOnboardedChecked(false);
    void (async () => {
      try {
        const res = await fetch(`/api/onboarding?address=${address}`);
        const json = (await res.json()) as { onboarded?: boolean };
        if (!cancelled) setIsOnboarded(Boolean(json.onboarded));
      } catch {
        if (!cancelled) setIsOnboarded(false);
      } finally {
        if (!cancelled) setOnboardedChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, authenticated, address]);

  // Also covers the brief window before auth finishes initializing — we
  // don't yet know if there's a session to gate, so hold off rendering
  // protected content rather than risk a flash of it either way.
  const stillChecking =
    !isReady ||
    (authenticated && address && (!onboardedChecked || !isGoodDollarInitialized));
  const incomplete =
    isReady &&
    authenticated &&
    address &&
    onboardedChecked &&
    isGoodDollarInitialized &&
    (!isOnboarded || !hasEverVerified);

  useEffect(() => {
    if (incomplete) router.replace("/sign-in");
  }, [incomplete, router]);

  if (stillChecking || incomplete) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}

function MainLayoutShell({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();
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
          <LeftSidebar />
        </div>

        <div className="flex h-screen bg-background lg:pl-24">
          <ProfileLoader />
          <NotificationsPanel />
          <ClaimPanel />
          <WhitelistRedirectToast />
          <AppToast />
          <NoGasBanner />
          <EnableNotificationsBanner />
          <RewardsClaimBanner />
          <OnboardingGiftModal />

          <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden transition-[flex] duration-300 ease-out">
            <MainAppHeader />
            <MainAppContent>{children}</MainAppContent>
            {/* Reserves space so fixed BottomNav never covers scroll content */}
            <MobileBottomNavSpacer />
          </div>
        </div>

        <BottomNav onProfileClick={handleProfileClick} />
      </div>
      </LogoutSheetProvider>
  );
}
