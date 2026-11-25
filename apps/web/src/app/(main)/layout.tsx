"use client";

import { useEffect, useRef, useState } from "react";
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
import { useRouter } from "next/navigation";
import { hasStoredAuthSession, preloadAuthProviders } from "@/lib/auth-session-hint";
import { useReadContract } from "wagmi";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { AppLoader } from "@/components/app-loader";
import { markGatePassed } from "@/lib/app-gate-pass";

const BottomNav = dynamic(
  () => import("@/components/bottom-nav").then((m) => m.BottomNav),
  {
    ssr: false,
    loading: () => (
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 lg:hidden shadow-[0_-6px_20px_rgba(26,26,25,0.06)]"
        style={{ height: "var(--mobile-bottom-nav-bar)" }}
        aria-hidden
      />
    ),
  },
);
const DesktopSidebar = dynamic(
  () => import("@/components/desktop-sidebar").then((m) => m.DesktopSidebar),
  {
    ssr: false,
    loading: () => (
      <div
        className="hidden h-full w-[var(--desktop-sidebar-w)] shrink-0 border-r-2 border-line bg-white lg:block"
        aria-hidden
      />
    ),
  },
);
const FaceCheckHost = dynamic(
  () => import("@/components/face-check-host").then((m) => m.FaceCheckHost),
  { ssr: false },
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
const VotePrompt = dynamic(
  () => import("@/components/flow-state/vote-prompt").then((m) => m.VotePrompt),
  { ssr: false },
);
const InstallPromptGate = dynamic(
  () => import("@/components/pwa/install-prompt-gate").then((m) => m.InstallPromptGate),
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
const AppIntro = dynamic(
  () => import("@/components/app-intro").then((m) => m.AppIntro),
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
 * Only a profile is required — face verification unlocks free daily money
 * (prompted in the claim flow), never the app itself. New users can skip it at
 * signup by taking gas from the faucet instead (see usePostAuthRoute).
 */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { authenticated, address, isReady } = useAuth();
  const router = useRouter();

  // Same check as usePostAuthRoute: setProfile is the profile. A database row
  // does not let anyone in. isLoading, not isFetching: only the FIRST read may
  // hold the app. The global
  // QueryClient refetches on window focus, and this query is always stale, so
  // isFetching flips true every time the page regains focus — picking a proof
  // screenshot from the gallery, signing in the wallet popup, switching apps.
  // Gating on that swapped the whole app for a spinner and back, unmounting
  // whatever was open (proof modal, success card + confetti) mid-flow.
  const {
    data: onChainUsername,
    isLoading: isLoadingUsername,
    isError: usernameReadFailed,
    refetch: refetchUsername,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: { enabled: !!authenticated && !!address, staleTime: 0, gcTime: 0 },
  });
  const hasOnChainUsername =
    typeof onChainUsername === "string" && onChainUsername.trim().length > 0;

  // On refresh one auth SDK (usually Privy) can report ready before Web3Auth
  // has restored the session, so for a moment the user looks signed out and
  // the page flashes before the checks below start over. If this browser has
  // a stored session, wait briefly for it to restore (capped, so a dead
  // session can't hang the app).
  const [restoreTimedOut, setRestoreTimedOut] = useState(false);
  const restoringSession = !authenticated && !restoreTimedOut && hasStoredAuthSession();
  useEffect(() => {
    if (authenticated) return;
    const id = window.setTimeout(() => setRestoreTimedOut(true), 1_500);
    return () => window.clearTimeout(id);
  }, [authenticated]);

  // No saved visit skips this. The contract username has to be on screen
  // before any page renders. A failed read stays on this screen with a retry.
  const profileMissing =
    isReady &&
    authenticated &&
    !!address &&
    !isLoadingUsername &&
    !usernameReadFailed &&
    !hasOnChainUsername;

  useEffect(() => {
    if (profileMissing) router.replace("/welcome");
  }, [profileMissing, router]);

  const passedForRef = useRef<string | null>(null);
  if (hasOnChainUsername && address && passedForRef.current !== address) {
    passedForRef.current = address;
    markGatePassed(address);
  }

  if (!isReady || restoringSession) {
    return <AppLoader />;
  }

  if (authenticated && address && !hasOnChainUsername) {
    if (!isLoadingUsername && usernameReadFailed) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <h1 className="text-xl font-black text-foreground">Couldn&apos;t check your profile</h1>
          <p className="max-w-sm text-sm font-semibold text-muted-foreground">
            The network didn&apos;t answer, so the app stayed closed. Try the check again.
          </p>
          <button
            type="button"
            onClick={() => void refetchUsername()}
            className="press-edge h-12 rounded-2xl bg-ink px-6 text-sm font-extrabold uppercase text-white"
          >
            Try again
          </button>
        </div>
      );
    }
    return <AppLoader label="Set up your profile" />;
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
      <div className="h-dvh overflow-hidden">
        <div className="flex h-dvh bg-background">
          <DesktopSidebar />
          <ProfileLoader />
          <NotificationsPanel />
          <ClaimPanel />
          <FaceCheckHost />
          <WhitelistRedirectToast />
          <AppToast />
          <NoGasBanner />
          <EnableNotificationsBanner />
          {/* The Flow State vote takes the visit's pop-up first — voting matters most right now. */}
          <VotePrompt />
          <InstallPromptGate />
          <RewardsClaimBanner />
          {/* First-run intro goes first; the gift and email modals wait for it. */}
          <AppIntro />
          <OnboardingGiftModal />

          {/* relative: on desktop the HUD pins to this column, not the window */}
          <div className="relative flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden transition-[flex] duration-300 ease-out">
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
