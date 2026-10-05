"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { APP_HOME } from "@/components/main-nav-config";
import { InstallSheet } from "@/components/landing/install-sheet";
import { TryItPhone } from "@/components/landing/try-it-phone";
import {
  FaqSection,
  FeaturesSection,
  FinalCta,
  FreeMoneyBanner,
  HeroCopy,
  LandingFooter,
  LandingHeader,
  MobileStartBar,
  ProblemSection,
  StoriesSection,
  TwoWaysSection,
  WeekSection,
} from "@/components/landing/sections";

/**
 * Public marketing landing page (`/`). Signed-in visitors are sent to the app.
 * Design reference: docs/redesign/screens/Main.dc.html
 */
export function LandingPage() {
  const router = useRouter();
  const { authenticated, isReady } = useAuth();
  const [installOpen, setInstallOpen] = useState(false);
  const openInstall = () => setInstallOpen(true);

  useEffect(() => {
    if (hasStoredAuthSession() || (isReady && authenticated)) router.replace(APP_HOME);
  }, [authenticated, isReady, router]);

  return (
    // html/body don't scroll in this app (PWA shell), so the page owns its scroller.
    <div className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-paper font-body text-ink scroll-smooth">
      <LandingHeader onInstall={openInstall} />
      <section id="top" className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-6 pb-[88px] pt-14">
        <HeroCopy onInstall={openInstall} />
        <TryItPhone />
      </section>
      <FreeMoneyBanner />
      <ProblemSection />
      <TwoWaysSection onInstall={openInstall} />
      <WeekSection />
      <FeaturesSection />
      <StoriesSection />
      <FaqSection />
      <FinalCta onInstall={openInstall} />
      <LandingFooter />
      <div className="h-20 sm:hidden" aria-hidden />
      <MobileStartBar />
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
    </div>
  );
}
