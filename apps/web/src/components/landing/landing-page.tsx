"use client";

import { useEffect, useRef, useState } from "react";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { TryItPhone } from "@/components/landing/try-it-phone";
import { useReveal } from "@/components/landing/use-reveal";
import {
  FaqSection,
  FeaturesSection,
  FinalCta,
  FreeMoneyBanner,
  HeroCopy,
  LandingFooter,
  LandingHeader,
  ProblemSection,
  StoriesSection,
  TwoWaysSection,
  WeekSection,
} from "@/components/landing/sections";

/**
 * Public marketing landing page (`/`). Signed-in visitors can browse it too;
 * the header's "Open app" link takes them straight into the app.
 * Design reference: docs/redesign/screens/Main.dc.html
 */
export function LandingPage() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  useReveal(scrollerRef);

  // The landing page runs without the wallet providers (see
  // AuthLoadOrchestrator), so "signed in" comes from the stored-session hint.
  // Read after mount: it lives in localStorage, unavailable in the server render.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(hasStoredAuthSession());
  }, []);

  return (
    // html/body don't scroll in this app (PWA shell), so the page owns its scroller.
    <div ref={scrollerRef} className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-paper font-body text-ink scroll-smooth">
      <LandingHeader signedIn={signedIn} />
      <section id="top" className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-6 pb-[88px] pt-14">
        <HeroCopy />
        <TryItPhone />
      </section>
      <FreeMoneyBanner />
      <ProblemSection />
      <TwoWaysSection />
      <WeekSection />
      <FeaturesSection />
      <StoriesSection />
      <FaqSection />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
